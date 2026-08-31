import {
  type MeasurementDefinitionV1,
  validateCalculatorVersion,
  validateMeasurementDefinitionStructure,
} from '@niro/contracts';
import { ENGINE_SEMANTIC_VERSION } from '@niro/engine';
import { connection, Types, type ClientSession } from 'mongoose';
import type { Db } from 'mongodb';

import { hashPassword } from '../apps/server/src/auth/service';
import {
  type AppEnvironment,
  loadEnvironment,
  loadProjectEnvironment,
} from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import {
  isApprovedMeasurementEnvelope,
  measurementEnvelopeConsistencyIssue,
  measurementReviewHash,
  stableMeasurementHash,
} from '../apps/server/src/modules/measurement-contract';
import { AdminUserModel } from '../apps/server/src/persistence/models/admin-user';
import {
  ensureMeasurementRevisionIndexes,
  MeasurementRevisionModel,
} from '../apps/server/src/persistence/models/measurement-revision';
import { withTransaction } from '../apps/server/src/persistence/transactions';
import {
  assertP7FixtureNonce as assertNonce,
  P7_FIXTURE_PASSWORD,
  p7FixtureKeys,
} from './p7-fixture-identity';

export { P7_FIXTURE_PASSWORD, p7FixtureKeys } from './p7-fixture-identity';

const FIXTURE_ID = 'p7-calculator-studio-browser-fixture-v1';
const MANIFEST_COLLECTION = 'p7_fixture_manifests';
const WRITE_OPT_IN = '--allow-temporary-database-write';
const REVIEWED_AT = '2026-08-28T00:00:00.000Z';
const REVIEW_EXPIRES_AT = '2027-08-28T00:00:00.000Z';
const issuedAuthorizations = new WeakSet<object>();

export interface P7FixtureWriteAuthorization {
  readonly nonce: string;
  readonly databaseName: string;
}

export interface P7FixtureFootprint {
  readonly manifests: readonly Record<string, unknown>[];
  readonly admins: readonly Record<string, unknown>[];
  readonly measurements: readonly Record<string, unknown>[];
}

export interface P7InitializableModel {
  init(): Promise<unknown>;
}

/**
 * Mongoose may still be creating model indexes after a connection becomes
 * usable. Drain those initializers before dropping a fixture database so a
 * late index build cannot recreate an empty database after guarded cleanup.
 */
export async function settleP7ModelInitialization(
  models: readonly P7InitializableModel[] = Object.values(connection.models),
): Promise<void> {
  await Promise.all(models.map(async (model) => await model.init()));
}

async function dropAndVerifyP7Database(database: Db, expectedName: string): Promise<void> {
  await database.dropDatabase();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listed = await database.admin().listDatabases({ nameOnly: true });
    if (!listed.databases.some(({ name }) => name === expectedName)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Guarded cleanup did not remove the temporary database ${expectedName}.`);
}

export function p7TemporaryDatabaseName(nonce: string): string {
  assertNonce(nonce);
  return `niro_p7_${nonce}`;
}

function objectIdFor(nonce: string, purpose: string): Types.ObjectId {
  assertNonce(nonce);
  return new Types.ObjectId(
    stableMeasurementHash({ fixture: FIXTURE_ID, nonce, purpose }).slice(0, 24),
  );
}

export function p7FixtureIdentities(nonce: string) {
  return {
    adminId: objectIdFor(nonce, 'admin'),
    reviewerId: objectIdFor(nonce, 'medical-reviewer'),
    measurementId: objectIdFor(nonce, 'measurement-revision'),
    manifestId: objectIdFor(nonce, 'manifest'),
  } as const;
}

export function assertSafeP7FixtureEnvironment(
  environment: Pick<AppEnvironment, 'nodeEnv' | 'mongoDbName'>,
  nonce: string,
): void {
  if (environment.nodeEnv === 'production') {
    throw new Error('P7 synthetic fixtures are forbidden in production.');
  }
  const expected = p7TemporaryDatabaseName(nonce);
  if (environment.mongoDbName !== expected) {
    throw new Error(
      `P7 fixtures require the unique temporary database ${expected}; shared databases are refused.`,
    );
  }
}

export function authorizeP7FixtureWrites(
  environment: Pick<AppEnvironment, 'nodeEnv' | 'mongoDbName'>,
  nonce: string,
  arguments_: readonly string[],
): P7FixtureWriteAuthorization {
  assertSafeP7FixtureEnvironment(environment, nonce);
  if (!arguments_.includes(WRITE_OPT_IN)) {
    throw new Error(`P7 fixture writes require the explicit ${WRITE_OPT_IN} opt-in.`);
  }
  const authorization = Object.freeze({ nonce, databaseName: environment.mongoDbName });
  issuedAuthorizations.add(authorization);
  return authorization;
}

function assertAuthorization(nonce: string, authorization: P7FixtureWriteAuthorization): void {
  if (
    !issuedAuthorizations.has(authorization) ||
    authorization.nonce !== nonce ||
    authorization.databaseName !== p7TemporaryDatabaseName(nonce)
  ) {
    throw new Error('A valid P7 temporary-database write authorization is required.');
  }
  if (connection.readyState !== 1 || connection.name !== authorization.databaseName) {
    throw new Error('The MongoDB connection does not match the authorized P7 fixture database.');
  }
}

function fixtureSource(nonce: string, claimId: string): MeasurementDefinitionV1['sources'][number] {
  return {
    id: `p7-${nonce}-source`,
    type: 'external',
    org: 'Synthetic P7 Test Organization',
    title: 'Synthetic nonclinical browser-fixture evidence',
    url: `https://example.test/p7/${nonce}`,
    accessed: '2026-08-28',
    verification: 'fetch-verified',
    claimIds: [claimId],
  };
}

export function createP7MeasurementDefinition(
  nonce: string,
  reviewerId = p7FixtureIdentities(nonce).reviewerId.toString(),
): MeasurementDefinitionV1 {
  const key = p7FixtureKeys(nonce).measurement;
  const claimId = `${key}-claim`;
  return {
    schemaVersion: 'measurement-definition.v1',
    key,
    version: 1,
    status: 'approved',
    displayName: 'Synthetic P7 Studio marker',
    aliases: ['P7 synthetic marker'],
    kind: 'laboratory-biomarker',
    domainKeys: ['synthetic-studio'],
    valueType: 'number',
    canonicalUnit: { code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' },
    acceptedUnits: [
      { code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' },
      { code: 'mg/dL', dimension: 'mass-concentration', display: 'mg/dL' },
    ],
    conversions: [
      {
        kind: 'affine',
        fromUnit: 'mg/dL',
        toUnit: 'mg/L',
        factor: 10,
        offset: 0,
        sourceClaimIds: [claimId],
      },
    ],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
      soft: { min: 1, max: 90, minInclusive: true, maxInclusive: true },
      displayDecimals: 1,
    },
    referenceRanges: [
      {
        id: `${key}-fixture-range`,
        label: 'Synthetic interface interval',
        unit: 'mg/L',
        interval: { min: 2, max: 8, minInclusive: true, maxInclusive: false },
        context: {
          specimen: 'Synthetic specimen',
          population: 'Nonclinical automated-test population',
          method: 'Synthetic method',
        },
        interpretation: 'A synthetic range with no clinical meaning.',
        interpretationOnly: true,
        sourceClaimIds: [claimId],
        reviewExpiresAt: REVIEW_EXPIRES_AT,
      },
    ],
    description: {
      whatItMeasures: 'A synthetic value used solely to verify Calculator Studio workflows.',
      whyItMatters: 'It confirms exact immutable measurement-revision binding in a test database.',
      collectionNotes: 'Never use this synthetic fixture for health decisions.',
      limitations: 'This measurement has no medical or diagnostic meaning.',
    },
    sources: [fixtureSource(nonce, claimId)],
    governance: {
      reviewStatus: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewerId,
      reviewExpiresAt: REVIEW_EXPIRES_AT,
      publishBlockers: [],
      conflictIds: [],
    },
  };
}

export function createP7MeasurementEnvelope(nonce: string): Record<string, unknown> {
  const ids = p7FixtureIdentities(nonce);
  const definition = createP7MeasurementDefinition(nonce, ids.reviewerId.toString());
  const structure = validateMeasurementDefinitionStructure(definition);
  if (!structure.valid) {
    throw new Error(
      `Invalid P7 measurement fixture: ${structure.findings
        .map((finding) => `${finding.instancePath || '$'} ${finding.message}`)
        .join('; ')}`,
    );
  }
  const definitionHash = stableMeasurementHash(definition);
  const envelope: Record<string, unknown> = {
    _id: ids.measurementId,
    key: definition.key,
    revision: 1,
    status: 'verified',
    displayName: definition.displayName,
    kind: 'biomarker',
    canonicalUnit: definition.canonicalUnit.code,
    definition,
    definitionHash,
    sources: definition.sources,
    migrationProvenance: {
      fixture: FIXTURE_ID,
      fixtureNonce: nonce,
      purpose: 'nonclinical-calculator-studio-browser-acceptance',
    },
    createdBy: ids.adminId,
    reviewedBy: ids.reviewerId,
    verifiedAt: new Date(REVIEWED_AT),
    reviewHash: measurementReviewHash({
      definitionHash,
      sources: definition.sources,
      reviewerId: ids.reviewerId.toString(),
      reviewedAt: REVIEWED_AT,
    }),
  };
  const issue = measurementEnvelopeConsistencyIssue(envelope);
  if (issue) throw new Error(`Invalid P7 measurement envelope: ${issue}`);
  if (!isApprovedMeasurementEnvelope(envelope, new Date(REVIEWED_AT))) {
    throw new Error('P7 measurement fixture is not a publish-eligible verified envelope.');
  }
  return envelope;
}

function calculatorName(nonce: string): string {
  return `Synthetic P7 Studio calculator ${nonce.slice(0, 12)}`;
}

export function createP7CalculatorPayload(
  nonce: string,
  measurementRevisionId = p7FixtureIdentities(nonce).measurementId.toString(),
): Record<string, unknown> {
  const keys = p7FixtureKeys(nonce);
  const payload: Record<string, unknown> = {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: keys.calculator,
    name: calculatorName(nonce),
    version: 1,
    status: 'approved',
    engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
    shortDescription: 'A temporary nonclinical calculator for Calculator Studio acceptance.',
    disclaimers: ['Synthetic fixture only. It provides no medical advice or diagnosis.'],
    parameters: [
      {
        key: 'markerValue',
        label: 'Synthetic marker value',
        group: 'marker',
        biomarkerKey: keys.measurement,
        inputType: 'number',
        unit: { canonical: 'mg/L', allowed: [{ code: 'mg/dL', factor: 10 }] },
        validation: { required: true, min: 0, max: 100, softMin: 1, softMax: 90 },
        missingPolicy: 'block',
        order: 1,
        helpText: 'Synthetic input used only in the isolated P7 browser fixture.',
      },
    ],
    scoringRules: [
      {
        parameterKey: 'markerValue',
        bandEdges: 'min-inclusive',
        contexts: [
          {
            when: null,
            bands: [
              { min: null, max: 50, points: 0 },
              { min: 50, max: null, points: 1 },
            ],
          },
        ],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    domains: [
      { key: 'fixture', label: 'Synthetic fixture', weight: 1, parameterKeys: ['markerValue'] },
    ],
    domainAggregationPolicy: {
      zeroDenominator: 'unscored',
      missingDomainPolicy: 'exclude-and-renormalize',
      negativeDomainPolicy: 'preserve',
    },
    resultCategories: {
      scale: { min: 0, max: 1, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        { label: 'Lower fixture value', min: null, max: 1, color: '#26734D' },
        { label: 'Higher fixture value', min: 1, max: null, color: '#9A5B00' },
      ],
    },
    uiConfig: {
      theme: { accent: '#0D5CAB' },
      steps: [{ key: 'marker', title: 'Marker', parameterGroups: ['marker'] }],
      result: { layout: ['score-gauge', 'category', 'biomarker-details'] },
    },
    content: {
      schemaVersion: 'content-page.v1',
      contentId: `${keys.calculator}-content`,
      version: 1,
      locale: 'en-IN',
      slug: keys.calculator,
      title: calculatorName(nonce),
      summary: 'Reviewed nonclinical content used only for automated P7 checks.',
      blocks: [
        {
          id: 'fixture-notice',
          type: 'markdown',
          markdown: 'This temporary calculator contains only synthetic nonclinical test logic.',
        },
      ],
      claims: [],
      citations: [],
      authorship: {
        contributors: [{ id: 'p7-automation', displayName: 'P7 automation', role: 'author' }],
        ownerId: 'p7-automation',
        createdAt: REVIEWED_AT,
        updatedAt: REVIEWED_AT,
      },
      medicalReview: {
        status: 'not-applicable',
        scope: 'not-applicable',
        reviewerId: null,
        reviewedAt: null,
        nextReviewAt: null,
        decisionNote: 'Synthetic nonclinical automation fixture.',
      },
      seo: {
        metaTitle: calculatorName(nonce),
        metaDescription: 'Temporary nonclinical Calculator Studio integration fixture.',
        canonicalPath: `/c/${keys.calculator}`,
        robots: { index: false, follow: false },
        schemaTypes: ['WebPage'],
      },
      publication: {
        status: 'approved',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Created for an automated P7 Calculator Studio integration check.',
      },
    },
    sources: [
      {
        type: 'internal',
        ref: `${FIXTURE_ID}:${nonce}`,
        title: 'P7 automated nonclinical integration fixture',
        verification: 'source-provided',
        demoPoints: true,
      },
    ],
    governance: {
      clinicalStatus: 'not-applicable',
      sourceReviewStatus: 'not-applicable',
      discrepancyIds: [],
      publishBlockers: [],
      measurementRevisionIds: [measurementRevisionId],
    },
    testCases: [
      {
        key: 'fixture-lower',
        name: 'Lower synthetic marker value',
        kind: 'nonclinical-fixture',
        inputs: { markerValue: 5 },
        expected: { finalScore: 0 },
      },
    ],
  };
  const validation = validateCalculatorVersion(payload, `${keys.calculator}.fixture.json`);
  if (!validation.publishEligible) {
    const findings = [
      ...validation.structural.findings,
      ...validation.semantic.findings,
      ...validation.clinical.findings,
      ...validation.publish.findings,
    ];
    throw new Error(
      `Invalid P7 calculator fixture: ${findings
        .map((finding) => `${finding.id} ${finding.jsonPath}: ${finding.message}`)
        .join('; ')}`,
    );
  }
  return payload;
}

function expectedManifest(nonce: string): Record<string, unknown> {
  const ids = p7FixtureIdentities(nonce);
  const keys = p7FixtureKeys(nonce);
  return {
    _id: ids.manifestId,
    fixtureId: FIXTURE_ID,
    nonce,
    databaseName: p7TemporaryDatabaseName(nonce),
    adminIds: [ids.adminId.toString(), ids.reviewerId.toString()],
    adminEmails: [keys.adminEmail, keys.reviewerEmail],
    measurementRevisionId: ids.measurementId.toString(),
    measurementKey: keys.measurement,
    calculatorSlug: keys.calculator,
  };
}

async function readP7Footprint(session?: ClientSession): Promise<P7FixtureFootprint> {
  const adminQuery = AdminUserModel.find().select('+passwordHash').lean();
  const measurementQuery = MeasurementRevisionModel.find().lean();
  if (session) {
    adminQuery.session(session);
    measurementQuery.session(session);
  }
  const database = connection.db;
  if (!database) throw new Error('The P7 fixture database connection is unavailable.');
  const [admins, measurements, manifests] = await Promise.all([
    adminQuery,
    measurementQuery,
    database.collection(MANIFEST_COLLECTION).find({}, { session }).toArray(),
  ]);
  return {
    admins: admins as unknown as Record<string, unknown>[],
    measurements: measurements as unknown as Record<string, unknown>[],
    manifests: manifests as unknown as Record<string, unknown>[],
  };
}

function objectIdString(value: unknown): string {
  return value instanceof Types.ObjectId ? value.toString() : String(value);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join('\0') === [...right].sort().join('\0');
}

export function p7FixtureOwnershipIssue(
  nonce: string,
  footprint: P7FixtureFootprint,
): string | undefined {
  const keys = p7FixtureKeys(nonce);
  const ids = p7FixtureIdentities(nonce);
  if (
    footprint.manifests.length !== 1 ||
    footprint.admins.length !== 2 ||
    footprint.measurements.length !== 1
  ) {
    return 'P7 fixture seed footprint is missing, partial, or has unexpected cardinality.';
  }
  const manifest = footprint.manifests[0]!;
  const expected = expectedManifest(nonce);
  if (
    objectIdString(manifest._id) !== ids.manifestId.toString() ||
    manifest.fixtureId !== expected.fixtureId ||
    manifest.nonce !== nonce ||
    manifest.databaseName !== p7TemporaryDatabaseName(nonce) ||
    manifest.measurementRevisionId !== ids.measurementId.toString() ||
    manifest.measurementKey !== keys.measurement ||
    manifest.calculatorSlug !== keys.calculator ||
    !Array.isArray(manifest.adminIds) ||
    !sameStrings(manifest.adminIds.map(String), [
      ids.adminId.toString(),
      ids.reviewerId.toString(),
    ]) ||
    !Array.isArray(manifest.adminEmails) ||
    !sameStrings(manifest.adminEmails.map(String), [keys.adminEmail, keys.reviewerEmail])
  ) {
    return 'P7 fixture ownership manifest is invalid or does not match the nonce.';
  }
  const adminIdentities = footprint.admins.map(
    (admin) =>
      `${objectIdString(admin._id)}:${String(admin.email)}:${String(admin.role)}:${String(admin.status)}`,
  );
  if (
    !sameStrings(adminIdentities, [
      `${ids.adminId}:${keys.adminEmail}:admin:active`,
      `${ids.reviewerId}:${keys.reviewerEmail}:medical-reviewer:active`,
    ])
  ) {
    return 'P7 fixture admin identities, roles, or statuses are not fixture-owned.';
  }
  const measurement = footprint.measurements[0]!;
  const provenance = measurement.migrationProvenance as Record<string, unknown> | undefined;
  if (
    objectIdString(measurement._id) !== ids.measurementId.toString() ||
    measurement.key !== keys.measurement ||
    measurement.revision !== 1 ||
    measurement.status !== 'verified' ||
    objectIdString(measurement.createdBy) !== ids.adminId.toString() ||
    objectIdString(measurement.reviewedBy) !== ids.reviewerId.toString() ||
    provenance?.fixture !== FIXTURE_ID ||
    provenance.fixtureNonce !== nonce
  ) {
    return 'P7 measurement revision is not exactly owned by this fixture nonce.';
  }
  return undefined;
}

export interface P7FixtureInspection {
  readonly status: 'ok' | 'not-owned';
  readonly action: 'inspect';
  readonly database: string;
  readonly nonce: string;
  readonly fixtureOnly: true;
  readonly ownershipVerified: boolean;
  readonly issue: string | null;
}

export function inspectP7FixtureFootprint(
  nonce: string,
  footprint: P7FixtureFootprint,
): P7FixtureInspection {
  assertNonce(nonce);
  const issue = p7FixtureOwnershipIssue(nonce, footprint);
  return {
    status: issue ? 'not-owned' : 'ok',
    action: 'inspect',
    database: p7TemporaryDatabaseName(nonce),
    nonce,
    fixtureOnly: true,
    ownershipVerified: issue === undefined,
    issue: issue ?? null,
  };
}

async function assertDatabaseHasNoDocuments(): Promise<void> {
  const database = connection.db;
  if (!database) throw new Error('The P7 fixture database connection is unavailable.');
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if ((await database.collection(name).estimatedDocumentCount()) > 0) {
      throw new Error(`Refusing to seed non-empty isolated database; ${name} contains documents.`);
    }
  }
}

function footprintIsEmpty(footprint: P7FixtureFootprint): boolean {
  return (
    footprint.manifests.length === 0 &&
    footprint.admins.length === 0 &&
    footprint.measurements.length === 0
  );
}

async function ensureFixtureCollections(): Promise<void> {
  const database = connection.db;
  if (!database) throw new Error('The P7 fixture database connection is unavailable.');
  const existing = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  if (!existing.has(AdminUserModel.collection.collectionName)) {
    await AdminUserModel.createCollection();
  }
  if (!existing.has(MeasurementRevisionModel.collection.collectionName)) {
    await MeasurementRevisionModel.createCollection();
  }
  if (!existing.has(MANIFEST_COLLECTION)) await database.createCollection(MANIFEST_COLLECTION);
  await database.collection(MANIFEST_COLLECTION).createIndex({ fixtureId: 1 }, { unique: true });
}

async function assertOwnedFootprint(nonce: string, session?: ClientSession): Promise<void> {
  const issue = p7FixtureOwnershipIssue(nonce, await readP7Footprint(session));
  if (issue) throw new Error(`Refusing unsafe P7 fixture operation: ${issue}`);
}

export async function seedP7Fixture(
  nonce: string,
  authorization: P7FixtureWriteAuthorization,
): Promise<void> {
  assertAuthorization(nonce, authorization);
  let emptyTargetConfirmed = false;
  try {
    await assertDatabaseHasNoDocuments();
    emptyTargetConfirmed = true;
    await ensureFixtureCollections();
    const database = connection.db;
    if (!database) throw new Error('The P7 fixture database connection is unavailable.');
    const ids = p7FixtureIdentities(nonce);
    const keys = p7FixtureKeys(nonce);
    const passwordHash = await hashPassword(P7_FIXTURE_PASSWORD);
    await withTransaction(async (session) => {
      await AdminUserModel.create(
        [
          {
            _id: ids.adminId,
            email: keys.adminEmail,
            passwordHash,
            role: 'admin',
            status: 'active',
            failedLoginCount: 0,
          },
          {
            _id: ids.reviewerId,
            email: keys.reviewerEmail,
            passwordHash,
            role: 'medical-reviewer',
            status: 'active',
            failedLoginCount: 0,
          },
        ],
        { session, ordered: true },
      );
      await new MeasurementRevisionModel(createP7MeasurementEnvelope(nonce)).save({ session });
      await database.collection(MANIFEST_COLLECTION).insertOne(expectedManifest(nonce), {
        session,
      });
      await assertOwnedFootprint(nonce, session);
    });
    await ensureMeasurementRevisionIndexes();
    await assertOwnedFootprint(nonce);
  } catch (error) {
    if (!emptyTargetConfirmed) throw error;
    return rethrowAfterP7Cleanup(error, async () => {
      const footprint = await readP7Footprint();
      if (!p7FixtureOwnershipIssue(nonce, footprint)) {
        await dropP7FixtureDatabase(nonce, authorization);
        return;
      }
      if (!footprintIsEmpty(footprint)) {
        throw new Error('P7 seed failure left a partial footprint; automatic deletion is refused.');
      }
      const database = connection.db;
      if (
        !database ||
        database.databaseName !== authorization.databaseName ||
        database.databaseName !== p7TemporaryDatabaseName(nonce)
      ) {
        throw new Error('Refusing to drop an empty database outside the P7 fixture namespace.');
      }
      await settleP7ModelInitialization();
      await assertDatabaseHasNoDocuments();
      await dropAndVerifyP7Database(database, authorization.databaseName);
    });
  }
}

export async function dropP7FixtureDatabase(
  nonce: string,
  authorization: P7FixtureWriteAuthorization,
): Promise<void> {
  assertAuthorization(nonce, authorization);
  await settleP7ModelInitialization();
  await assertOwnedFootprint(nonce);
  const database = connection.db;
  if (
    !database ||
    database.databaseName !== p7TemporaryDatabaseName(nonce) ||
    database.databaseName !== authorization.databaseName
  ) {
    throw new Error('Refusing to drop a database outside the authorized P7 temporary namespace.');
  }
  await dropAndVerifyP7Database(database, authorization.databaseName);
}

export async function rethrowAfterP7Cleanup(
  originalError: unknown,
  cleanup: () => Promise<void>,
): Promise<never> {
  try {
    await cleanup();
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      'P7 fixture operation failed and guarded cleanup could not be verified.',
    );
  }
  throw originalError;
}

function output(nonce: string, action: 'print' | 'seed' | 'drop'): Record<string, unknown> {
  const keys = p7FixtureKeys(nonce);
  const ids = p7FixtureIdentities(nonce);
  return {
    status: 'ok',
    action,
    database: p7TemporaryDatabaseName(nonce),
    nonce,
    fixtureOnly: true,
    credentials: {
      password: P7_FIXTURE_PASSWORD,
      admin: { email: keys.adminEmail, role: 'admin' },
      reviewer: { email: keys.reviewerEmail, role: 'medical-reviewer' },
    },
    measurement: { key: keys.measurement, revisionId: ids.measurementId.toString() },
    calculator: {
      slug: keys.calculator,
      name: calculatorName(nonce),
      payload: createP7CalculatorPayload(nonce, ids.measurementId.toString()),
    },
  };
}

async function main(): Promise<void> {
  const [command, nonce, ...arguments_] = process.argv.slice(2);
  if (
    command !== 'print' &&
    command !== 'inspect' &&
    command !== 'seed' &&
    command !== 'drop' &&
    command !== 'cleanup'
  ) {
    throw new Error('Use print, inspect, seed, drop, or cleanup.');
  }
  assertNonce(nonce);
  if (command === 'print') {
    console.log(JSON.stringify(output(nonce, 'print')));
    return;
  }
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (!environment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  if (command === 'inspect') {
    assertSafeP7FixtureEnvironment(environment, nonce);
    await connectDatabase({ environment });
    try {
      console.log(JSON.stringify(inspectP7FixtureFootprint(nonce, await readP7Footprint())));
    } finally {
      await disconnectDatabase();
    }
    return;
  }
  const authorization = authorizeP7FixtureWrites(environment, nonce, arguments_);
  await connectDatabase({ environment });
  try {
    if (command === 'seed') await seedP7Fixture(nonce, authorization);
    else await dropP7FixtureDatabase(nonce, authorization);
    console.log(JSON.stringify(output(nonce, command === 'seed' ? 'seed' : 'drop')));
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  void main().catch(async (error: unknown) => {
    await disconnectDatabase();
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
