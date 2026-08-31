import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { validateCalculatorVersion, validateMeasurementDefinitionStructure } from '@niro/contracts';
import { ENGINE_SEMANTIC_VERSION } from '@niro/engine';
import type { Db } from 'mongodb';
import { connection } from 'mongoose';

import { createApp } from '../apps/server/src/app';
import { createAuthService, hashPassword } from '../apps/server/src/auth/service';
import {
  loadEnvironment,
  loadProjectEnvironment,
  type AppEnvironment,
} from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { AdminGovernanceLockModel } from '../apps/server/src/persistence/models/admin-governance-lock';
import { AdminSessionModel } from '../apps/server/src/persistence/models/admin-session';
import { AdminUserModel, type AdminRole } from '../apps/server/src/persistence/models/admin-user';
import { AuditLogModel } from '../apps/server/src/persistence/models/audit-log';
import { CacheInvalidationEventModel } from '../apps/server/src/persistence/models/cache-invalidation-event';
import { CalculatorModel } from '../apps/server/src/persistence/models/calculator';
import { CalculatorVersionModel } from '../apps/server/src/persistence/models/calculator-version';
import { LoginAttemptModel } from '../apps/server/src/persistence/models/login-attempt';
import { MeasurementRevisionModel } from '../apps/server/src/persistence/models/measurement-revision';
import { authorizeTemporaryDatabaseWrite } from './integration-write-authorization';

type JsonRecord = Record<string, unknown>;

const nativeFetch: typeof globalThis.fetch = globalThis.fetch;

/**
 * This long-running Atlas integration deliberately opens one HTTP connection
 * per request. Reusing an idle local socket can surface as UND_ERR_SOCKET after
 * a slow database operation; retrying the following non-idempotent POST would
 * be unsafe because its commit state may be unknown.
 */
const fetch: typeof globalThis.fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('connection', 'close');
  return nativeFetch(input, { ...init, headers });
};

interface FixtureUser {
  readonly email: string;
  readonly password: string;
  readonly role: AdminRole;
}

const P4_DATABASE_NONCE_PATTERN = /^[a-f0-9]{30}$/u;
const P4_FIXTURE_ID = 'p4-admin-api-integration-v1';
const P4_MANIFEST_COLLECTION = 'p4_integration_manifests';
const issuedP4Authorizations = new WeakSet<object>();

const P4_ALLOWED_COLLECTIONS = new Set([
  'admin_governance_locks',
  'admin_sessions',
  'admin_users',
  'analytics_attribution_claims',
  'analytics_daily',
  'analytics_events',
  'analytics_materialization_locks',
  'anonymous_visitors',
  'assessments',
  'audit_logs',
  'biomarkers',
  'cache_invalidation_events',
  'calculator_versions',
  'calculators',
  'job_runs',
  'leads',
  'login_attempts',
  P4_MANIFEST_COLLECTION,
  'results',
]);

type P4WriteEnvironment = Pick<AppEnvironment, 'mongoDbName' | 'nodeEnv'>;

export interface P4TemporaryDatabaseWriteAuthorization {
  readonly nonce: string;
  readonly databaseName: string;
}

export interface P4DatabaseFootprint {
  readonly collectionCounts: Readonly<Record<string, number>>;
  readonly manifests: readonly JsonRecord[];
}

export interface P4InitializableModel {
  init(): Promise<unknown>;
}

export function p4TemporaryDatabaseName(nonce: string): string {
  if (!P4_DATABASE_NONCE_PATTERN.test(nonce)) {
    throw new Error('P4 temporary database nonce must be exactly 30 lowercase hex characters.');
  }
  return `niro_p4_${nonce}`;
}

export function authorizeP4IntegrationWrites(
  environment: P4WriteEnvironment,
  nonce: string,
  args: readonly string[],
): P4TemporaryDatabaseWriteAuthorization {
  authorizeTemporaryDatabaseWrite(environment, args, 'P4 admin API integration');
  const expectedDatabaseName = p4TemporaryDatabaseName(nonce);
  if (environment.mongoDbName !== expectedDatabaseName) {
    throw new Error(
      `P4 admin API integration requires the exact owned database ${expectedDatabaseName}.`,
    );
  }
  const authorization = Object.freeze({ nonce, databaseName: environment.mongoDbName });
  issuedP4Authorizations.add(authorization);
  return authorization;
}

function expectedP4Manifest(nonce: string): JsonRecord {
  return {
    fixtureId: P4_FIXTURE_ID,
    nonce,
    databaseName: p4TemporaryDatabaseName(nonce),
  };
}

export function p4CleanupOwnershipIssue(
  nonce: string,
  footprint: P4DatabaseFootprint,
): string | undefined {
  for (const [name, count] of Object.entries(footprint.collectionCounts)) {
    if (!P4_ALLOWED_COLLECTIONS.has(name)) return `Unexpected P4 database collection ${name}.`;
    if (!Number.isSafeInteger(count) || count < 0) {
      return `Invalid P4 collection cardinality for ${name}.`;
    }
    const expectedCount = name === P4_MANIFEST_COLLECTION ? 1 : 0;
    if (count !== expectedCount) {
      return `${name} has cardinality ${count}; guarded cleanup requires ${expectedCount}.`;
    }
  }
  if (footprint.collectionCounts[P4_MANIFEST_COLLECTION] !== 1) {
    return 'The P4 ownership manifest collection is missing.';
  }
  if (footprint.manifests.length !== 1) return 'Exactly one P4 ownership manifest is required.';
  const expected = expectedP4Manifest(nonce);
  const manifest = footprint.manifests[0];
  const expectedKeys = Object.keys(expected).sort();
  if (
    !manifest ||
    JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(expectedKeys) ||
    expectedKeys.some((key) => manifest[key] !== expected[key])
  ) {
    return 'The P4 ownership manifest does not match the authorized nonce and database.';
  }
  return undefined;
}

export async function settleP4ModelInitialization(
  models: readonly P4InitializableModel[] = Object.values(connection.models),
): Promise<void> {
  await Promise.all(models.map(async (model) => await model.init()));
}

export async function dropAndVerifyP4Database(
  database: Db,
  expectedName: string,
  options: { readonly attempts?: number; readonly delayMs?: number } = {},
): Promise<void> {
  if (database.databaseName !== expectedName) {
    throw new Error('Refusing to drop a database outside the authorized P4 namespace.');
  }
  await database.dropDatabase();
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 250;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const listed = await database.admin().listDatabases({ nameOnly: true });
    if (!listed.databases.some(({ name }) => name === expectedName)) return;
    if (delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
  throw new Error(`Guarded cleanup did not remove the temporary database ${expectedName}.`);
}

export function mergeP4OperationAndCleanupFailures(
  operationFailure: unknown,
  cleanupFailures: readonly unknown[],
): unknown {
  if (cleanupFailures.length === 0) return operationFailure;
  return operationFailure === undefined
    ? new AggregateError(cleanupFailures, 'P4 admin API integration cleanup failed.')
    : new AggregateError(
        [operationFailure, ...cleanupFailures],
        'P4 admin API integration failed and cleanup was incomplete.',
      );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertP4Authorization(
  database: Db,
  authorization: P4TemporaryDatabaseWriteAuthorization,
): void {
  if (
    !issuedP4Authorizations.has(authorization) ||
    database.databaseName !== authorization.databaseName ||
    authorization.databaseName !== p4TemporaryDatabaseName(authorization.nonce)
  ) {
    throw new Error('A valid nonce-bound P4 temporary-database authorization is required.');
  }
}

async function readP4CollectionCounts(database: Db): Promise<Record<string, number>> {
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const counts: Record<string, number> = {};
  for (const collection of collections) {
    counts[collection.name] = await database.collection(collection.name).countDocuments({});
  }
  return counts;
}

async function assertP4DatabaseInitiallyEmpty(database: Db): Promise<void> {
  const counts = await readP4CollectionCounts(database);
  for (const [name, count] of Object.entries(counts)) {
    if (!P4_ALLOWED_COLLECTIONS.has(name)) {
      throw new Error(`Refusing an unexpected collection in the P4 temporary database: ${name}.`);
    }
    if (count !== 0) {
      throw new Error(`P4 temporary database was not empty (${name} has ${count} records).`);
    }
  }
}

async function readP4DatabaseFootprint(database: Db): Promise<P4DatabaseFootprint> {
  const collectionCounts = await readP4CollectionCounts(database);
  const manifests = Object.hasOwn(collectionCounts, P4_MANIFEST_COLLECTION)
    ? ((await database
        .collection(P4_MANIFEST_COLLECTION)
        .find({}, { projection: { _id: 0 } })
        .toArray()) as JsonRecord[])
    : [];
  return { collectionCounts, manifests };
}

function safeErrorMessages(error: unknown): readonly string[] {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.flatMap(safeErrorMessages)];
  }
  return [error instanceof Error ? error.message : String(error)];
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function authorization(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

function setCookieHeaders(response: Response): readonly string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values && values.length > 0) return values;
  const combined = response.headers.get('set-cookie');
  return combined ? combined.split(/,(?=\s*niro_[a-z]+=)/i).map((value) => value.trim()) : [];
}

function cookieHeader(setCookies: readonly string[]): string {
  return setCookies
    .map((value) => value.split(';', 1)[0])
    .filter((value): value is string => Boolean(value))
    .join('; ');
}

function cookieValue(setCookies: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const pair = setCookies
    .map((value) => value.split(';', 1)[0]?.trim())
    .find((value) => value?.startsWith(prefix));
  return pair?.slice(prefix.length);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
  );
}

async function responseJson(response: Response): Promise<JsonRecord> {
  const body = (await response.json()) as unknown;
  assert(isRecord(body), `Expected an object response body (${response.status}).`);
  return body;
}

function responseData(body: JsonRecord): JsonRecord {
  assert(isRecord(body.data), 'Response data is missing.');
  return body.data;
}

function responseErrorCode(body: JsonRecord): string | undefined {
  return isRecord(body.error) && typeof body.error.code === 'string' ? body.error.code : undefined;
}

export function createPublishEligiblePayload(slug: string): JsonRecord {
  const timestamp = new Date().toISOString();
  return {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: slug,
    name: 'P4 nonclinical integration fixture',
    version: 1,
    status: 'approved',
    engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
    shortDescription: 'Temporary nonclinical fixture for the P4 admin API integration check.',
    disclaimers: ['Automated integration fixture only; it is not medical guidance.'],
    parameters: [
      {
        key: 'value',
        label: 'Fixture value',
        group: 'general',
        inputType: 'number',
        validation: { required: true, min: 0, max: 100 },
        missingPolicy: 'block',
        order: 1,
      },
    ],
    scoringRules: [
      {
        parameterKey: 'value',
        bandEdges: 'min-inclusive',
        contexts: [
          {
            when: null,
            bands: [
              { min: null, max: 10, points: 1 },
              { min: 10, max: null, points: 2 },
            ],
          },
        ],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    domains: [
      {
        key: 'overall',
        label: 'Overall',
        weight: 1,
        parameterKeys: ['value'],
      },
    ],
    resultCategories: {
      scale: { min: 0, max: 2, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        { label: 'low', min: null, max: 2, color: '#00AA00' },
        { label: 'high', min: 2, max: null, color: '#AA0000' },
      ],
    },
    uiConfig: {
      theme: { accent: '#0055AA' },
      steps: [{ key: 'fixture', title: 'Fixture input', parameterGroups: ['general'] }],
      result: { layout: ['score-gauge', 'category'] },
    },
    content: {
      schemaVersion: 'content-page.v1',
      contentId: slug,
      version: 1,
      locale: 'en-IN',
      slug,
      title: 'P4 nonclinical integration fixture',
      summary: 'Temporary nonclinical content used only to verify the P4 admin workflow.',
      blocks: [
        {
          id: 'fixture-notice',
          type: 'markdown',
          markdown: 'This temporary page exists only during an automated integration check.',
        },
      ],
      claims: [],
      citations: [],
      authorship: {
        contributors: [
          { id: 'p4-integration', displayName: 'P4 integration runner', role: 'author' },
        ],
        ownerId: 'p4-integration',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      medicalReview: {
        status: 'not-applicable',
        scope: 'not-applicable',
        reviewerId: null,
        reviewedAt: null,
        nextReviewAt: null,
        decisionNote: 'Nonclinical automated integration fixture.',
      },
      seo: {
        metaTitle: 'P4 Nonclinical Integration Fixture Check',
        metaDescription:
          'Temporary nonclinical content used only to verify the P4 administrative workflow and persistence integration.',
        canonicalPath: `/c/${slug}`,
        robots: { index: false, follow: false },
        schemaTypes: ['WebPage'],
      },
      publication: {
        status: 'approved',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Created for an automated P4 integration check.',
      },
    },
    sources: [
      {
        type: 'internal',
        ref: 'scripts/admin-api-integration.ts',
        title: 'P4 automated integration fixture',
        verification: 'source-provided',
        demoPoints: true,
      },
    ],
    governance: {
      clinicalStatus: 'not-applicable',
      sourceReviewStatus: 'not-applicable',
      discrepancyIds: [],
      publishBlockers: [],
    },
    testCases: [
      {
        key: 'fixture-low',
        name: 'Low fixture value',
        kind: 'nonclinical-fixture',
        inputs: { value: 5 },
        expected: { finalScore: 1 },
      },
    ],
  };
}

function createDraftMeasurementDefinition(
  key: string,
  displayName: string,
  sources: readonly JsonRecord[],
): JsonRecord {
  return {
    schemaVersion: 'measurement-definition.v1',
    key,
    version: 1,
    status: 'draft',
    displayName,
    kind: 'laboratory-biomarker',
    valueType: 'number',
    canonicalUnit: { code: 'ratio', dimension: 'dimensionless', display: 'ratio' },
    acceptedUnits: [{ code: 'ratio', dimension: 'dimensionless', display: 'ratio' }],
    conversions: [],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: [],
    description: {
      whatItMeasures: 'Temporary nonclinical integration marker.',
      limitations: 'This fixture exists only for automated integration verification.',
    },
    sources,
    governance: {
      reviewStatus: 'unreviewed',
      reviewedAt: null,
      reviewerId: null,
      publishBlockers: [],
    },
  };
}

export async function runAdminApiIntegration(
  args: readonly string[] = process.argv.slice(2),
): Promise<void> {
  loadProjectEnvironment();
  const configuredEnvironment = loadEnvironment();
  if (!configuredEnvironment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  if (!configuredEnvironment.authAccessSecret || !configuredEnvironment.authRefreshSecret) {
    throw new Error('AUTH_ACCESS_SECRET and AUTH_REFRESH_SECRET must be configured.');
  }

  const databaseNonce = randomBytes(15).toString('hex');
  const integrationDatabase = p4TemporaryDatabaseName(databaseNonce);
  const environment = { ...configuredEnvironment, mongoDbName: integrationDatabase };
  const writeAuthorization = authorizeP4IntegrationWrites(environment, databaseNonce, args);
  const databaseClient = await connectDatabase({ environment });
  const connectedDatabase = databaseClient.connection.db;
  assert(connectedDatabase, 'P4 integration database connection is unavailable.');
  assertP4Authorization(connectedDatabase, writeAuthorization);

  const suffix = randomUUID().replaceAll('-', '');
  const namespace = `p4-live-${suffix}`;
  const slug = namespace;
  const csrfRejectedSlug = `${namespace}-csrf-rejected`;
  const measurementBoundSlug = `${namespace}-measurement-bound`;
  const biomarkerKey = `${namespace}-marker`;
  const commonPassword = `P4-${randomUUID()}-pass`;
  const managedUserEmail = `${namespace}-managed@example.invalid`;
  const users: readonly FixtureUser[] = [
    { email: `${namespace}-admin@example.invalid`, password: commonPassword, role: 'admin' },
    { email: `${namespace}-editor@example.invalid`, password: commonPassword, role: 'editor' },
    {
      email: `${namespace}-reviewer@example.invalid`,
      password: commonPassword,
      role: 'medical-reviewer',
    },
    { email: `${namespace}-lockout@example.invalid`, password: commonPassword, role: 'editor' },
  ];
  const fixtureEmails = [...users.map((user) => user.email), managedUserEmail];
  const createdEntityIds = new Set<string>();
  const authService = createAuthService({
    accessSecret: environment.authAccessSecret!,
    refreshSecret: environment.authRefreshSecret!,
    lockoutThreshold: 3,
    lockoutSeconds: 60,
  });
  const fixtureAccountHashes = fixtureEmails.map((email) =>
    authService.securityEvidence('account', email),
  );
  let server: Server | undefined;
  let failure: unknown;

  try {
    await settleP4ModelInitialization(Object.values(databaseClient.connection.models));
    await assertP4DatabaseInitiallyEmpty(connectedDatabase);
    await connectedDatabase
      .collection(P4_MANIFEST_COLLECTION)
      .insertOne(expectedP4Manifest(databaseNonce));

    const passwordHash = await hashPassword(commonPassword, 4);
    const createdUsers = await AdminUserModel.insertMany(
      users.map((user) => ({
        email: user.email,
        passwordHash,
        role: user.role,
        status: 'active',
        failedLoginCount: 0,
      })),
    );
    createdUsers.forEach((user) => createdEntityIds.add(user._id.toString()));

    const invalidatedSlugs: string[] = [];
    const app = createApp(
      environment,
      { databaseReady: () => true },
      {
        authService,
        adminRouter: {
          onPublish: (calculatorSlug) => {
            invalidatedSlugs.push(calculatorSlug);
          },
        },
      },
    );
    server = app.listen(0);
    const address = server.address();
    assert(address && typeof address !== 'string', 'Integration server address unavailable.');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthenticated = await fetch(`${baseUrl}/api/v1/admin/calculators`);
    assert(unauthenticated.status === 401, `Expected admin 401; got ${unauthenticated.status}.`);
    assert(
      responseErrorCode(await responseJson(unauthenticated)) === 'UNAUTHENTICATED',
      'Unauthenticated response code mismatch.',
    );

    const lockedUser = users[3];
    assert(lockedUser, 'Lockout fixture user is missing.');
    for (const expectedStatus of [401, 401, 423]) {
      const failedLogin = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: lockedUser.email, password: `${commonPassword}-wrong` }),
      });
      assert(
        failedLogin.status === expectedStatus,
        `Lockout status mismatch: expected ${expectedStatus}, got ${failedLogin.status}.`,
      );
    }
    const stillLocked = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: lockedUser.email, password: lockedUser.password }),
    });
    assert(stillLocked.status === 423, `Locked user authenticated (${stillLocked.status}).`);
    const lockedRecord = await AdminUserModel.findOne({ email: lockedUser.email }).lean();
    assert(lockedRecord?.lockedUntil, 'Account lockout was not persisted.');

    const adminUser = users[0];
    const editorUser = users[1];
    const reviewerUser = users[2];
    assert(adminUser && editorUser && reviewerUser, 'Admin fixtures are incomplete.');

    const browserLogin = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: adminUser.password }),
    });
    assert(browserLogin.status === 200, `Admin HTTP login failed (${browserLogin.status}).`);
    const loginCookies = setCookieHeaders(browserLogin);
    const accessCookie = loginCookies.find((value) => value.startsWith('niro_access='));
    const refreshCookie = loginCookies.find((value) => value.startsWith('niro_refresh='));
    const csrfCookie = loginCookies.find((value) => value.startsWith('niro_csrf='));
    assert(
      accessCookie?.includes('HttpOnly') && refreshCookie?.includes('HttpOnly'),
      'Admin login did not issue protected auth cookies.',
    );
    assert(
      csrfCookie &&
        !csrfCookie.includes('HttpOnly') &&
        csrfCookie.includes('SameSite=Strict') &&
        csrfCookie.includes('Path=/'),
      'Admin login did not issue the expected UI-readable CSRF cookie.',
    );
    const csrfToken = cookieValue(loginCookies, 'niro_csrf');
    assert(csrfToken, 'CSRF cookie value is missing.');
    const cookieWriteWithoutCsrf = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader(loginCookies),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug: csrfRejectedSlug,
        name: 'Rejected CSRF fixture',
        payload: createPublishEligiblePayload(csrfRejectedSlug),
      }),
    });
    assert(
      cookieWriteWithoutCsrf.status === 403,
      `Cookie-authenticated write without CSRF returned ${cookieWriteWithoutCsrf.status}.`,
    );
    assert(
      responseErrorCode(await responseJson(cookieWriteWithoutCsrf)) === 'CSRF_FAILED',
      'Cookie-authenticated write without CSRF did not return CSRF_FAILED.',
    );
    assert(
      !(await CalculatorModel.exists({ slug: csrfRejectedSlug })),
      'CSRF-rejected write unexpectedly reached persistence.',
    );

    const adminTokens = await authService.login(adminUser.email, adminUser.password);
    const editorTokens = await authService.login(editorUser.email, editorUser.password);
    const reviewerTokens = await authService.login(reviewerUser.email, reviewerUser.password);

    const forbidden = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: authorization(editorTokens.accessToken),
    });
    assert(forbidden.status === 403, `Expected editor 403; got ${forbidden.status}.`);
    assert(
      responseErrorCode(await responseJson(forbidden)) === 'FORBIDDEN',
      'Forbidden response code mismatch.',
    );

    const userList = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: authorization(adminTokens.accessToken),
    });
    assert(userList.status === 200, `Admin user list failed (${userList.status}).`);
    const userListText = JSON.stringify(await responseJson(userList));
    assert(!userListText.includes('passwordHash'), 'Admin user list exposed a password hash.');

    const rejectSelfDisable = await fetch(`${baseUrl}/api/v1/admin/users/${adminTokens.user.id}`, {
      method: 'PATCH',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    assert(rejectSelfDisable.status === 409, 'Self-disable was not rejected with 409.');
    assert(
      responseErrorCode(await responseJson(rejectSelfDisable)) === 'SELF_DISABLE',
      'Self-disable did not return SELF_DISABLE.',
    );

    const rejectLastAdmin = await fetch(`${baseUrl}/api/v1/admin/users/${adminTokens.user.id}`, {
      method: 'PATCH',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'editor' }),
    });
    assert(rejectLastAdmin.status === 409, 'Last-admin demotion was not rejected with 409.');
    assert(
      responseErrorCode(await responseJson(rejectLastAdmin)) === 'LAST_ADMIN',
      'Last-admin demotion did not return LAST_ADMIN.',
    );

    const createManagedUser = await fetch(`${baseUrl}/api/v1/admin/users`, {
      method: 'POST',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: managedUserEmail,
        password: commonPassword,
        role: 'editor',
      }),
    });
    assert(createManagedUser.status === 201, 'Admin user creation failed.');
    const managedUser = responseData(await responseJson(createManagedUser));
    assert(typeof managedUser.id === 'string', 'Managed admin user id is missing.');
    assert(!JSON.stringify(managedUser).includes('passwordHash'), 'User creation exposed a hash.');
    createdEntityIds.add(managedUser.id);
    const managedTokens = await authService.login(managedUserEmail, commonPassword);
    const disableManagedUser = await fetch(`${baseUrl}/api/v1/admin/users/${managedUser.id}`, {
      method: 'PATCH',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    assert(disableManagedUser.status === 200, 'Managed user disable failed.');
    const revokedManagedAccess = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      headers: authorization(managedTokens.accessToken),
    });
    assert(
      revokedManagedAccess.status === 401,
      `Disabled user's existing session returned ${revokedManagedAccess.status}.`,
    );

    const payload = createPublishEligiblePayload(slug);
    const localValidation = validateCalculatorVersion(payload);
    assert(
      localValidation.publishEligible,
      `Integration fixture is not publish eligible (${localValidation.errorCount} errors).`,
    );

    const createCalculator = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      method: 'POST',
      headers: {
        ...authorization(editorTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug,
        name: 'P4 nonclinical integration fixture',
        payload,
      }),
    });
    assert(
      createCalculator.status === 201,
      `Calculator creation failed (${createCalculator.status}).`,
    );
    const createBody = await responseJson(createCalculator);
    const createData = responseData(createBody);
    assert(isRecord(createData.calculator), 'Calculator creation response is missing identity.');
    assert(isRecord(createData.version), 'Calculator creation response is missing version.');
    const calculatorId = createData.calculator.id;
    const firstVersionId = createData.version.id;
    assert(typeof calculatorId === 'string', 'Created calculator id is missing.');
    assert(typeof firstVersionId === 'string', 'Created calculator version id is missing.');
    createdEntityIds.add(calculatorId);
    createdEntityIds.add(firstVersionId);
    const initialEtag = createCalculator.headers.get('etag');
    assert(initialEtag, 'Created calculator version did not return an ETag.');
    const cachedDraftMiss = await fetch(`${baseUrl}/api/v1/calculators/${slug}`);
    assert(
      cachedDraftMiss.status === 404,
      `Draft calculator was unexpectedly public (${cachedDraftMiss.status}).`,
    );

    const staleUpdate = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/versions/1`, {
      method: 'PATCH',
      headers: {
        ...authorization(editorTokens.accessToken),
        'content-type': 'application/json',
        'if-match': '"stale-p4-etag"',
      },
      body: JSON.stringify({ payload }),
    });
    assert(staleUpdate.status === 409, `Stale draft update returned ${staleUpdate.status}.`);
    assert(
      responseErrorCode(await responseJson(staleUpdate)) === 'VERSION_CONFLICT',
      'Stale draft update did not return VERSION_CONFLICT.',
    );

    const preview = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/preview`, {
      method: 'POST',
      headers: {
        ...authorization(editorTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ inputs: { value: 5 } }),
    });
    assert(preview.status === 200, `Calculator preview failed (${preview.status}).`);
    const previewData = responseData(await responseJson(preview));
    assert(isRecord(previewData.result), 'Preview result is missing.');
    assert(
      Array.isArray(previewData.result.trace),
      'Admin preview did not include an engine trace.',
    );
    assert(previewData.result.score === 1, 'Admin preview returned the wrong deterministic score.');

    const saveTests = await fetch(
      `${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/test-cases`,
      {
        method: 'PUT',
        headers: {
          ...authorization(editorTokens.accessToken),
          'content-type': 'application/json',
          'if-match': initialEtag,
        },
        body: JSON.stringify({
          testCases: [
            ...(Array.isArray(payload.testCases) ? payload.testCases : []),
            {
              key: 'fixture-high-boundary',
              name: 'High fixture boundary',
              kind: 'boundary',
              inputs: { value: 10 },
              expected: { finalScore: 2, category: 'high' },
            },
          ],
        }),
      },
    );
    assert(saveTests.status === 200, `Saving test cases failed (${saveTests.status}).`);
    const draftEtag = saveTests.headers.get('etag');
    assert(draftEtag, 'Saving test cases did not return a new ETag.');
    assert(draftEtag !== initialEtag, 'Draft write did not advance its ETag.');

    const runTests = await fetch(
      `${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/test-cases/run`,
      {
        method: 'POST',
        headers: authorization(editorTokens.accessToken),
      },
    );
    assert(runTests.status === 200, `Running test cases failed (${runTests.status}).`);
    const testRunData = responseData(await responseJson(runTests));
    assert(testRunData.passed === true, 'Saved calculator test case did not pass.');
    assert(
      Array.isArray(testRunData.cases) && testRunData.cases.length === 2,
      'Test run count mismatch.',
    );

    const submitReview = await fetch(
      `${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/submit-review`,
      {
        method: 'POST',
        headers: { ...authorization(editorTokens.accessToken), 'if-match': draftEtag },
      },
    );
    assert(submitReview.status === 200, `Review submission failed (${submitReview.status}).`);
    const reviewEtag = submitReview.headers.get('etag');
    assert(reviewEtag, 'Review submission did not return a new ETag.');
    assert(reviewEtag !== draftEtag, 'Review submission did not advance its ETag.');
    assert(
      responseData(await responseJson(submitReview)).status === 'in-review',
      'Version did not enter in-review state.',
    );

    const approve = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/approve`, {
      method: 'POST',
      headers: { ...authorization(reviewerTokens.accessToken), 'if-match': reviewEtag },
    });
    assert(approve.status === 200, `Medical approval failed (${approve.status}).`);
    const approvedEtag = approve.headers.get('etag');
    assert(approvedEtag, 'Medical approval did not return a new ETag.');
    assert(approvedEtag !== reviewEtag, 'Medical approval did not advance its ETag.');
    assert(
      responseData(await responseJson(approve)).status === 'approved',
      'Version did not enter approved state.',
    );

    const publish = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/versions/1/publish`, {
      method: 'POST',
      headers: { ...authorization(reviewerTokens.accessToken), 'if-match': approvedEtag },
    });
    assert(publish.status === 200, `Transactional publication failed (${publish.status}).`);
    const publishedEtag = publish.headers.get('etag');
    assert(publishedEtag, 'Publication did not return a terminal ETag.');
    assert(publishedEtag !== approvedEtag, 'Publication did not advance its ETag.');
    assert(
      responseData(await responseJson(publish)).status === 'published',
      'Version did not enter published state.',
    );
    assert(
      invalidatedSlugs.filter((item) => item === slug).length === 1,
      'Publish cache invalidation callback was not invoked exactly once.',
    );
    const publicAfterPublish = await fetch(`${baseUrl}/api/v1/calculators/${slug}`);
    assert(
      publicAfterPublish.status === 200,
      `Published calculator remained hidden by the primed public cache (${publicAfterPublish.status}).`,
    );
    const publicAfterPublishText = JSON.stringify(await responseJson(publicAfterPublish));
    for (const protectedField of ['formulas', 'scoringRules', 'trace', 'reviewHash'])
      assert(
        !publicAfterPublishText.includes(`"${protectedField}"`),
        `Published public projection exposed ${protectedField}.`,
      );

    const persistedCalculator = await CalculatorModel.findOne({ slug }).lean();
    const persistedVersion = await CalculatorVersionModel.findOne({
      calculatorSlug: slug,
      version: 1,
    }).lean();
    assert(persistedCalculator && persistedVersion, 'Published calculator data is missing.');
    assert(
      persistedVersion.status === 'published',
      'Published version transaction was not durable.',
    );
    assert(
      persistedCalculator.currentVersionId?.toString() === persistedVersion._id.toString(),
      'Published calculator pointer and version transaction are inconsistent.',
    );
    assert(persistedVersion.immutableAt, 'Published version was not marked immutable.');
    assert(
      persistedVersion.lastEditedBy?.toString() === editorTokens.user.id,
      'Published version did not retain the trusted last-editor identity.',
    );
    assert(
      persistedVersion.approvedBy?.toString() === reviewerTokens.user.id &&
        Boolean(persistedVersion.approvedAt) &&
        persistedVersion.reviewEvidence?.reviewerId.toString() === reviewerTokens.user.id &&
        persistedVersion.reviewEvidence?.protectedHash === persistedVersion.reviewHash &&
        persistedVersion.reviewEvidence?.reviewedAt.toISOString() ===
          persistedVersion.approvedAt?.toISOString(),
      'Published version is missing independent, server-owned review evidence.',
    );
    const publishAudit = await AuditLogModel.findOne({
      action: 'calculator.version.publish',
      entityId: persistedVersion._id.toString(),
    }).lean();
    assert(publishAudit, 'Publish audit was not committed with the publication transaction.');
    const firstPublishEvent = await CacheInvalidationEventModel.findOne({
      calculatorSlug: slug,
      calculatorVersionId: persistedVersion._id,
      reason: 'publish',
    }).lean();
    assert(firstPublishEvent, 'Publish cache invalidation event was not durably committed.');
    assert(firstPublishEvent.status === 'pending', 'New cache invalidation event is not pending.');
    assert(
      firstPublishEvent.paths.includes(`/calculators/${slug}`) &&
        firstPublishEvent.paths.includes('/sitemap.xml'),
      'Publish cache invalidation event is missing required paths.',
    );

    const immutableSourceSnapshot = {
      payload: JSON.stringify(persistedVersion.payload),
      sourceHash: persistedVersion.sourceHash,
      logicHash: persistedVersion.logicHash,
      contentHash: persistedVersion.contentHash,
      reviewHash: persistedVersion.reviewHash,
      versionHash: persistedVersion.versionHash,
      immutableAt: persistedVersion.immutableAt?.toISOString(),
    };

    let queryMutationRejected = false;
    try {
      await CalculatorVersionModel.updateOne(
        { _id: persistedVersion._id },
        { $set: { 'payload.name': 'Forbidden query mutation' } },
      );
    } catch {
      queryMutationRejected = true;
    }
    assert(queryMutationRejected, 'Query-path mutation of a published version was accepted.');
    const sourceAfterRejectedMutation = await CalculatorVersionModel.findById(
      persistedVersion._id,
    ).lean();
    assert(
      JSON.stringify(sourceAfterRejectedMutation?.payload) === immutableSourceSnapshot.payload,
      'Rejected query-path mutation changed protected published data.',
    );

    const immediateRollback = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/rollback`, {
      method: 'POST',
      headers: {
        ...authorization(reviewerTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sourceVersion: 1, publish: true }),
    });
    assert(
      immediateRollback.status === 201,
      `Immediate transactional rollback failed (${immediateRollback.status}).`,
    );
    const immediateRollbackData = responseData(await responseJson(immediateRollback));
    assert(isRecord(immediateRollbackData.version), 'Immediate rollback version is missing.');
    assert(
      immediateRollbackData.version.version === 2 &&
        immediateRollbackData.version.status === 'published',
      'Immediate rollback did not create and publish version 2.',
    );
    assert(
      immediateRollbackData.published === true &&
        immediateRollbackData.reviewCarriedForward === true,
      'Immediate rollback did not carry forward the current protected review.',
    );
    const immediateRollbackEtag = immediateRollback.headers.get('etag');
    assert(immediateRollbackEtag, 'Immediate rollback did not return a terminal ETag.');
    const immediateRollbackVersionId = immediateRollbackData.version.id;
    assert(typeof immediateRollbackVersionId === 'string', 'Immediate rollback id is missing.');
    createdEntityIds.add(immediateRollbackVersionId);

    const sourceAfterImmediateRollback = await CalculatorVersionModel.findOne({
      calculatorSlug: slug,
      version: 1,
    }).lean();
    const immediateRollbackVersion = await CalculatorVersionModel.findOne({
      calculatorSlug: slug,
      version: 2,
    }).lean();
    const calculatorAfterImmediateRollback = await CalculatorModel.findOne({ slug }).lean();
    assert(
      sourceAfterImmediateRollback?.status === 'retired',
      'Immediate rollback did not retire the previous current version.',
    );
    assert(
      immediateRollbackVersion?.status === 'published',
      'Immediate rollback version was not durably published.',
    );
    assert(
      calculatorAfterImmediateRollback?.currentVersionId?.toString() ===
        immediateRollbackVersion._id.toString(),
      'Immediate rollback did not atomically advance the current pointer.',
    );
    assert(
      JSON.stringify(sourceAfterImmediateRollback.payload) === immutableSourceSnapshot.payload &&
        sourceAfterImmediateRollback.sourceHash === immutableSourceSnapshot.sourceHash &&
        sourceAfterImmediateRollback.logicHash === immutableSourceSnapshot.logicHash &&
        sourceAfterImmediateRollback.contentHash === immutableSourceSnapshot.contentHash &&
        sourceAfterImmediateRollback.reviewHash === immutableSourceSnapshot.reviewHash &&
        sourceAfterImmediateRollback.versionHash === immutableSourceSnapshot.versionHash &&
        sourceAfterImmediateRollback.immutableAt?.toISOString() ===
          immutableSourceSnapshot.immutableAt,
      'Immediate rollback mutated protected source-version evidence.',
    );
    assert(
      invalidatedSlugs.filter((item) => item === slug).length === 2,
      'Immediate rollback cache invalidation callback was not invoked.',
    );
    const rollbackPublishEvent = await CacheInvalidationEventModel.findOne({
      calculatorSlug: slug,
      calculatorVersionId: immediateRollbackVersion._id,
      reason: 'publish',
    }).lean();
    assert(
      rollbackPublishEvent?.status === 'pending',
      'Immediate rollback cache event was not durably committed.',
    );

    const forbiddenReviewerDraftRollback = await fetch(
      `${baseUrl}/api/v1/admin/calculators/${slug}/rollback`,
      {
        method: 'POST',
        headers: {
          ...authorization(reviewerTokens.accessToken),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sourceVersion: 1, publish: false }),
      },
    );
    assert(
      forbiddenReviewerDraftRollback.status === 403,
      `Medical reviewer draft rollback returned ${forbiddenReviewerDraftRollback.status}.`,
    );

    const safeDraftRollback = await fetch(`${baseUrl}/api/v1/admin/calculators/${slug}/rollback`, {
      method: 'POST',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sourceVersion: 1, publish: false }),
    });
    assert(
      safeDraftRollback.status === 201,
      `Safe draft rollback failed (${safeDraftRollback.status}).`,
    );
    const safeDraftData = responseData(await responseJson(safeDraftRollback));
    assert(isRecord(safeDraftData.version), 'Safe rollback response version is missing.');
    assert(
      safeDraftData.version.version === 3 && safeDraftData.version.status === 'draft',
      'Safe rollback did not create version 3 as a draft.',
    );
    assert(safeDraftData.published === false, 'Safe rollback unexpectedly published the draft.');
    const safeDraftEtag = safeDraftRollback.headers.get('etag');
    assert(safeDraftEtag, 'Safe rollback did not return a draft ETag.');
    if (typeof safeDraftData.version.id === 'string')
      createdEntityIds.add(safeDraftData.version.id);

    const sourceAfterSafeRollback = await CalculatorVersionModel.findOne({
      calculatorSlug: slug,
      version: 1,
    }).lean();
    const rollbackDraft = await CalculatorVersionModel.findOne({
      calculatorSlug: slug,
      version: 3,
    }).lean();
    const calculatorAfterSafeRollback = await CalculatorModel.findOne({ slug }).lean();
    assert(
      sourceAfterSafeRollback?.status === 'retired',
      'Safe rollback changed source lifecycle.',
    );
    assert(rollbackDraft?.status === 'draft', 'Safe rollback draft was not persisted.');
    assert(
      calculatorAfterSafeRollback?.currentVersionId?.toString() ===
        immediateRollbackVersion._id.toString(),
      'Safe rollback changed the published pointer.',
    );
    assert(
      JSON.stringify(sourceAfterSafeRollback.payload) === immutableSourceSnapshot.payload &&
        sourceAfterSafeRollback.versionHash === immutableSourceSnapshot.versionHash &&
        sourceAfterSafeRollback.reviewHash === immutableSourceSnapshot.reviewHash,
      'Safe rollback mutated the immutable source version.',
    );
    assert(
      (await CacheInvalidationEventModel.countDocuments({
        calculatorSlug: slug,
        reason: 'publish',
      })) === 2,
      'Published operations and safe draft rollback produced the wrong durable event count.',
    );

    const biomarkerDisplayName = 'P4 integration marker';
    const biomarkerSource: JsonRecord = {
      id: 'p4-automated-source',
      type: 'internal',
      title: 'P4 automated integration fixture',
      ref: 'scripts/admin-api-integration.ts',
      verification: 'source-provided',
    };
    const sourceFreeDefinition = createDraftMeasurementDefinition(
      biomarkerKey,
      biomarkerDisplayName,
      [],
    );
    const sourcedDefinition = createDraftMeasurementDefinition(biomarkerKey, biomarkerDisplayName, [
      biomarkerSource,
    ]);
    assert(
      validateMeasurementDefinitionStructure(sourcedDefinition).valid,
      'The sourced biomarker integration fixture is not a valid measurement-definition.v1.',
    );

    const createBiomarker = await fetch(`${baseUrl}/api/v1/admin/biomarkers`, {
      method: 'POST',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        key: biomarkerKey,
        displayName: biomarkerDisplayName,
        kind: 'biomarker',
        canonicalUnit: 'ratio',
        definition: sourceFreeDefinition,
        status: 'draft',
        sources: [],
      }),
    });
    assert(
      createBiomarker.status === 201,
      `Biomarker creation failed (${createBiomarker.status}).`,
    );
    const biomarkerData = responseData(await responseJson(createBiomarker));
    assert(typeof biomarkerData.id === 'string', 'Created biomarker id is missing.');
    createdEntityIds.add(biomarkerData.id);

    const verifyWithoutSource = await fetch(
      `${baseUrl}/api/v1/admin/biomarkers/${biomarkerKey}/1/verify`,
      { method: 'POST', headers: authorization(reviewerTokens.accessToken) },
    );
    assert(
      verifyWithoutSource.status === 422,
      `Source-free biomarker verification returned ${verifyWithoutSource.status}.`,
    );
    assert(
      responseErrorCode(await responseJson(verifyWithoutSource)) === 'SOURCE_REQUIRED',
      'Source-free biomarker verification did not return SOURCE_REQUIRED.',
    );

    const addSource = await fetch(`${baseUrl}/api/v1/admin/biomarkers/${biomarkerKey}/1`, {
      method: 'PATCH',
      headers: {
        ...authorization(adminTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        definition: sourcedDefinition,
        sources: [biomarkerSource],
      }),
    });
    assert(addSource.status === 200, `Adding a biomarker source failed (${addSource.status}).`);

    const verifyWithSource = await fetch(
      `${baseUrl}/api/v1/admin/biomarkers/${biomarkerKey}/1/verify`,
      { method: 'POST', headers: authorization(reviewerTokens.accessToken) },
    );
    assert(
      verifyWithSource.status === 200,
      `Sourced biomarker verification failed (${verifyWithSource.status}).`,
    );
    assert(
      responseData(await responseJson(verifyWithSource)).status === 'verified',
      'Biomarker did not enter verified state.',
    );
    const verifiedBiomarker = await MeasurementRevisionModel.findOne({
      key: biomarkerKey,
      revision: 1,
    }).lean();
    assert(verifiedBiomarker?.status === 'verified', 'Verified biomarker was not persisted.');
    assert(
      verifiedBiomarker.reviewedBy?.toString() === reviewerTokens.user.id &&
        Boolean(verifiedBiomarker.reviewHash) &&
        Boolean(verifiedBiomarker.verifiedAt),
      'Biomarker verification was not bound to medical-reviewer evidence.',
    );

    const measurementBoundPayload = createPublishEligiblePayload(measurementBoundSlug);
    const measurementParameter = Array.isArray(measurementBoundPayload.parameters)
      ? measurementBoundPayload.parameters[0]
      : undefined;
    assert(isRecord(measurementParameter), 'Measurement-bound fixture parameter is missing.');
    measurementParameter.biomarkerKey = biomarkerKey;
    assert(isRecord(measurementBoundPayload.governance), 'Fixture governance is missing.');
    const verifiedBiomarkerId = verifiedBiomarker._id.toString();
    measurementBoundPayload.governance.measurementRevisionIds = [verifiedBiomarkerId];
    const createMeasurementBoundCalculator = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      method: 'POST',
      headers: {
        ...authorization(editorTokens.accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug: measurementBoundSlug,
        name: 'Measurement-bound integration fixture',
        payload: measurementBoundPayload,
        measurementRevisionIds: [verifiedBiomarkerId],
      }),
    });
    assert(
      createMeasurementBoundCalculator.status === 201,
      `Measurement-bound calculator creation failed (${createMeasurementBoundCalculator.status}).`,
    );
    const measurementBoundData = responseData(await responseJson(createMeasurementBoundCalculator));
    if (
      isRecord(measurementBoundData.calculator) &&
      typeof measurementBoundData.calculator.id === 'string'
    )
      createdEntityIds.add(measurementBoundData.calculator.id);
    if (
      isRecord(measurementBoundData.version) &&
      typeof measurementBoundData.version.id === 'string'
    )
      createdEntityIds.add(measurementBoundData.version.id);
    const boundVersion = await CalculatorVersionModel.findOne({
      calculatorSlug: measurementBoundSlug,
      version: 1,
    }).lean();
    assert(
      boundVersion?.measurementRevisionIds.length === 1 &&
        boundVersion.measurementRevisionIds[0]?.toString() === verifiedBiomarkerId &&
        boundVersion.measurementSnapshots.length === 1,
      'Server did not persist the exact measurement revision binding.',
    );
    const boundSnapshot = boundVersion.measurementSnapshots[0];
    assert(
      isRecord(boundSnapshot) &&
        boundSnapshot.measurementRevisionId === verifiedBiomarkerId &&
        boundSnapshot.key === biomarkerKey &&
        boundSnapshot.definitionHash === verifiedBiomarker.definitionHash,
      'Server did not derive the immutable measurement snapshot from persistence.',
    );

    const auditActions = await AuditLogModel.distinct('action', {
      actorId: { $in: createdUsers.map((user) => user._id) },
    });
    for (const requiredAction of [
      'calculator.create',
      'calculator.version.test-cases.update',
      'calculator.version.submit-review',
      'calculator.version.approve',
      'calculator.version.publish',
      'calculator.version.rollback',
      'calculator.version.publish.rollback',
      'admin.user.create',
      'admin.user.update',
      'admin.user.update.rejected',
      'biomarker.create',
      'biomarker.update',
      'biomarker.verify',
    ]) {
      assert(auditActions.includes(requiredAction), `Missing audit action ${requiredAction}.`);
    }
    const auditRead = await fetch(
      `${baseUrl}/api/v1/admin/audit?action=calculator.version.publish&slug=${slug}`,
      { headers: authorization(adminTokens.accessToken) },
    );
    assert(auditRead.status === 200, `Audit read failed (${auditRead.status}).`);
    const auditReadData = (await responseJson(auditRead)).data;
    assert(Array.isArray(auditReadData), 'Audit read did not return a list.');
    assert(
      auditReadData.some((item) => isRecord(item) && item.action === 'calculator.version.publish'),
      'Filtered audit read did not include the publish record.',
    );
  } catch (error) {
    failure = error;
  } finally {
    const cleanupFailures: unknown[] = [];
    const attemptCleanup = async (cleanup: () => Promise<unknown>): Promise<void> => {
      try {
        await cleanup();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };

    if (server) await attemptCleanup(async () => await closeServer(server!));
    await attemptCleanup(
      async () =>
        await settleP4ModelInitialization(Object.values(databaseClient.connection.models)),
    );

    let userIds: unknown[] = [];
    try {
      const fixtureUsers = await AdminUserModel.find({ email: { $in: fixtureEmails } })
        .select('_id')
        .lean();
      userIds = fixtureUsers.map((user) => user._id);
    } catch (error) {
      cleanupFailures.push(error);
    }

    await attemptCleanup(async () => {
      await AuditLogModel.deleteMany({
        $or: [{ actorId: { $in: userIds } }, { entityId: { $in: [...createdEntityIds] } }],
      });
    });
    await attemptCleanup(async () => {
      await AdminSessionModel.deleteMany({ adminUserId: { $in: userIds } });
    });
    await attemptCleanup(async () => {
      await LoginAttemptModel.deleteMany({ accountHash: { $in: fixtureAccountHashes } });
    });
    await attemptCleanup(async () => {
      await MeasurementRevisionModel.deleteMany({ key: biomarkerKey });
    });
    await attemptCleanup(async () => {
      await CacheInvalidationEventModel.deleteMany({
        calculatorSlug: { $in: [slug, csrfRejectedSlug, measurementBoundSlug] },
      });
    });
    await attemptCleanup(async () => {
      await CalculatorVersionModel.deleteMany({
        calculatorSlug: { $in: [slug, csrfRejectedSlug, measurementBoundSlug] },
      });
    });
    await attemptCleanup(async () => {
      await CalculatorModel.deleteMany({
        slug: { $in: [slug, csrfRejectedSlug, measurementBoundSlug] },
      });
    });
    await attemptCleanup(async () => {
      await AdminGovernanceLockModel.deleteOne({ _id: 'active-admin-invariant' });
    });
    await attemptCleanup(async () => {
      await AdminUserModel.deleteMany({ email: { $in: fixtureEmails } });
    });

    let footprintVerified = false;
    try {
      const footprintIssue = p4CleanupOwnershipIssue(
        databaseNonce,
        await readP4DatabaseFootprint(connectedDatabase),
      );
      if (footprintIssue) {
        cleanupFailures.push(new Error(`Refusing unsafe P4 database cleanup: ${footprintIssue}`));
      } else {
        footprintVerified = true;
      }
    } catch (error) {
      cleanupFailures.push(error);
    }

    if (footprintVerified && cleanupFailures.length === 0) {
      await attemptCleanup(async () => {
        assertP4Authorization(connectedDatabase, writeAuthorization);
        await dropAndVerifyP4Database(connectedDatabase, writeAuthorization.databaseName);
      });
    }
    await attemptCleanup(async () => await disconnectDatabase());
    failure = mergeP4OperationAndCleanupFailures(failure, cleanupFailures);
  }

  if (failure !== undefined) throw failure;

  console.log(
    JSON.stringify({
      status: 'ok',
      database: environment.mongoDbName,
      authorization:
        '401-403-role-boundaries-lockout-cookie-csrf-user-lifecycle-and-last-admin-verified',
      concurrency: 'if-match-conflict-and-lifecycle-etag-propagation-verified',
      calculator:
        'preview-tests-publish-review-evidence-query-immutability-transactional-rollback-and-rbac-verified',
      biomarker:
        'medical-reviewer-source-required-verification-and-server-derived-binding-verified',
      audit: 'transactional-publish-and-admin-write-events-verified',
      cache: 'primed-public-cache-callback-and-durable-invalidation-events-verified',
      cleanup: 'unique-fixtures-removed',
    }),
  );
}

if (require.main === module) {
  void runAdminApiIntegration().catch(async (error: unknown) => {
    try {
      await disconnectDatabase();
    } catch {
      // The integration error already includes its attempted cleanup failure.
    }
    console.error(JSON.stringify({ status: 'error', errors: safeErrorMessages(error) }));
    process.exitCode = 1;
  });
}
