import {
  type MeasurementDefinitionV1,
  validateCalculatorVersion,
  validateMeasurementDefinitionStructure,
} from '@niro/contracts';
import { ENGINE_SEMANTIC_VERSION } from '@niro/engine';
import { connection, Types, type ClientSession } from 'mongoose';

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
  stableMeasurementEqual,
  stableMeasurementHash,
} from '../apps/server/src/modules/measurement-contract';
import { CalculatorModel } from '../apps/server/src/persistence/models/calculator';
import { CalculatorVersionModel } from '../apps/server/src/persistence/models/calculator-version';
import {
  ensureMeasurementRevisionIndexes,
  MeasurementRevisionModel,
} from '../apps/server/src/persistence/models/measurement-revision';
import { withTransaction } from '../apps/server/src/persistence/transactions';

const FIXTURE_ID = 'p6-browser-fixture-v2';
const WRITE_OPT_IN = '--allow-temporary-database-write';
const REVIEW_EXPIRY = '2027-08-25T00:00:00.000Z';
const REVIEWED_AT = '2026-08-25T00:00:00.000Z';
const PUBLISHED_AT = new Date(REVIEWED_AT);
const issuedAuthorizations = new WeakSet<object>();

export interface P6FixtureWriteAuthorization {
  readonly prefix: string;
  readonly databaseName: string;
}

export interface FixtureFootprint {
  readonly measurements: readonly Record<string, unknown>[];
  readonly calculators: readonly Record<string, unknown>[];
  readonly versions: readonly Record<string, unknown>[];
}

export function p6TemporaryDatabaseName(prefix: string): string {
  assertFixturePrefix(prefix);
  return `niro_p6_${prefix.slice('p6-ui-'.length)}`;
}

export function assertSafeP6FixtureEnvironment(
  environment: Pick<AppEnvironment, 'nodeEnv' | 'mongoDbName'>,
  prefix: string,
): void {
  if (environment.nodeEnv === 'production') {
    throw new Error('P6 synthetic fixtures are forbidden in production.');
  }
  const expectedDatabase = p6TemporaryDatabaseName(prefix);
  if (environment.mongoDbName !== expectedDatabase) {
    throw new Error(
      `P6 synthetic fixtures require the unique temporary database ${expectedDatabase}; shared development databases are refused.`,
    );
  }
}

export function authorizeP6FixtureWrites(
  environment: Pick<AppEnvironment, 'nodeEnv' | 'mongoDbName'>,
  prefix: string,
  arguments_: readonly string[],
): P6FixtureWriteAuthorization {
  assertSafeP6FixtureEnvironment(environment, prefix);
  if (!arguments_.includes(WRITE_OPT_IN)) {
    throw new Error(`P6 fixture writes require the explicit ${WRITE_OPT_IN} command-line opt-in.`);
  }
  const authorization = Object.freeze({ prefix, databaseName: environment.mongoDbName });
  issuedAuthorizations.add(authorization);
  return authorization;
}

function assertFixtureAuthorization(
  prefix: string,
  authorization: P6FixtureWriteAuthorization,
): void {
  if (
    !issuedAuthorizations.has(authorization) ||
    authorization.prefix !== prefix ||
    authorization.databaseName !== p6TemporaryDatabaseName(prefix)
  ) {
    throw new Error('A valid P6 temporary-database write authorization is required.');
  }
  if (connection.readyState !== 1 || connection.name !== authorization.databaseName) {
    throw new Error('P6 fixture connection does not match its authorized temporary database.');
  }
}

function assertFixturePrefix(value: string | undefined): asserts value is string {
  if (!value || !/^p6-ui-[a-f0-9]{30}$/.test(value)) {
    throw new Error('Fixture prefix must match p6-ui- followed by 30 lowercase hex characters.');
  }
}

export function p6FixtureKeys(prefix: string) {
  assertFixturePrefix(prefix);
  return {
    primary: `${prefix}-marker`,
    related: `${prefix}-related`,
    draft: `${prefix}-draft`,
    retired: `${prefix}-retired`,
    calculator: `${prefix}-calculator`,
  } as const;
}

function fixtureCalculatorName(prefix: string): string {
  return `Synthetic P6 calculator ${prefix.slice('p6-ui-'.length, 'p6-ui-'.length + 12)}`;
}

type CanonicalSource = MeasurementDefinitionV1['sources'][number];

function source(
  id: string,
  org: string,
  title: string,
  claimId: string,
  verification: CanonicalSource['verification'] = 'fetch-verified',
): CanonicalSource {
  return {
    id,
    type: 'external',
    org,
    title,
    url: `https://example.test/evidence/${id}`,
    accessed: '2026-08-25',
    verification,
    claimIds: [claimId],
  };
}

function reviewerFor(prefix: string): Types.ObjectId {
  return new Types.ObjectId(stableMeasurementHash({ fixture: FIXTURE_ID, prefix }).slice(0, 24));
}

function approvedGovernance(
  reviewerId: string,
  reviewedAt: string,
  conflictIds: readonly string[] = [],
): MeasurementDefinitionV1['governance'] {
  return {
    reviewStatus: 'approved',
    reviewedAt,
    reviewerId,
    reviewExpiresAt: REVIEW_EXPIRY,
    publishBlockers: [],
    conflictIds: [...conflictIds],
  };
}

function primaryDefinition(
  prefix: string,
  version: number,
  displayName: string,
  reviewerId: string,
  reviewedAt: string,
): MeasurementDefinitionV1 {
  const keys = p6FixtureKeys(prefix);
  const claimA = `${keys.primary}-claim-a`;
  const claimB = `${keys.primary}-claim-b`;
  const conflictGroup = `${keys.primary}-range-conflict`;
  const sources: MeasurementDefinitionV1['sources'] = [
    source(`${keys.primary}-source-a`, 'Synthetic Organization A', 'Synthetic evidence A', claimA),
    source(
      `${keys.primary}-source-b`,
      'Synthetic Organization B',
      'Synthetic evidence B',
      claimB,
      'source-provided',
    ),
  ];
  return {
    schemaVersion: 'measurement-definition.v1',
    key: keys.primary,
    version,
    status: 'approved',
    displayName,
    aliases: ['Synthetic marker alias', 'Two word marker'],
    kind: 'laboratory-biomarker',
    domainKeys: ['synthetic-domain'],
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
        sourceClaimIds: [claimA],
      },
    ],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
      soft: { min: 1, max: 90, minInclusive: true, maxInclusive: true },
      displayDecimals: 1,
    },
    referenceRanges: [
      {
        id: `${keys.primary}-range-a`,
        label: 'Organization A interval',
        unit: 'mg/L',
        interval: { min: 2, max: 8, minInclusive: true, maxInclusive: false },
        context: {
          specimen: 'Synthetic serum',
          population: 'Synthetic adult fixture population',
          method: 'Synthetic method A',
          fastingStatus: 'fasting',
        },
        interpretation: 'Synthetic range for interface testing only.',
        interpretationOnly: true,
        sourceClaimIds: [claimA],
        conflictGroup,
        reviewExpiresAt: REVIEW_EXPIRY,
      },
      {
        id: `${keys.primary}-range-b`,
        label: 'Organization B interval',
        unit: 'mg/L',
        interval: { min: 3, max: 9, minInclusive: false, maxInclusive: true },
        context: {
          specimen: 'Synthetic plasma',
          population: 'Synthetic adult fixture population',
          method: 'Synthetic method B',
          sampleTiming: 'Morning fixture sample',
        },
        interpretation: 'A deliberately different synthetic range; it must remain separate.',
        interpretationOnly: true,
        sourceClaimIds: [claimB],
        conflictGroup,
        reviewExpiresAt: REVIEW_EXPIRY,
      },
    ],
    description: {
      whatItMeasures: 'A nonclinical synthetic marker used to verify the biomarker library.',
      whyItMatters: 'It proves that reviewed descriptions and evidence render without scoring.',
      collectionNotes: 'Use only for automated P6 acceptance.',
      limitations: 'This synthetic marker has no medical meaning.',
    },
    sources,
    governance: approvedGovernance(reviewerId, reviewedAt, [conflictGroup]),
  };
}

function relatedDefinition(
  prefix: string,
  reviewerId: string,
  reviewedAt: string,
): MeasurementDefinitionV1 {
  const keys = p6FixtureKeys(prefix);
  const claimId = `${keys.related}-claim`;
  return {
    schemaVersion: 'measurement-definition.v1',
    key: keys.related,
    version: 1,
    status: 'approved',
    displayName: 'Related synthetic marker',
    aliases: ['Companion marker'],
    kind: 'laboratory-biomarker',
    domainKeys: ['synthetic-domain'],
    valueType: 'number',
    canonicalUnit: { code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' },
    acceptedUnits: [{ code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' }],
    conversions: [],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: [],
    description: {
      whatItMeasures: 'A second nonclinical marker in the same synthetic domain.',
      limitations: 'No universal reviewed range exists for this synthetic fixture.',
    },
    sources: [
      source(`${keys.related}-source`, 'Synthetic Organization C', 'Synthetic evidence C', claimId),
    ],
    governance: approvedGovernance(reviewerId, reviewedAt),
  };
}

function hiddenDefinition(
  prefix: string,
  key: string,
  displayName: string,
  status: 'draft' | 'retired',
): MeasurementDefinitionV1 {
  const claimId = `${key}-claim`;
  return {
    schemaVersion: 'measurement-definition.v1',
    key,
    version: 1,
    status,
    displayName,
    kind: 'laboratory-biomarker',
    domainKeys: ['synthetic-domain'],
    valueType: 'number',
    canonicalUnit: { code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' },
    acceptedUnits: [{ code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' }],
    conversions: [],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: [],
    description: {
      whatItMeasures: `A hidden ${status} nonclinical marker for visibility tests.`,
      limitations: 'This synthetic marker has no medical meaning.',
    },
    sources: [
      source(
        `${key}-source`,
        'Synthetic Unreviewed Organization',
        `Synthetic ${status} source`,
        claimId,
        'needs-verification',
      ),
    ],
    governance: {
      reviewStatus: status === 'retired' ? 'expired' : 'unreviewed',
      reviewedAt: null,
      reviewerId: null,
      publishBlockers: [`fixture-${status}-not-publishable`],
      legacyRecordRefs: [`${FIXTURE_ID}:${prefix}`],
    },
  };
}

function fixtureProvenance(prefix: string, key: string): Record<string, unknown> {
  return {
    fixture: FIXTURE_ID,
    fixturePrefix: prefix,
    fixtureKey: key,
    protectedCanary: {
      formula: 'must-not-be-public()',
      governance: 'must-not-be-public',
      privateReviewerId: 'must-not-be-public',
    },
  };
}

function assertCanonicalDefinition(definition: MeasurementDefinitionV1): void {
  const result = validateMeasurementDefinitionStructure(definition);
  if (!result.valid) {
    throw new Error(
      `Invalid P6 canonical fixture ${definition.key}@${definition.version}: ${result.findings
        .map((finding) => `${finding.instancePath || '$'} ${finding.message}`)
        .join('; ')}`,
    );
  }
}

function measurementEnvelope(
  prefix: string,
  definition: MeasurementDefinitionV1,
  envelopeStatus: 'draft' | 'verified' | 'retired',
  reviewer?: Types.ObjectId,
  verifiedAt?: Date,
): Record<string, unknown> {
  assertCanonicalDefinition(definition);
  const definitionHash = stableMeasurementHash(definition);
  const envelope: Record<string, unknown> = {
    key: definition.key,
    revision: definition.version,
    status: envelopeStatus,
    displayName: definition.displayName,
    kind: 'biomarker',
    canonicalUnit: definition.canonicalUnit.code,
    definition,
    definitionHash,
    sources: definition.sources,
    migrationProvenance: fixtureProvenance(prefix, definition.key),
  };
  if (envelopeStatus === 'verified') {
    if (!reviewer || !verifiedAt) throw new Error('Verified fixtures require review evidence.');
    const reviewedAt = verifiedAt.toISOString();
    envelope.reviewedBy = reviewer;
    envelope.verifiedAt = verifiedAt;
    envelope.reviewHash = measurementReviewHash({
      definitionHash,
      sources: definition.sources,
      reviewerId: reviewer.toString(),
      reviewedAt,
    });
  }
  if (envelopeStatus === 'retired') envelope.retiredAt = PUBLISHED_AT;

  const consistencyIssue = measurementEnvelopeConsistencyIssue(envelope);
  if (consistencyIssue) throw new Error(`${definition.key}: ${consistencyIssue}`);
  if (envelopeStatus === 'verified' && !isApprovedMeasurementEnvelope(envelope, PUBLISHED_AT)) {
    throw new Error(`${definition.key}: approved envelope verification failed.`);
  }
  return envelope;
}

export function createP6CalculatorPayload(
  prefix: string,
  biomarkerKey: string,
  measurementRevisionIds: readonly string[],
): Record<string, unknown> {
  const slug = p6FixtureKeys(prefix).calculator;
  const timestamp = REVIEWED_AT;
  const payload: Record<string, unknown> = {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: slug,
    name: fixtureCalculatorName(prefix),
    version: 1,
    status: 'approved',
    engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
    shortDescription: 'A temporary nonclinical calculator used only to verify P6 interlinks.',
    disclaimers: ['Synthetic fixture only. It provides no medical advice or diagnosis.'],
    parameters: [
      {
        key: 'markerValue',
        label: 'Synthetic marker value',
        group: 'marker',
        biomarkerKey,
        inputType: 'number',
        unit: { canonical: 'mg/L' },
        validation: { required: true, min: 0, max: 100 },
        missingPolicy: 'block',
        order: 1,
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
    domains: [{ key: 'fixture', label: 'Fixture', weight: 1, parameterKeys: ['markerValue'] }],
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
      contentId: `${slug}-content`,
      version: 1,
      locale: 'en-IN',
      slug,
      title: fixtureCalculatorName(prefix),
      summary: 'Reviewed nonclinical content used only for automated P6 checks.',
      blocks: [
        {
          id: 'fixture-notice',
          type: 'markdown',
          markdown: 'This temporary page contains only synthetic nonclinical test logic.',
        },
      ],
      claims: [],
      citations: [],
      authorship: {
        contributors: [{ id: 'p6-automation', displayName: 'P6 automation', role: 'author' }],
        ownerId: 'p6-automation',
        createdAt: timestamp,
        updatedAt: timestamp,
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
        metaTitle: fixtureCalculatorName(prefix),
        metaDescription: 'Temporary nonclinical calculator fixture for P6 integration checks.',
        canonicalPath: `/c/${slug}`,
        robots: { index: false, follow: false },
        schemaTypes: ['WebPage'],
      },
      publication: {
        status: 'approved',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Created for an automated P6 integration check.',
      },
    },
    sources: [
      {
        type: 'internal',
        ref: `${FIXTURE_ID}:${prefix}`,
        title: 'P6 automated integration fixture',
        verification: 'source-provided',
        demoPoints: true,
      },
    ],
    governance: {
      clinicalStatus: 'not-applicable',
      sourceReviewStatus: 'not-applicable',
      discrepancyIds: [],
      publishBlockers: [],
      measurementRevisionIds: [...measurementRevisionIds],
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
  const validation = validateCalculatorVersion(payload, `${slug}.fixture.json`);
  if (!validation.publishEligible) {
    const findings = [
      ...validation.structural.findings,
      ...validation.semantic.findings,
      ...validation.clinical.findings,
      ...validation.publish.findings,
    ];
    throw new Error(
      `Invalid P6 calculator fixture: ${findings
        .map((finding) => `${finding.id} ${finding.jsonPath}: ${finding.message}`)
        .join('; ')}`,
    );
  }
  return payload;
}

export function canonicalP6CalculatorVersionHash(
  slug: string,
  version: number,
  payload: Record<string, unknown>,
): string {
  return stableMeasurementHash({ slug, version, payload });
}

export function createP6MeasurementSnapshot(
  revisionId: string,
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  return {
    measurementRevisionId: revisionId,
    key: envelope.key,
    revision: envelope.revision,
    definitionHash: envelope.definitionHash,
    definition: envelope.definition,
    sources: envelope.sources,
  };
}

async function readFixtureFootprint(
  prefix: string,
  session?: ClientSession,
): Promise<FixtureFootprint> {
  const keys = p6FixtureKeys(prefix);
  const measurementKeys = [keys.primary, keys.related, keys.draft, keys.retired];
  const measurementQuery = MeasurementRevisionModel.find({ key: { $in: measurementKeys } }).lean();
  const calculatorQuery = CalculatorModel.find({ slug: keys.calculator }).lean();
  const versionQuery = CalculatorVersionModel.find({ calculatorSlug: keys.calculator }).lean();
  if (session) {
    measurementQuery.session(session);
    calculatorQuery.session(session);
    versionQuery.session(session);
  }
  const [measurements, calculators, versions] = await Promise.all([
    measurementQuery,
    calculatorQuery,
    versionQuery,
  ]);
  return {
    measurements: measurements as unknown as Record<string, unknown>[],
    calculators: calculators as unknown as Record<string, unknown>[],
    versions: versions as unknown as Record<string, unknown>[],
  };
}

function footprintIsEmpty(footprint: FixtureFootprint): boolean {
  return (
    footprint.measurements.length === 0 &&
    footprint.calculators.length === 0 &&
    footprint.versions.length === 0
  );
}

function objectIdEquals(left: unknown, right: unknown): boolean {
  return left instanceof Types.ObjectId && right instanceof Types.ObjectId && left.equals(right);
}

export function p6FixtureOwnershipIssue(
  prefix: string,
  footprint: FixtureFootprint,
): string | undefined {
  const keys = p6FixtureKeys(prefix);
  if (footprintIsEmpty(footprint)) return undefined;
  if (
    footprint.measurements.length !== 5 ||
    footprint.calculators.length !== 1 ||
    footprint.versions.length !== 1
  ) {
    return 'Fixture footprint is partial or has unexpected cardinality.';
  }
  const expectedMeasurementKeys = new Set([
    `${keys.primary}:1`,
    `${keys.primary}:2`,
    `${keys.related}:1`,
    `${keys.draft}:1`,
    `${keys.retired}:1`,
  ]);
  for (const measurement of footprint.measurements) {
    const identity = `${String(measurement.key)}:${String(measurement.revision)}`;
    const provenance = measurement.migrationProvenance as Record<string, unknown> | undefined;
    if (
      !expectedMeasurementKeys.delete(identity) ||
      provenance?.fixture !== FIXTURE_ID ||
      provenance.fixturePrefix !== prefix ||
      provenance.fixtureKey !== measurement.key
    ) {
      return 'A measurement record is not owned by this fixture run.';
    }
  }
  if (expectedMeasurementKeys.size > 0) return 'Expected measurement revisions are missing.';

  const calculator = footprint.calculators[0]!;
  const version = footprint.versions[0]!;
  const payload = version.payload as Record<string, unknown> | undefined;
  const calculatorId = calculator._id as Types.ObjectId | undefined;
  const versionId = version._id as Types.ObjectId | undefined;
  const versionCalculatorId = version.calculatorId as Types.ObjectId | undefined;
  const currentVersionId = calculator.currentVersionId as Types.ObjectId | undefined;
  if (
    calculator.slug !== keys.calculator ||
    calculator.name !== fixtureCalculatorName(prefix) ||
    !calculatorId ||
    !versionId ||
    !objectIdEquals(versionCalculatorId, calculatorId) ||
    !objectIdEquals(currentVersionId, versionId) ||
    version.calculatorSlug !== keys.calculator ||
    version.version !== 1 ||
    version.status !== 'published' ||
    !payload ||
    payload.calculatorSlug !== keys.calculator ||
    payload.name !== fixtureCalculatorName(prefix) ||
    version.versionHash !== canonicalP6CalculatorVersionHash(keys.calculator, 1, payload)
  ) {
    return 'Calculator identity, pointer, payload, or canonical hash is not fixture-owned.';
  }

  const revisionIds = version.measurementRevisionIds;
  const snapshots = version.measurementSnapshots;
  if (!Array.isArray(revisionIds) || revisionIds.length !== 1 || !Array.isArray(snapshots)) {
    return 'Calculator measurement revision references are not fixture-owned.';
  }
  const current = footprint.measurements.find(
    (measurement) => measurement.key === keys.primary && measurement.revision === 2,
  );
  if (!current || String(current._id) !== revisionIds[0]) {
    return 'Calculator does not reference the current fixture measurement revision.';
  }
  const expectedSnapshot = createP6MeasurementSnapshot(String(current._id), current);
  if (snapshots.length !== 1 || !stableMeasurementEqual(snapshots[0], expectedSnapshot)) {
    return 'Calculator measurement snapshot is incomplete or does not match its revision.';
  }
  const governance = payload.governance as Record<string, unknown> | undefined;
  if (
    !Array.isArray(governance?.measurementRevisionIds) ||
    !stableMeasurementEqual(governance.measurementRevisionIds, revisionIds)
  ) {
    return 'Calculator payload governance does not bind the actual measurement revision.';
  }
  return undefined;
}

async function assertNoFixtureCollisions(prefix: string, session?: ClientSession): Promise<void> {
  const footprint = await readFixtureFootprint(prefix, session);
  if (!footprintIsEmpty(footprint)) {
    throw new Error(`Refusing to overwrite an existing P6 fixture footprint for ${prefix}.`);
  }
}

async function assertOwnedCompleteFootprint(
  prefix: string,
  session?: ClientSession,
): Promise<FixtureFootprint> {
  const footprint = await readFixtureFootprint(prefix, session);
  const issue = p6FixtureOwnershipIssue(prefix, footprint);
  if (issue || footprintIsEmpty(footprint)) {
    throw new Error(
      `Refusing unsafe P6 fixture operation for ${prefix}: ${issue ?? 'missing footprint'}`,
    );
  }
  return footprint;
}

export async function cleanupP6Fixture(
  prefix: string,
  authorization: P6FixtureWriteAuthorization,
): Promise<void> {
  assertFixturePrefix(prefix);
  assertFixtureAuthorization(prefix, authorization);
  const keys = p6FixtureKeys(prefix);
  try {
    await withTransaction(async (session) => {
      const footprint = await readFixtureFootprint(prefix, session);
      if (footprintIsEmpty(footprint)) return;
      const issue = p6FixtureOwnershipIssue(prefix, footprint);
      if (issue) throw new Error(`Refusing to delete an unowned P6 fixture: ${issue}`);
      const versionDelete = await CalculatorVersionModel.deleteMany({
        calculatorSlug: keys.calculator,
      }).session(session);
      const calculatorDelete = await CalculatorModel.deleteMany({ slug: keys.calculator }).session(
        session,
      );
      const measurementDelete = await MeasurementRevisionModel.deleteMany({
        key: { $in: [keys.primary, keys.related, keys.draft, keys.retired] },
      }).session(session);
      if (
        versionDelete.deletedCount !== 1 ||
        calculatorDelete.deletedCount !== 1 ||
        measurementDelete.deletedCount !== 5
      ) {
        throw new Error('P6 cleanup deleted an unexpected number of owned records.');
      }
      if (!footprintIsEmpty(await readFixtureFootprint(prefix, session))) {
        throw new Error('P6 cleanup transaction did not remove its complete fixture footprint.');
      }
    });
  } catch (error) {
    if (!footprintIsEmpty(await readFixtureFootprint(prefix))) throw error;
  }
  if (!footprintIsEmpty(await readFixtureFootprint(prefix))) {
    throw new Error('P6 cleanup postcondition failed; fixture records remain.');
  }
}

async function dropAuthorizedTemporaryDatabaseIfEmpty(
  prefix: string,
  authorization: P6FixtureWriteAuthorization,
): Promise<void> {
  assertFixtureAuthorization(prefix, authorization);
  if (!footprintIsEmpty(await readFixtureFootprint(prefix))) {
    throw new Error('Refusing to drop a non-empty P6 temporary database.');
  }
  const database = connection.db;
  if (
    connection.name !== p6TemporaryDatabaseName(prefix) ||
    database?.databaseName !== authorization.databaseName
  ) {
    throw new Error('Refusing to drop a database outside the authorized P6 temporary namespace.');
  }
  await database.dropDatabase();
}

export async function seedP6Fixture(
  prefix: string,
  authorization: P6FixtureWriteAuthorization,
): Promise<void> {
  assertFixturePrefix(prefix);
  assertFixtureAuthorization(prefix, authorization);
  const keys = p6FixtureKeys(prefix);
  const records = createP6MeasurementEnvelopes(prefix);

  await assertNoFixtureCollisions(prefix);
  let transactionStarted = false;
  try {
    await withTransaction(async (session) => {
      await assertNoFixtureCollisions(prefix, session);
      transactionStarted = true;
      const measurementDocuments = records.map((record) => new MeasurementRevisionModel(record));
      for (const document of measurementDocuments) await document.save({ session });
      const current = measurementDocuments[1]!;
      const measurementRevisionIds = [current._id.toString()];
      const measurementSnapshots = [
        createP6MeasurementSnapshot(current._id.toString(), records[1]!),
      ];
      const payload = createP6CalculatorPayload(prefix, keys.primary, measurementRevisionIds);

      const calculator = new CalculatorModel({
        slug: keys.calculator,
        name: fixtureCalculatorName(prefix),
        status: 'published',
      });
      await calculator.save({ session });
      const versionHash = canonicalP6CalculatorVersionHash(keys.calculator, 1, payload);
      const version = new CalculatorVersionModel({
        calculatorId: calculator._id,
        calculatorSlug: keys.calculator,
        version: 1,
        status: 'published',
        engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
        payload,
        measurementRevisionIds,
        measurementSnapshots,
        sourceHash: stableMeasurementHash(payload.sources),
        logicHash: stableMeasurementHash({
          scoringRules: payload.scoringRules,
          formulas: payload.formulas,
          domains: payload.domains,
        }),
        contentHash: stableMeasurementHash(payload.content),
        reviewHash: stableMeasurementHash({
          payload,
          measurementRevisionIds,
          measurementSnapshots,
          testCases: payload.testCases,
        }),
        versionHash,
        publishedAt: PUBLISHED_AT,
        immutableAt: PUBLISHED_AT,
      });
      await version.save({ session });
      calculator.currentVersionId = version._id;
      await calculator.save({ session });
      await assertOwnedCompleteFootprint(prefix, session);
    });
  } catch (error) {
    if (!transactionStarted) throw error;
    return rethrowAfterP6UnknownCommit(error, () => cleanupP6Fixture(prefix, authorization));
  }
  await assertOwnedCompleteFootprint(prefix);
}

export function createP6MeasurementEnvelopes(prefix: string): readonly Record<string, unknown>[] {
  const keys = p6FixtureKeys(prefix);
  const reviewer = reviewerFor(prefix);
  const oldReviewedAt = new Date('2026-08-24T00:00:00.000Z');
  const currentReviewedAt = new Date(REVIEWED_AT);
  const definitions = [
    primaryDefinition(
      prefix,
      1,
      'Older synthetic marker revision',
      reviewer.toString(),
      oldReviewedAt.toISOString(),
    ),
    primaryDefinition(
      prefix,
      2,
      'Synthetic evidence marker',
      reviewer.toString(),
      currentReviewedAt.toISOString(),
    ),
    relatedDefinition(prefix, reviewer.toString(), currentReviewedAt.toISOString()),
    hiddenDefinition(prefix, keys.draft, 'Hidden draft synthetic marker', 'draft'),
    hiddenDefinition(prefix, keys.retired, 'Hidden retired synthetic marker', 'retired'),
  ];
  return [
    measurementEnvelope(prefix, definitions[0]!, 'verified', reviewer, oldReviewedAt),
    measurementEnvelope(prefix, definitions[1]!, 'verified', reviewer, currentReviewedAt),
    measurementEnvelope(prefix, definitions[2]!, 'verified', reviewer, currentReviewedAt),
    measurementEnvelope(prefix, definitions[3]!, 'draft'),
    measurementEnvelope(prefix, definitions[4]!, 'retired'),
  ];
}

export async function rethrowAfterP6UnknownCommit(
  originalError: unknown,
  cleanup: () => Promise<void>,
): Promise<never> {
  try {
    await cleanup();
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      'P6 seed failed and its unknown-commit cleanup could not be verified.',
    );
  }
  throw originalError;
}

async function main(): Promise<void> {
  const [command, prefix, ...arguments_] = process.argv.slice(2);
  if (command !== 'seed' && command !== 'cleanup') throw new Error('Use seed or cleanup.');
  assertFixturePrefix(prefix);
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (!environment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  const authorization = authorizeP6FixtureWrites(environment, prefix, arguments_);
  await connectDatabase({ environment });
  try {
    if (command === 'cleanup') {
      await cleanupP6Fixture(prefix, authorization);
      await dropAuthorizedTemporaryDatabaseIfEmpty(prefix, authorization);
    } else {
      await ensureMeasurementRevisionIndexes();
      await seedP6Fixture(prefix, authorization);
    }
    console.log(
      JSON.stringify({
        status: 'ok',
        action: command,
        database: authorization.databaseName,
        prefix,
        ...p6FixtureKeys(prefix),
      }),
    );
  } catch (error) {
    if (command === 'seed') {
      try {
        if (footprintIsEmpty(await readFixtureFootprint(prefix))) {
          await dropAuthorizedTemporaryDatabaseIfEmpty(prefix, authorization);
        }
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'P6 seed command failed and empty-database cleanup could not be verified.',
        );
      }
    }
    throw error;
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
