import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

interface SourceRef extends JsonObject {
  readonly type?: string;
  readonly ref?: string;
  readonly verification?: string;
}

interface GovernanceOverlay extends JsonObject {
  readonly clinicalStatus: string;
  readonly sourceReviewStatus: string;
  readonly discrepancyIds: readonly string[];
  readonly publishBlockers: readonly string[];
  readonly reviews: readonly JsonObject[];
  readonly measurementRevisionIds: readonly string[];
}

interface MetadataOverlay extends JsonObject {
  readonly status: 'draft';
  readonly engineSemanticVersion: '1.0.0';
  readonly sources: readonly SourceRef[];
  readonly governance: GovernanceOverlay;
}

export interface NiroOverlayEntry {
  readonly calculatorSlug: string;
  readonly fixturePath: string;
  readonly expectedSha256: string;
  readonly metadataOverlay: MetadataOverlay;
  readonly resolvedByLockedContract: readonly string[];
  readonly publicationEligibility: {
    readonly eligible: false;
    readonly status: string;
    readonly reason: string;
  };
}

export interface NiroReconciliationPlan {
  readonly schemaVersion: 'niro-draft-reconciliation.v1';
  readonly purpose: string;
  readonly engineSemanticVersion: '1.0.0';
  readonly sourceFixtureHashes: Readonly<Record<string, string>>;
  readonly sourceArtifactHashes: Readonly<Record<string, string>>;
  readonly quarantineBoundary: JsonObject;
  readonly overlays: readonly NiroOverlayEntry[];
}

interface SourceExtractArtifact {
  readonly path: string;
  readonly sha256: string;
  readonly calculators: readonly string[];
}

interface CalculatorEvidence {
  readonly calculatorSlug: string;
  readonly locator: string;
  readonly confirmed: readonly string[];
  readonly unresolved: readonly string[];
}

export interface NiroSourceExtract {
  readonly schemaVersion: 'niro-source-extract.v1';
  readonly authority: string;
  readonly artifacts: readonly SourceExtractArtifact[];
  readonly calculatorEvidence: readonly CalculatorEvidence[];
  readonly excluded: {
    readonly covidFixture: string;
    readonly catalog: string;
  };
}

export interface ReconciledNiroDraft {
  readonly calculatorSlug: string;
  readonly fixturePath: string;
  readonly fixtureSha256: string;
  readonly payloadSha256: string;
  readonly publishEligible: false;
  readonly blockers: number;
  readonly payload: JsonObject;
}

export const RECONCILIATION_ROOT = resolve(__dirname, '..');
export const RECONCILIATION_PLAN_PATH = join(
  RECONCILIATION_ROOT,
  'data',
  'reconciliation',
  'niro-draft-overlays.v1.json',
);
export const SOURCE_EXTRACT_PATH = join(
  RECONCILIATION_ROOT,
  'data',
  'reconciliation',
  'niro-source-extract.v1.json',
);

const EXPECTED_FIXTURE_HASHES = {
  'data/fixtures/config-samples/covid-risk.config.json':
    '82180cbfa630eba514f536419bcdb969ee74da36cca5e44236fe7f1bf8897de3',
  'data/fixtures/config-samples/diabetes-risk.config.json':
    '1dee527ed5ce64ac64f7a567577d1e3cee49a0c442a7afc2793a3b956d75152a',
  'data/fixtures/config-samples/heart-risk.config.json':
    '2c4c70c6b1264abbe2db2c12638052abbc83255fab76ef7bc06968d76c802f93',
  'data/fixtures/config-samples/hypothyroid-risk.config.json':
    'a6ebd589f2b5ae105ed3b96376bfb263e2f5ba1432d291a0e37a3988177fb7c8',
  'data/fixtures/config-samples/niro-cws.config.json':
    '42e0a1826efb32fbc7df593a5574424df08d93b855abc4026a64b4ce6bbce52e',
} as const;

const EXPECTED_SOURCE_HASHES = {
  'data/sources/risk-analysis/Comprehensive Wellness Score Framework_ A Point-Based Assessment of Health Parameters.pdf':
    '4754b17e16e8f029a912462847ec47568a7b4bd0e547433b13692742fdb21ee3',
  'data/sources/risk-analysis/Risk calculators.xlsx':
    'f1d808861d61b1a4e748a2c079c0cafae521a3c1e0ef01c84cd015ac293fc089',
} as const;

const EXACT_OVERLAY_PATHS = new Set([
  'data/fixtures/config-samples/diabetes-risk.config.json',
  'data/fixtures/config-samples/heart-risk.config.json',
  'data/fixtures/config-samples/hypothyroid-risk.config.json',
  'data/fixtures/config-samples/niro-cws.config.json',
]);
const EXPECTED_SOURCE_REFS = {
  'diabetes-risk': 'data/sources/risk-analysis/Risk calculators.xlsx#Diabetes!B5:I27',
  'heart-risk': "data/sources/risk-analysis/Risk calculators.xlsx#'Heart '!A1:V66",
  'hypothyroid-risk': 'data/sources/risk-analysis/Risk calculators.xlsx#Hypothyroid!A2:E49',
  'niro-cws':
    'data/sources/risk-analysis/Comprehensive Wellness Score Framework_ A Point-Based Assessment of Health Parameters.pdf#sections-2-6-and-page-18',
} as const;
const EXPECTED_EXTRACT_LOCATORS = {
  'diabetes-risk': 'Risk calculators.xlsx#Diabetes!B5:I27',
  'heart-risk': "Risk calculators.xlsx#'Heart '!A1:V66",
  'hypothyroid-risk': 'Risk calculators.xlsx#Hypothyroid!A2:E49',
  'niro-cws': 'Comprehensive Wellness Score Framework PDF sections 2–6 and page 18',
} as const;
const EXPECTED_CALCULATOR_DISCREPANCY_COUNTS = {
  'diabetes-risk': 14,
  'heart-risk': 20,
  'hypothyroid-risk': 7,
  'niro-cws': 20,
} as const;
const ALLOWED_METADATA_KEYS = new Set(['status', 'engineSemanticVersion', 'sources', 'governance']);
const FORBIDDEN_CLINICAL_KEYS = new Set([
  'parameters',
  'scoringRules',
  'parameterGroupsAggregation',
  'imputationRules',
  'lookupTables',
  'formulas',
  'floorRules',
  'domains',
  'domainAggregationPolicy',
  'adjustmentRules',
  'resultCategories',
  'uiConfig',
  'content',
  'testCases',
  'points',
  'weight',
  'category',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableP8Json(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function normalizedProjectPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function assertPathWithinRoot(root: string, projectPath: string): string {
  const normalized = normalizedProjectPath(projectPath);
  if (isAbsolute(projectPath) || normalized.includes('/catalog/') || normalized.startsWith('../')) {
    throw new Error(`Refusing unsafe or quarantined path: ${projectPath}`);
  }
  const absolute = resolve(root, normalized);
  const fromRoot = relative(root, absolute);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new Error(`Refusing path outside repository root: ${projectPath}`);
  }
  return absolute;
}

function forbiddenKeys(value: unknown, path = '$'): readonly string[] {
  if (Array.isArray(value))
    return value.flatMap((entry, index) => forbiddenKeys(entry, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  const findings: string[] = [];
  for (const [key, entry] of Object.entries(value as JsonObject)) {
    if (FORBIDDEN_CLINICAL_KEYS.has(key)) findings.push(`${path}.${key}`);
    findings.push(...forbiddenKeys(entry, `${path}.${key}`));
  }
  return findings;
}

export function readReconciliationPlan(path = RECONCILIATION_PLAN_PATH): NiroReconciliationPlan {
  return JSON.parse(readFileSync(path, 'utf8')) as NiroReconciliationPlan;
}

export function readNiroSourceExtract(path = SOURCE_EXTRACT_PATH): NiroSourceExtract {
  return JSON.parse(readFileSync(path, 'utf8')) as NiroSourceExtract;
}

function discrepancyReferences(blockers: readonly string[]): ReadonlySet<string> {
  return new Set(
    blockers.flatMap(
      (blocker) => blocker.match(/\b(?:GEN|DIA|HRT|HYP|CWS)-\d{2}\b|\bN[1-9]\b|\bC[457]\b/gu) ?? [],
    ),
  );
}

export function validateNiroSourceExtract(
  extract: NiroSourceExtract,
  plan: NiroReconciliationPlan,
): readonly string[] {
  const findings: string[] = [];
  if (extract.schemaVersion !== 'niro-source-extract.v1') {
    findings.push('Source extract schemaVersion must be niro-source-extract.v1.');
  }
  if (!extract.authority.includes('Original Niro artifacts outrank')) {
    findings.push('Source extract must preserve the locked Niro source-authority rule.');
  }
  const artifactManifest = Object.fromEntries(
    extract.artifacts.map((artifact) => [normalizedProjectPath(artifact.path), artifact.sha256]),
  );
  if (stableP8Json(artifactManifest) !== stableP8Json(plan.sourceArtifactHashes)) {
    findings.push('Source extract artifact paths/hashes differ from the reconciliation preflight.');
  }
  const expectedSlugs = plan.overlays
    .map((entry) => entry.calculatorSlug)
    .sort((left, right) => left.localeCompare(right));
  const artifactSlugs = extract.artifacts
    .flatMap((artifact) => artifact.calculators)
    .sort((left, right) => left.localeCompare(right));
  if (stableP8Json(artifactSlugs) !== stableP8Json(expectedSlugs)) {
    findings.push('Source extract artifact-to-calculator coverage differs from the four drafts.');
  }
  const evidenceBySlug = new Map(
    extract.calculatorEvidence.map((evidence) => [evidence.calculatorSlug, evidence]),
  );
  if (evidenceBySlug.size !== plan.overlays.length) {
    findings.push('Source extract must contain exactly one evidence record per Niro draft.');
  }
  for (const entry of plan.overlays) {
    const evidence = evidenceBySlug.get(entry.calculatorSlug);
    if (!evidence) {
      findings.push(`Source extract is missing ${entry.calculatorSlug}.`);
      continue;
    }
    const expectedLocator =
      EXPECTED_EXTRACT_LOCATORS[entry.calculatorSlug as keyof typeof EXPECTED_EXTRACT_LOCATORS];
    if (evidence.locator !== expectedLocator) {
      findings.push(`Source extract locator drift for ${entry.calculatorSlug}.`);
    }
    if (evidence.confirmed.length === 0 || evidence.unresolved.length === 0) {
      findings.push(
        `Source extract for ${entry.calculatorSlug} must separate confirmed and unresolved evidence.`,
      );
    }
  }
  const serializedEvidence = stableP8Json(extract.calculatorEvidence).replaceAll('\\', '/');
  if (serializedEvidence.toLowerCase().includes('covid')) {
    findings.push('Source extract calculator evidence must exclude COVID.');
  }
  if (serializedEvidence.includes('/catalog/')) {
    findings.push('Source extract calculator evidence crosses the catalog quarantine.');
  }
  if (!extract.excluded.covidFixture || !extract.excluded.catalog) {
    findings.push('Source extract must explicitly record both COVID and catalog exclusions.');
  }
  return findings;
}

export function validateReconciliationPlan(plan: NiroReconciliationPlan): readonly string[] {
  const findings: string[] = [];
  if (plan.schemaVersion !== 'niro-draft-reconciliation.v1') {
    findings.push('schemaVersion must be niro-draft-reconciliation.v1.');
  }
  if (plan.engineSemanticVersion !== '1.0.0') {
    findings.push('engineSemanticVersion must equal the locked engine semantics 1.0.0.');
  }
  if (stableP8Json(plan.sourceFixtureHashes) !== stableP8Json(EXPECTED_FIXTURE_HASHES)) {
    findings.push('The five-fixture preflight manifest does not match the locked P0A hashes.');
  }
  if (stableP8Json(plan.sourceArtifactHashes) !== stableP8Json(EXPECTED_SOURCE_HASHES)) {
    findings.push('The Niro source-artifact manifest does not match the checked hashes.');
  }
  if (plan.overlays.length !== 4) findings.push('Exactly four Niro draft overlays are required.');
  const paths = plan.overlays.map((entry) => normalizedProjectPath(entry.fixturePath));
  if (new Set(paths).size !== paths.length) findings.push('Overlay fixture paths must be unique.');
  const slugs = plan.overlays.map((entry) => entry.calculatorSlug);
  if (new Set(slugs).size !== slugs.length)
    findings.push('Overlay calculator slugs must be unique.');
  for (const [index, entry] of plan.overlays.entries()) {
    const path = `overlays[${index}]`;
    const fixturePath = normalizedProjectPath(entry.fixturePath);
    if (!EXACT_OVERLAY_PATHS.has(fixturePath)) {
      findings.push(`${path}.fixturePath is not one of the four exact allowlisted fixture paths.`);
    }
    if (fixturePath.includes('covid') || entry.calculatorSlug.startsWith('covid')) {
      findings.push(`${path} must not include the COVID demonstration fixture.`);
    }
    if (fixturePath.includes('/catalog/')) findings.push(`${path} crosses the catalog quarantine.`);
    if (
      EXPECTED_FIXTURE_HASHES[fixturePath as keyof typeof EXPECTED_FIXTURE_HASHES] !==
      entry.expectedSha256
    ) {
      findings.push(`${path}.expectedSha256 differs from the locked fixture hash.`);
    }
    const overlayKeys = Object.keys(entry.metadataOverlay);
    if (overlayKeys.some((key) => !ALLOWED_METADATA_KEYS.has(key))) {
      findings.push(`${path}.metadataOverlay contains a non-metadata top-level field.`);
    }
    if (entry.metadataOverlay.status !== 'draft') findings.push(`${path} must remain draft.`);
    if (entry.metadataOverlay.engineSemanticVersion !== '1.0.0') {
      findings.push(`${path} must declare engineSemanticVersion 1.0.0.`);
    }
    if (entry.metadataOverlay.governance.clinicalStatus !== 'unreviewed') {
      findings.push(`${path} clinical governance must remain unreviewed.`);
    }
    if (entry.metadataOverlay.governance.sourceReviewStatus !== 'partial') {
      findings.push(`${path} source review must remain partial.`);
    }
    if (entry.metadataOverlay.governance.discrepancyIds.length === 0) {
      findings.push(`${path} must carry discrepancy ids.`);
    }
    if (
      new Set(entry.metadataOverlay.governance.discrepancyIds).size !==
      entry.metadataOverlay.governance.discrepancyIds.length
    ) {
      findings.push(`${path} has duplicate discrepancy ids.`);
    }
    if (entry.metadataOverlay.governance.publishBlockers.length === 0) {
      findings.push(`${path} must carry explicit publication blockers.`);
    }
    const resolvedIds = new Set(entry.resolvedByLockedContract);
    const discrepancyIds = new Set(entry.metadataOverlay.governance.discrepancyIds);
    for (const resolvedId of resolvedIds) {
      if (!discrepancyIds.has(resolvedId)) {
        findings.push(`${path}.resolvedByLockedContract contains unknown id ${resolvedId}.`);
      }
    }
    const blockerIds = discrepancyReferences(entry.metadataOverlay.governance.publishBlockers);
    for (const discrepancyId of discrepancyIds) {
      if (!resolvedIds.has(discrepancyId) && !blockerIds.has(discrepancyId)) {
        findings.push(`${path} does not disposition discrepancy ${discrepancyId}.`);
      }
    }
    const calculatorPrefix =
      entry.calculatorSlug === 'diabetes-risk'
        ? 'DIA'
        : entry.calculatorSlug === 'heart-risk'
          ? 'HRT'
          : entry.calculatorSlug === 'hypothyroid-risk'
            ? 'HYP'
            : 'CWS';
    const expectedCount =
      EXPECTED_CALCULATOR_DISCREPANCY_COUNTS[
        entry.calculatorSlug as keyof typeof EXPECTED_CALCULATOR_DISCREPANCY_COUNTS
      ];
    const calculatorIds = [...discrepancyIds].filter((id) => id.startsWith(`${calculatorPrefix}-`));
    if (calculatorIds.length !== expectedCount) {
      findings.push(
        `${path} must carry all ${expectedCount} ${calculatorPrefix} calculator discrepancies.`,
      );
    }
    const expectedSourceRef =
      EXPECTED_SOURCE_REFS[entry.calculatorSlug as keyof typeof EXPECTED_SOURCE_REFS];
    if (
      entry.metadataOverlay.sources.length !== 1 ||
      entry.metadataOverlay.sources[0]?.type !== 'niro' ||
      entry.metadataOverlay.sources[0]?.ref !== expectedSourceRef ||
      entry.metadataOverlay.sources[0]?.verification !== 'source-provided'
    ) {
      findings.push(`${path}.metadataOverlay.sources differs from the locked source locator.`);
    }
    if (entry.metadataOverlay.governance.reviews.length !== 0) {
      findings.push(`${path} cannot invent review evidence.`);
    }
    if (entry.metadataOverlay.governance.measurementRevisionIds.length !== 0) {
      findings.push(`${path} cannot invent measurement revision ids.`);
    }
    if (entry.publicationEligibility.eligible !== false) {
      findings.push(`${path} cannot be marked publication eligible.`);
    }
    const clinicalFields = forbiddenKeys(entry.metadataOverlay);
    if (clinicalFields.length > 0) {
      findings.push(`${path} contains forbidden clinical fields: ${clinicalFields.join(', ')}.`);
    }
  }
  return findings;
}

export function preflightNiroSources(
  root = RECONCILIATION_ROOT,
  plan = readReconciliationPlan(),
): void {
  const planFindings = validateReconciliationPlan(plan);
  if (planFindings.length > 0) {
    throw new Error(`Invalid P8 reconciliation plan: ${planFindings.join(' ')}`);
  }
  const sourceExtractFindings = validateNiroSourceExtract(readNiroSourceExtract(), plan);
  if (sourceExtractFindings.length > 0) {
    throw new Error(`Invalid P8 source extract: ${sourceExtractFindings.join(' ')}`);
  }
  for (const [projectPath, expectedHash] of Object.entries(plan.sourceFixtureHashes)) {
    const absolute = assertPathWithinRoot(root, projectPath);
    const actualHash = sha256File(absolute);
    if (actualHash !== expectedHash) {
      throw new Error(`Refusing reconciliation: fixture hash drift at ${projectPath}.`);
    }
  }
  for (const [projectPath, expectedHash] of Object.entries(plan.sourceArtifactHashes)) {
    const absolute = assertPathWithinRoot(root, projectPath);
    const actualHash = sha256File(absolute);
    if (actualHash !== expectedHash) {
      throw new Error(`Refusing reconciliation: source-artifact hash drift at ${projectPath}.`);
    }
  }
}

function mergeSources(current: unknown, overlay: readonly SourceRef[]): readonly SourceRef[] {
  const sources = [...(Array.isArray(current) ? (current as SourceRef[]) : []), ...overlay];
  const unique = new Map<string, SourceRef>();
  for (const source of sources) unique.set(stableP8Json(source), source);
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, source]) => source);
}

export function applyMetadataOverlay(
  sourcePayload: JsonObject,
  overlay: MetadataOverlay,
): JsonObject {
  const clinicalFields = forbiddenKeys(overlay);
  if (clinicalFields.length > 0) {
    throw new Error(
      `Metadata overlay contains forbidden clinical fields: ${clinicalFields.join(', ')}.`,
    );
  }
  const next = structuredClone(sourcePayload);
  next.status = 'draft';
  next.engineSemanticVersion = overlay.engineSemanticVersion;
  next.sources = mergeSources(next.sources, overlay.sources);
  next.governance = structuredClone(overlay.governance);
  return next;
}

export function reconcileNiroDrafts(
  root = RECONCILIATION_ROOT,
  plan = readReconciliationPlan(),
): readonly ReconciledNiroDraft[] {
  preflightNiroSources(root, plan);
  return plan.overlays.map((entry) => {
    const absolute = assertPathWithinRoot(root, entry.fixturePath);
    const fixtureText = readFileSync(absolute, 'utf8');
    const sourcePayload = JSON.parse(fixtureText) as JsonObject;
    if (sourcePayload.calculatorSlug !== entry.calculatorSlug) {
      throw new Error(`Fixture slug drift at ${entry.fixturePath}.`);
    }
    const payload = applyMetadataOverlay(sourcePayload, entry.metadataOverlay);
    const secondPass = applyMetadataOverlay(payload, entry.metadataOverlay);
    if (stableP8Json(payload) !== stableP8Json(secondPass)) {
      throw new Error(`Overlay is not idempotent for ${entry.calculatorSlug}.`);
    }
    return {
      calculatorSlug: entry.calculatorSlug,
      fixturePath: entry.fixturePath,
      fixtureSha256: sha256Text(fixtureText),
      payloadSha256: sha256Text(stableP8Json(payload)),
      publishEligible: false,
      blockers: entry.metadataOverlay.governance.publishBlockers.length,
      payload,
    };
  });
}

export function validateReconciliationArguments(args: readonly string[]): void {
  const unsupported = args.filter((argument) => argument !== '--emit-payloads');
  if (unsupported.length > 0) {
    const migration = unsupported.includes('--import-admin-api')
      ? 'The legacy reconciliation importer is disabled. Use npm run p8:drafts:import-live with its explicit non-production guards.'
      : `Unsupported reconciliation argument: ${unsupported[0] ?? '<empty>'}.`;
    throw new Error(migration);
  }
  if (args.filter((argument) => argument === '--emit-payloads').length > 1) {
    throw new Error('--emit-payloads may be supplied only once.');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  validateReconciliationArguments(args);
  const plan = readReconciliationPlan();
  const drafts = reconcileNiroDrafts(RECONCILIATION_ROOT, plan);
  const summary = drafts.map((draft) => ({
    calculatorSlug: draft.calculatorSlug,
    fixturePath: draft.fixturePath,
    fixtureSha256: draft.fixtureSha256,
    payloadSha256: draft.payloadSha256,
    publishEligible: draft.publishEligible,
    blockers: draft.blockers,
  }));
  if (args.includes('--emit-payloads')) {
    console.log(JSON.stringify({ mode: 'dry-run', drafts }, null, 2));
    return;
  }
  console.log(
    JSON.stringify(
      {
        mode: 'dry-run',
        status: 'ok',
        fixturesPreflighted: Object.keys(plan.sourceFixtureHashes).length,
        sourceArtifactsPreflighted: Object.keys(plan.sourceArtifactHashes).length,
        drafts: summary,
        note: 'No files or databases were written. The only live path is scripts/import-niro-drafts-live.ts, which is draft-only and fail-closed.',
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
