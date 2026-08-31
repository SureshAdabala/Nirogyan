import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { stableMeasurementHash } from '../apps/server/src/modules/measurement-contract';
import {
  RECONCILIATION_ROOT,
  reconcileNiroDrafts,
  sha256Text,
  stableP8Json,
  type ReconciledNiroDraft,
} from './reconcile-niro-drafts';

type JsonRecord = Record<string, unknown>;
type FetchImplementation = typeof globalThis.fetch;

const TARGET_SLUGS = ['diabetes-risk', 'heart-risk', 'hypothyroid-risk', 'niro-cws'] as const;
const TARGET_SLUG_SET = new Set<string>(TARGET_SLUGS);
const CORE_MEASUREMENT_REVISION = 3;
const OBJECT_ID = /^[a-f\d]{24}$/iu;
const SAFE_DATABASE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_-]{0,63}$/u;

export const LIVE_IMPORT_USAGE = `Usage:
  npx tsx scripts/import-niro-drafts-live.ts \\
    --allow-live-draft-import \\
    --expected-node-env=development \\
    --expected-db-name=<exact MONGODB_DB_NAME> \\
    [--api-url=http://127.0.0.1:4000]

Required root .env values:
  MONGODB_URI, MONGODB_DB_NAME, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD

Optional root .env value:
  P8_ADMIN_API_BASE_URL=http://127.0.0.1:4000

The existing local server must be running against the exact named non-production database.
The command creates draft version 1 records only. It never verifies measurements, approves,
publishes, retires, updates, or deletes any record.`;

export interface LiveImportEnvironment {
  readonly NODE_ENV?: string;
  readonly PORT?: string;
  readonly MONGODB_URI?: string;
  readonly MONGODB_DB_NAME?: string;
  readonly ADMIN_BOOTSTRAP_EMAIL?: string;
  readonly ADMIN_BOOTSTRAP_PASSWORD?: string;
  readonly P8_ADMIN_API_BASE_URL?: string;
}

export interface AuthorizedLiveImport {
  readonly nodeEnv: 'development' | 'test';
  readonly databaseName: string;
  readonly apiBaseUrl: URL;
  readonly email: string;
  readonly password: string;
}

export interface AdminMeasurementRevision {
  readonly id: string;
  readonly key: string;
  readonly revision: number;
  readonly status: string;
  readonly definitionHash: string;
  readonly definition: JsonRecord;
  readonly reviewedBy?: unknown;
  readonly reviewHash?: unknown;
  readonly verifiedAt?: unknown;
}

export interface DraftMeasurementBinding {
  readonly calculatorSlug: string;
  readonly biomarkerKeys: readonly string[];
  readonly revisionIds: readonly string[];
  readonly dependencyStatus: 'unapproved-draft-revision-3';
}

export interface IntendedLiveDraft {
  readonly calculatorSlug: string;
  readonly name: string;
  readonly payload: JsonRecord;
  readonly measurementRevisionIds: readonly string[];
  readonly fixtureSha256: string;
  readonly reconciledPayloadSha256: string;
  readonly intendedPayloadSha256: string;
}

export interface ExistingCalculatorSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly currentVersionId?: string;
  readonly draftVersionId?: string;
}

export interface ExistingCalculatorVersion {
  readonly id: string;
  readonly calculatorSlug: string;
  readonly version: number;
  readonly status: string;
  readonly payload: JsonRecord;
  readonly measurements: {
    readonly revisionIds: readonly string[];
    readonly count: number;
  };
}

export interface ExistingDraftLookup {
  readonly calculators: readonly ExistingCalculatorSummary[];
  readonly versionsBySlug: Readonly<Record<string, readonly ExistingCalculatorVersion[]>>;
}

export interface DraftPreflightResult {
  readonly noOpSlugs: readonly string[];
  readonly createSlugs: readonly string[];
}

export interface LiveDraftImportResult {
  readonly mode: 'live-admin-api-draft-import';
  readonly status: 'ok';
  readonly environment: 'development' | 'test';
  readonly database: string;
  readonly apiOrigin: string;
  readonly measurementDependency: {
    readonly revision: 3;
    readonly lifecycle: 'draft';
    readonly approval: 'unapproved';
  };
  readonly drafts: readonly {
    readonly calculatorSlug: string;
    readonly outcome: 'created' | 'no-op';
    readonly biomarkerBindings: number;
    readonly fixtureSha256: string;
    readonly reconciledPayloadSha256: string;
    readonly intendedPayloadSha256: string;
  }[];
  readonly prohibitedLifecycleActionsPerformed: 0;
}

export class LiveDraftImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveDraftImportError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const matches: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === name) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new LiveDraftImportError(`${name} requires an explicit value.`);
      }
      matches.push(value);
      index += 1;
      continue;
    }
    if (argument?.startsWith(`${name}=`)) matches.push(argument.slice(name.length + 1));
  }
  if (matches.length > 1) throw new LiveDraftImportError(`${name} may be supplied only once.`);
  return matches[0];
}

function assertKnownArguments(args: readonly string[]): void {
  const valueArguments = new Set(['--expected-node-env', '--expected-db-name', '--api-url']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--allow-live-draft-import' || argument === '--help' || argument === '-h') {
      continue;
    }
    const equalsName = argument?.split('=', 1)[0];
    if (equalsName && valueArguments.has(equalsName) && argument?.includes('=')) continue;
    if (argument && valueArguments.has(argument)) {
      index += 1;
      continue;
    }
    throw new LiveDraftImportError(`Unsupported argument: ${argument ?? '<empty>'}.`);
  }
}

function loopbackApiUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LiveDraftImportError('--api-url must be a valid absolute loopback URL.');
  }
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (!loopbackHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    throw new LiveDraftImportError(
      'P8 live import accepts only an HTTP(S) loopback Admin API URL.',
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new LiveDraftImportError(
      'The Admin API URL cannot contain credentials, query, or fragment data.',
    );
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new LiveDraftImportError(
      'The Admin API URL must contain only the origin, without a path.',
    );
  }
  return new URL(url.origin);
}

export function authorizeLiveDraftImport(
  args: readonly string[],
  source: LiveImportEnvironment,
): AuthorizedLiveImport {
  assertKnownArguments(args);
  if (!args.includes('--allow-live-draft-import')) {
    throw new LiveDraftImportError('Live draft import requires --allow-live-draft-import.');
  }
  if (source.NODE_ENV === 'production') {
    throw new LiveDraftImportError('P8 live draft import is prohibited in production.');
  }
  const environment = loadEnvironment(source as NodeJS.ProcessEnv);
  if (environment.nodeEnv === 'production') {
    throw new LiveDraftImportError('P8 live draft import is prohibited in production.');
  }
  const expectedNodeEnv = argumentValue(args, '--expected-node-env');
  if (!expectedNodeEnv || !['development', 'test'].includes(expectedNodeEnv)) {
    throw new LiveDraftImportError(
      '--expected-node-env must explicitly equal development or test.',
    );
  }
  if (expectedNodeEnv !== environment.nodeEnv) {
    throw new LiveDraftImportError(
      '--expected-node-env does not match the resolved project environment.',
    );
  }
  if (!environment.mongoUri) {
    throw new LiveDraftImportError('MONGODB_URI must be configured in the project-root .env.');
  }
  const expectedDatabaseName = argumentValue(args, '--expected-db-name');
  if (!expectedDatabaseName || !SAFE_DATABASE_NAME.test(expectedDatabaseName)) {
    throw new LiveDraftImportError('--expected-db-name must be an explicit safe database name.');
  }
  if (expectedDatabaseName !== environment.mongoDbName) {
    throw new LiveDraftImportError(
      '--expected-db-name does not exactly match the resolved MONGODB_DB_NAME.',
    );
  }
  const email = source.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = source.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new LiveDraftImportError(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be configured at runtime.',
    );
  }
  const requestedApiUrl =
    argumentValue(args, '--api-url') ??
    source.P8_ADMIN_API_BASE_URL ??
    `http://127.0.0.1:${environment.port}`;
  return {
    nodeEnv: environment.nodeEnv,
    databaseName: environment.mongoDbName,
    apiBaseUrl: loopbackApiUrl(requestedApiUrl),
    email,
    password,
  };
}

interface CoreMeasurementSeedRecord {
  readonly definition: JsonRecord;
}

interface CoreMeasurementSeed {
  readonly schemaVersion: string;
  readonly records: readonly CoreMeasurementSeedRecord[];
}

export function readCoreMeasurementSeed(
  root = RECONCILIATION_ROOT,
): ReadonlyMap<string, CoreMeasurementSeedRecord> {
  const path = join(root, 'data', 'seeds', 'core-measurements.v1.seed.json');
  const document = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isRecord(document) || document.schemaVersion !== 'core-measurement-seed.v1') {
    throw new LiveDraftImportError('The checked core measurement seed has an invalid schema.');
  }
  const records = (document as unknown as CoreMeasurementSeed).records;
  if (!Array.isArray(records) || records.length !== 40) {
    throw new LiveDraftImportError(
      'The checked core measurement seed must contain exactly 40 rows.',
    );
  }
  const byKey = new Map<string, CoreMeasurementSeedRecord>();
  for (const record of records) {
    const definition = record?.definition;
    const key = isRecord(definition) ? definition.key : undefined;
    if (
      typeof key !== 'string' ||
      definition.version !== CORE_MEASUREMENT_REVISION ||
      definition.status !== 'draft' ||
      byKey.has(key)
    ) {
      throw new LiveDraftImportError('The checked core measurement seed identity is invalid.');
    }
    byKey.set(key, record);
  }
  return byKey;
}

export function calculatorBiomarkerKeys(payload: JsonRecord): readonly string[] {
  const keys = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'biomarkerKey') {
        if (typeof entry !== 'string' || !entry) {
          throw new LiveDraftImportError('A calculator biomarkerKey is not a nonempty string.');
        }
        keys.add(entry);
      }
      visit(entry);
    }
  };
  visit(payload);
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function exactSeedDraftRow(
  key: string,
  rows: readonly AdminMeasurementRevision[],
  seed: ReadonlyMap<string, CoreMeasurementSeedRecord>,
): AdminMeasurementRevision {
  const expected = seed.get(key);
  if (!expected) {
    throw new LiveDraftImportError(`No checked core measurement seed exists for ${key}.`);
  }
  const candidates = rows
    .filter((row) => row.key === key)
    .sort((left, right) => right.revision - left.revision || left.id.localeCompare(right.id));
  const latest = candidates[0];
  if (!latest || latest.revision !== CORE_MEASUREMENT_REVISION) {
    throw new LiveDraftImportError(
      `The latest persisted measurement revision for ${key} is not exact seed revision 3.`,
    );
  }
  if (candidates.filter((row) => row.revision === CORE_MEASUREMENT_REVISION).length !== 1) {
    throw new LiveDraftImportError(`Measurement ${key} has an ambiguous revision 3 identity.`);
  }
  const expectedHash = stableMeasurementHash(expected.definition);
  const governance = isRecord(latest.definition.governance)
    ? latest.definition.governance
    : undefined;
  if (
    !OBJECT_ID.test(latest.id) ||
    latest.status !== 'draft' ||
    latest.definitionHash !== expectedHash ||
    stableP8Json(latest.definition) !== stableP8Json(expected.definition) ||
    latest.verifiedAt != null ||
    latest.reviewedBy != null ||
    latest.reviewHash != null ||
    governance?.reviewStatus !== 'unreviewed' ||
    governance.reviewerId !== null ||
    governance.reviewedAt !== null
  ) {
    throw new LiveDraftImportError(
      `Measurement ${key}@3 is not the exact unapproved seed/core draft dependency.`,
    );
  }
  return latest;
}

function validateDraftSet(drafts: readonly ReconciledNiroDraft[]): void {
  if (drafts.length !== TARGET_SLUGS.length) {
    throw new LiveDraftImportError('P8 requires exactly four reconciled Niro drafts.');
  }
  const slugs = drafts.map((draft) => draft.calculatorSlug);
  if (
    new Set(slugs).size !== TARGET_SLUGS.length ||
    slugs.some((slug) => !TARGET_SLUG_SET.has(slug))
  ) {
    throw new LiveDraftImportError('The reconciled P8 draft allowlist is incomplete or changed.');
  }
}

export function resolveDraftMeasurementBindings(
  drafts: readonly ReconciledNiroDraft[],
  rows: readonly AdminMeasurementRevision[],
  seed = readCoreMeasurementSeed(),
): readonly DraftMeasurementBinding[] {
  validateDraftSet(drafts);
  return drafts.map((draft) => {
    const biomarkerKeys = calculatorBiomarkerKeys(draft.payload);
    const revisionIds = biomarkerKeys.map((key) => exactSeedDraftRow(key, rows, seed).id);
    if (
      revisionIds.length !== biomarkerKeys.length ||
      new Set(revisionIds).size !== revisionIds.length
    ) {
      throw new LiveDraftImportError(
        `Measurement coverage for ${draft.calculatorSlug} is not exact and one-to-one.`,
      );
    }
    return {
      calculatorSlug: draft.calculatorSlug,
      biomarkerKeys,
      revisionIds,
      dependencyStatus: 'unapproved-draft-revision-3',
    };
  });
}

export function materializeIntendedLiveDrafts(
  drafts: readonly ReconciledNiroDraft[],
  bindings: readonly DraftMeasurementBinding[],
): readonly IntendedLiveDraft[] {
  validateDraftSet(drafts);
  const bindingBySlug = new Map(bindings.map((binding) => [binding.calculatorSlug, binding]));
  if (bindingBySlug.size !== TARGET_SLUGS.length) {
    throw new LiveDraftImportError('Exact measurement coverage is required for all four drafts.');
  }
  return drafts.map((draft) => {
    if (sha256Text(stableP8Json(draft.payload)) !== draft.payloadSha256) {
      throw new LiveDraftImportError(
        `Reconciled payload hash drift detected for ${draft.calculatorSlug}.`,
      );
    }
    const binding = bindingBySlug.get(draft.calculatorSlug);
    if (!binding) {
      throw new LiveDraftImportError(`Missing measurement coverage for ${draft.calculatorSlug}.`);
    }
    const expectedKeys = calculatorBiomarkerKeys(draft.payload);
    if (stableP8Json(expectedKeys) !== stableP8Json(binding.biomarkerKeys)) {
      throw new LiveDraftImportError(
        `Measurement-key coverage drift detected for ${draft.calculatorSlug}.`,
      );
    }
    const originalSources = stableP8Json(draft.payload.sources);
    const payload = structuredClone(draft.payload);
    const governance = isRecord(payload.governance) ? payload.governance : undefined;
    if (!governance) {
      throw new LiveDraftImportError(`Draft governance is missing for ${draft.calculatorSlug}.`);
    }
    governance.measurementRevisionIds = [...binding.revisionIds];
    payload.calculatorSlug = draft.calculatorSlug;
    payload.version = 1;
    payload.status = 'draft';
    if (stableP8Json(payload.sources) !== originalSources) {
      throw new LiveDraftImportError(
        `Source metadata changed while preparing ${draft.calculatorSlug}.`,
      );
    }
    const name = payload.name;
    if (typeof name !== 'string' || !name.trim()) {
      throw new LiveDraftImportError(`Draft ${draft.calculatorSlug} has no name.`);
    }
    return {
      calculatorSlug: draft.calculatorSlug,
      name: name.trim(),
      payload,
      measurementRevisionIds: [...binding.revisionIds],
      fixtureSha256: draft.fixtureSha256,
      reconciledPayloadSha256: draft.payloadSha256,
      intendedPayloadSha256: sha256Text(stableP8Json(payload)),
    };
  });
}

function assertExactExistingDraft(
  intended: IntendedLiveDraft,
  calculator: ExistingCalculatorSummary,
  versions: readonly ExistingCalculatorVersion[],
): void {
  if (
    calculator.slug !== intended.calculatorSlug ||
    calculator.name !== intended.name ||
    calculator.status !== 'draft' ||
    calculator.currentVersionId != null ||
    versions.length !== 1
  ) {
    throw new LiveDraftImportError(
      `Existing calculator ${intended.calculatorSlug} conflicts with the exact P8 v1 draft.`,
    );
  }
  const version = versions[0];
  if (
    !version ||
    version.version !== 1 ||
    version.status !== 'draft' ||
    version.calculatorSlug !== intended.calculatorSlug ||
    calculator.draftVersionId !== version.id ||
    stableP8Json(version.payload) !== stableP8Json(intended.payload) ||
    stableP8Json(version.measurements.revisionIds) !==
      stableP8Json(intended.measurementRevisionIds) ||
    version.measurements.count !== intended.measurementRevisionIds.length
  ) {
    throw new LiveDraftImportError(
      `Existing calculator ${intended.calculatorSlug} has payload, binding, or version drift.`,
    );
  }
}

export function preflightExistingDrafts(
  intendedDrafts: readonly IntendedLiveDraft[],
  existing: ExistingDraftLookup,
): DraftPreflightResult {
  const summaryBySlug = new Map<string, ExistingCalculatorSummary>();
  for (const summary of existing.calculators) {
    if (!TARGET_SLUG_SET.has(summary.slug)) continue;
    if (summaryBySlug.has(summary.slug)) {
      throw new LiveDraftImportError(`Duplicate calculator identity returned for ${summary.slug}.`);
    }
    summaryBySlug.set(summary.slug, summary);
  }
  const noOpSlugs: string[] = [];
  const createSlugs: string[] = [];
  for (const intended of intendedDrafts) {
    const calculator = summaryBySlug.get(intended.calculatorSlug);
    if (!calculator) {
      createSlugs.push(intended.calculatorSlug);
      continue;
    }
    const versions = existing.versionsBySlug[intended.calculatorSlug];
    if (!versions) {
      throw new LiveDraftImportError(
        `Existing calculator ${intended.calculatorSlug} was not fully preflighted.`,
      );
    }
    assertExactExistingDraft(intended, calculator, versions);
    noOpSlugs.push(intended.calculatorSlug);
  }
  return { noOpSlugs, createSlugs };
}

function setCookieHeaders(response: Response): readonly string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values && values.length > 0) return values;
  const combined = response.headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*niro_[a-z]+=)/iu).map((value) => value.trim()) : [];
}

function accessTokenFrom(response: Response): string | undefined {
  const prefix = 'niro_access=';
  const pair = setCookieHeaders(response)
    .map((header) => header.split(';', 1)[0]?.trim())
    .find((value) => value?.startsWith(prefix));
  if (!pair) return undefined;
  try {
    return decodeURIComponent(pair.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function safeErrorCode(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  const code = value.error.code;
  return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : undefined;
}

async function parseResponseJson(response: Response, operation: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LiveDraftImportError(
      `${operation} returned malformed JSON (HTTP ${response.status}).`,
    );
  }
}

async function throwSafeHttpFailure(response: Response, operation: string): Promise<never> {
  let code: string | undefined;
  try {
    code = safeErrorCode(await response.json());
  } catch {
    code = undefined;
  }
  throw new LiveDraftImportError(
    `${operation} failed (HTTP ${response.status}${code ? `, code ${code}` : ''}).`,
  );
}

function dataArray(value: unknown, operation: string): readonly unknown[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new LiveDraftImportError(`${operation} returned an invalid data envelope.`);
  }
  return value.data;
}

function parseMeasurementRows(value: unknown): readonly AdminMeasurementRevision[] {
  return dataArray(value, 'Measurement listing').map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.key !== 'string' ||
      typeof entry.revision !== 'number' ||
      typeof entry.status !== 'string' ||
      typeof entry.definitionHash !== 'string' ||
      !isRecord(entry.definition)
    ) {
      throw new LiveDraftImportError('Measurement listing returned an invalid row.');
    }
    return entry as unknown as AdminMeasurementRevision;
  });
}

function parseCalculatorSummaries(value: unknown): readonly ExistingCalculatorSummary[] {
  return dataArray(value, 'Calculator listing').map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.slug !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.status !== 'string'
    ) {
      throw new LiveDraftImportError('Calculator listing returned an invalid row.');
    }
    return entry as unknown as ExistingCalculatorSummary;
  });
}

function parseCalculatorVersions(value: unknown): readonly ExistingCalculatorVersion[] {
  return dataArray(value, 'Calculator version listing').map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.calculatorSlug !== 'string' ||
      typeof entry.version !== 'number' ||
      typeof entry.status !== 'string' ||
      !isRecord(entry.payload) ||
      !isRecord(entry.measurements) ||
      !Array.isArray(entry.measurements.revisionIds) ||
      !entry.measurements.revisionIds.every((id) => typeof id === 'string') ||
      typeof entry.measurements.count !== 'number'
    ) {
      throw new LiveDraftImportError('Calculator version listing returned an invalid row.');
    }
    return entry as unknown as ExistingCalculatorVersion;
  });
}

function apiUrl(configuration: AuthorizedLiveImport, path: string): URL {
  return new URL(path, configuration.apiBaseUrl);
}

async function login(
  configuration: AuthorizedLiveImport,
  fetchImplementation: FetchImplementation,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImplementation(apiUrl(configuration, '/api/v1/admin/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({ email: configuration.email, password: configuration.password }),
    });
  } catch {
    throw new LiveDraftImportError('Admin login failed because the loopback API was unavailable.');
  }
  if (!response.ok) await throwSafeHttpFailure(response, 'Admin login');
  const accessToken = accessTokenFrom(response);
  if (!accessToken) {
    throw new LiveDraftImportError('Admin login did not issue an in-memory access credential.');
  }
  return accessToken;
}

async function authenticatedGet(
  configuration: AuthorizedLiveImport,
  accessToken: string,
  fetchImplementation: FetchImplementation,
  path: string,
  operation: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImplementation(apiUrl(configuration, path), {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'cache-control': 'no-store',
        connection: 'close',
      },
    });
  } catch {
    throw new LiveDraftImportError(`${operation} failed because the loopback API was unavailable.`);
  }
  if (!response.ok) await throwSafeHttpFailure(response, operation);
  return parseResponseJson(response, operation);
}

async function loadExistingDrafts(
  configuration: AuthorizedLiveImport,
  accessToken: string,
  fetchImplementation: FetchImplementation,
): Promise<ExistingDraftLookup> {
  const calculators = parseCalculatorSummaries(
    await authenticatedGet(
      configuration,
      accessToken,
      fetchImplementation,
      '/api/v1/admin/calculators',
      'Calculator preflight',
    ),
  );
  const versionsBySlug: Record<string, readonly ExistingCalculatorVersion[]> = {};
  for (const calculator of calculators) {
    if (!TARGET_SLUG_SET.has(calculator.slug)) continue;
    versionsBySlug[calculator.slug] = parseCalculatorVersions(
      await authenticatedGet(
        configuration,
        accessToken,
        fetchImplementation,
        `/api/v1/admin/calculators/${encodeURIComponent(calculator.slug)}/versions`,
        `Version preflight for ${calculator.slug}`,
      ),
    );
  }
  return { calculators, versionsBySlug };
}

async function createDraft(
  configuration: AuthorizedLiveImport,
  accessToken: string,
  fetchImplementation: FetchImplementation,
  intended: IntendedLiveDraft,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImplementation(apiUrl(configuration, '/api/v1/admin/calculators'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        connection: 'close',
        'idempotency-key': `p8-draft:${intended.calculatorSlug}:${intended.intendedPayloadSha256}`,
      },
      body: JSON.stringify({
        slug: intended.calculatorSlug,
        name: intended.name,
        payload: intended.payload,
        measurementRevisionIds: intended.measurementRevisionIds,
      }),
    });
  } catch {
    throw new LiveDraftImportError(
      `Write outcome for ${intended.calculatorSlug} is unknown. Stop and rerun the same command; exact committed state becomes a no-op and any drift fails closed.`,
    );
  }
  if (!response.ok)
    await throwSafeHttpFailure(response, `Draft creation for ${intended.calculatorSlug}`);
  const body = await parseResponseJson(response, `Draft creation for ${intended.calculatorSlug}`);
  if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.version)) {
    throw new LiveDraftImportError(
      `Draft creation for ${intended.calculatorSlug} returned an invalid success envelope.`,
    );
  }
  const version = parseCalculatorVersions({ data: [body.data.version] })[0];
  const calculator = body.data.calculator;
  if (!version || !isRecord(calculator)) {
    throw new LiveDraftImportError(
      `Draft creation for ${intended.calculatorSlug} returned incomplete state.`,
    );
  }
  if (
    typeof calculator.id !== 'string' ||
    calculator.slug !== intended.calculatorSlug ||
    calculator.name !== intended.name ||
    calculator.status !== 'draft'
  ) {
    throw new LiveDraftImportError(
      `Draft creation for ${intended.calculatorSlug} returned a conflicting calculator identity.`,
    );
  }
  assertExactExistingDraft(
    intended,
    {
      id: calculator.id,
      slug: calculator.slug,
      name: calculator.name,
      status: calculator.status,
      draftVersionId: version.id,
    },
    [version],
  );
  const durable = preflightExistingDrafts(
    [intended],
    await loadExistingDrafts(configuration, accessToken, fetchImplementation),
  );
  if (!durable.noOpSlugs.includes(intended.calculatorSlug)) {
    throw new LiveDraftImportError(
      `Draft creation for ${intended.calculatorSlug} was not durably observable.`,
    );
  }
}

export async function executeLiveDraftImport(options: {
  readonly args: readonly string[];
  readonly environment: LiveImportEnvironment;
  readonly fetchImplementation?: FetchImplementation;
  readonly root?: string;
}): Promise<LiveDraftImportResult> {
  const configuration = authorizeLiveDraftImport(options.args, options.environment);
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const root = options.root ?? RECONCILIATION_ROOT;
  const drafts = reconcileNiroDrafts(root);
  const accessToken = await login(configuration, fetchImplementation);
  const measurementRows = parseMeasurementRows(
    await authenticatedGet(
      configuration,
      accessToken,
      fetchImplementation,
      '/api/v1/admin/biomarkers',
      'Measurement dependency preflight',
    ),
  );
  const bindings = resolveDraftMeasurementBindings(
    drafts,
    measurementRows,
    readCoreMeasurementSeed(root),
  );
  const intendedDrafts = materializeIntendedLiveDrafts(drafts, bindings);

  // Every existing target is compared before the first calculator write. This is
  // the rerun boundary after a response-loss/unknown-commit event.
  const preflight = preflightExistingDrafts(
    intendedDrafts,
    await loadExistingDrafts(configuration, accessToken, fetchImplementation),
  );
  const noOpSlugs = new Set(preflight.noOpSlugs);
  const outcomes = [] as LiveDraftImportResult['drafts'][number][];
  for (const intended of intendedDrafts) {
    let outcome: 'created' | 'no-op';
    if (noOpSlugs.has(intended.calculatorSlug)) {
      outcome = 'no-op';
    } else {
      await createDraft(configuration, accessToken, fetchImplementation, intended);
      outcome = 'created';
    }
    outcomes.push({
      calculatorSlug: intended.calculatorSlug,
      outcome,
      biomarkerBindings: intended.measurementRevisionIds.length,
      fixtureSha256: intended.fixtureSha256,
      reconciledPayloadSha256: intended.reconciledPayloadSha256,
      intendedPayloadSha256: intended.intendedPayloadSha256,
    });
  }
  return {
    mode: 'live-admin-api-draft-import',
    status: 'ok',
    environment: configuration.nodeEnv,
    database: configuration.databaseName,
    apiOrigin: configuration.apiBaseUrl.origin,
    measurementDependency: {
      revision: 3,
      lifecycle: 'draft',
      approval: 'unapproved',
    },
    drafts: outcomes,
    prohibitedLifecycleActionsPerformed: 0,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(LIVE_IMPORT_USAGE);
    return;
  }
  loadProjectEnvironment();
  const result = await executeLiveDraftImport({ args, environment: process.env });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof LiveDraftImportError ? error.message : 'P8 live import failed safely.',
    );
    console.error(LIVE_IMPORT_USAGE);
    process.exitCode = 1;
  });
}
