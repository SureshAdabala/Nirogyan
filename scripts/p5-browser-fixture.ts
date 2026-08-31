import {
  type MeasurementDefinitionV1,
  validateMeasurementDefinitionStructure,
} from '@niro/contracts';
import { Types, type ClientSession } from 'mongoose';

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
import { AssessmentModel } from '../apps/server/src/persistence/models/assessment';
import { CalculatorModel } from '../apps/server/src/persistence/models/calculator';
import { CalculatorVersionModel } from '../apps/server/src/persistence/models/calculator-version';
import {
  ensureMeasurementRevisionIndexes,
  MeasurementRevisionModel,
} from '../apps/server/src/persistence/models/measurement-revision';
import { ResultModel } from '../apps/server/src/persistence/models/result';
import { withTransaction } from '../apps/server/src/persistence/transactions';

export const P5_FIXTURE_ID = 'p5-local-browser-fixture-v2';
export const P5_WRITE_OPT_IN = '--allow-development-fixture-write';
const REVIEWED_AT = '2026-08-30T00:00:00.000Z';
const REVIEW_EXPIRES_AT = '2099-12-31T00:00:00.000Z';

type JsonRecord = Record<string, unknown>;

export interface P5FixtureFootprint {
  readonly calculators: readonly JsonRecord[];
  readonly versions: readonly JsonRecord[];
  readonly measurements: readonly JsonRecord[];
}

export function assertFixtureSlug(value: string | undefined): asserts value is string {
  if (!value || !/^p5-ui-[a-z0-9-]{6,80}$/.test(value)) {
    throw new Error('Fixture slug must match p5-ui-[a-z0-9-]{6,80}.');
  }
}

function objectIdFor(slug: string, purpose: string): Types.ObjectId {
  assertFixtureSlug(slug);
  return new Types.ObjectId(
    stableMeasurementHash({ fixture: P5_FIXTURE_ID, slug, purpose }).slice(0, 24),
  );
}

export function p5FixtureIdentity(slug: string) {
  assertFixtureSlug(slug);
  return {
    calculatorId: objectIdFor(slug, 'calculator'),
    versionId: objectIdFor(slug, 'calculator-version'),
    measurementId: objectIdFor(slug, 'measurement-revision'),
    reviewerId: objectIdFor(slug, 'nonclinical-fixture-reviewer'),
    measurementKey: slug + '-marker',
    versionHash: stableMeasurementHash({ fixture: P5_FIXTURE_ID, slug, version: 1 }),
  } as const;
}

export function assertSafeP5FixtureEnvironment(
  environment: Pick<AppEnvironment, 'nodeEnv' | 'mongoDbName' | 'deploymentEnvironment'>,
): void {
  if (environment.nodeEnv !== 'development') {
    throw new Error('The persistent P5 demo fixture is allowed only in development mode.');
  }
  if (environment.deploymentEnvironment !== undefined) {
    throw new Error(
      'The persistent P5 demo fixture is local-only; staging and production deployments are refused.',
    );
  }
  if (environment.mongoDbName !== 'niro_dev') {
    throw new Error('The persistent P5 demo fixture is allowed only in the niro_dev database.');
  }
}

export function createP5MeasurementDefinition(
  slug: string,
  reviewerId = p5FixtureIdentity(slug).reviewerId.toString(),
): MeasurementDefinitionV1 {
  const { measurementKey } = p5FixtureIdentity(slug);
  const conversionClaim = slug + '-conversion';
  return {
    schemaVersion: 'measurement-definition.v1',
    key: measurementKey,
    version: 1,
    status: 'approved',
    displayName: 'Synthetic interface marker (nonclinical demo)',
    aliases: ['Synthetic nonclinical demo marker'],
    kind: 'laboratory-biomarker',
    domainKeys: ['synthetic-demo'],
    valueType: 'number',
    canonicalUnit: { code: 'ratio', dimension: 'dimensionless', display: 'ratio' },
    acceptedUnits: [
      { code: 'ratio', dimension: 'dimensionless', display: 'ratio' },
      { code: '%', dimension: 'dimensionless', display: '%' },
    ],
    conversions: [
      {
        kind: 'affine',
        fromUnit: '%',
        toUnit: 'ratio',
        factor: 0.01,
        offset: 0,
        sourceClaimIds: [conversionClaim],
      },
    ],
    inputBounds: {
      hard: { min: 0, max: 20, minInclusive: true, maxInclusive: true },
      soft: { min: 0, max: 15, minInclusive: true, maxInclusive: true },
      displayDecimals: 2,
      note: 'Synthetic interface bounds with no clinical meaning.',
    },
    referenceRanges: [],
    description: {
      whatItMeasures:
        'A synthetic dimensionless value used only to demonstrate the generic biomarker interface.',
      whyItMatters:
        'It proves that a nonclinical development fixture can render without publishing clinical drafts.',
      collectionNotes: 'No specimen is collected. Enter synthetic test data only.',
      limitations:
        'This marker has no physiological, diagnostic, screening, treatment, or medical meaning.',
    },
    sources: [
      {
        id: slug + '-source',
        type: 'internal',
        org: 'Athnect development fixture',
        title: 'Synthetic P5 public-interface fixture definition',
        ref: 'scripts/p5-browser-fixture.ts#createP5MeasurementDefinition',
        accessed: '2026-08-30',
        verification: 'source-provided',
        claimIds: [conversionClaim],
        note: 'Nonclinical development evidence only; not an authoritative medical source.',
      },
    ],
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

export function createP5MeasurementEnvelope(slug: string): JsonRecord {
  const identity = p5FixtureIdentity(slug);
  const definition = createP5MeasurementDefinition(slug, identity.reviewerId.toString());
  const structure = validateMeasurementDefinitionStructure(definition);
  if (!structure.valid) {
    throw new Error(
      'Invalid P5 measurement fixture: ' +
        structure.findings
          .map((finding) => (finding.instancePath || '$') + ' ' + finding.message)
          .join('; '),
    );
  }
  const definitionHash = stableMeasurementHash(definition);
  const envelope: JsonRecord = {
    _id: identity.measurementId,
    key: identity.measurementKey,
    revision: 1,
    status: 'verified',
    displayName: definition.displayName,
    kind: 'biomarker',
    canonicalUnit: definition.canonicalUnit.code,
    definition,
    definitionHash,
    sources: definition.sources,
    migrationProvenance: {
      fixture: P5_FIXTURE_ID,
      fixtureSlug: slug,
      purpose: 'persistent-development-only-public-interface-demo',
      clinicalUse: false,
    },
    reviewedBy: identity.reviewerId,
    verifiedAt: new Date(REVIEWED_AT),
    reviewHash: measurementReviewHash({
      definitionHash,
      sources: definition.sources,
      reviewerId: identity.reviewerId.toString(),
      reviewedAt: REVIEWED_AT,
    }),
  };
  const issue = measurementEnvelopeConsistencyIssue(envelope);
  if (issue) throw new Error('Invalid P5 measurement envelope: ' + issue);
  if (!isApprovedMeasurementEnvelope(envelope)) {
    throw new Error(
      'P5 measurement fixture is not eligible for the fail-closed public projection.',
    );
  }
  return envelope;
}

export function fixturePayload(slug: string): JsonRecord {
  const { measurementKey } = p5FixtureIdentity(slug);
  return {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: slug,
    name: 'Synthetic wellness demo',
    version: 1,
    status: 'published',
    shortDescription: 'A temporary, nonclinical fixture for end-to-end interface verification.',
    disclaimers: [
      'Synthetic test data only. This fixture is not a medical device and provides no diagnosis.',
    ],
    parameters: [
      {
        key: 'age',
        label: 'Synthetic age value',
        group: 'profile',
        inputType: 'number',
        unit: { canonical: 'years' },
        validation: { required: true, min: 0, max: 120, integer: true, softMax: 110 },
        missingPolicy: 'block',
        order: 1,
        helpText: 'Enter a whole number from 0 to 120.',
      },
      {
        key: 'activity',
        label: 'Synthetic activity pattern',
        group: 'profile',
        inputType: 'select',
        options: [
          { value: 'regular', label: 'Regular' },
          { value: 'limited', label: 'Limited' },
        ],
        validation: { required: true },
        missingPolicy: 'block',
        order: 2,
      },
      {
        key: 'hasLab',
        label: 'Do you have the optional synthetic measurement?',
        group: 'measurements',
        inputType: 'boolean',
        missingPolicy: 'zero-points',
        order: 3,
      },
      {
        key: 'labValue',
        label: 'Synthetic interface marker',
        group: 'measurements',
        biomarkerKey: measurementKey,
        inputType: 'number',
        unit: { canonical: 'ratio', allowed: [{ code: '%', factor: 0.01 }] },
        validation: { min: 0, max: 20, softMax: 15 },
        missingPolicy: 'exclude-from-group',
        visibility: { param: 'hasLab', op: 'eq', value: true },
        order: 4,
        helpText: 'This dimensionless conversion is synthetic and tests the generic UI only.',
      },
    ],
    scoringRules: [
      {
        parameterKey: 'age',
        contexts: [
          {
            when: null,
            bands: [
              { max: 50, points: 0 },
              { min: 50, points: 1 },
            ],
          },
        ],
      },
      {
        parameterKey: 'activity',
        optionPoints: [
          { value: 'regular', points: 0 },
          { value: 'limited', points: 2 },
        ],
      },
      {
        parameterKey: 'hasLab',
        optionPoints: [
          { value: false, points: 0 },
          { value: true, points: 0 },
        ],
      },
      {
        parameterKey: 'labValue',
        contexts: [
          {
            when: null,
            bands: [
              { max: 10, points: 0 },
              { min: 10, points: 1 },
            ],
          },
        ],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    domains: [
      {
        key: 'questionnaire',
        label: 'Questionnaire',
        weight: 0.6,
        parameterKeys: ['age', 'activity', 'hasLab'],
      },
      {
        key: 'measurements',
        label: 'Measurements',
        weight: 0.4,
        parameterKeys: ['labValue'],
      },
    ],
    domainAggregationPolicy: {
      zeroDenominator: 'unscored',
      missingDomainPolicy: 'exclude-and-renormalize',
      negativeDomainPolicy: 'preserve',
    },
    resultCategories: {
      scale: { min: 0, max: 4, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        {
          label: 'Lower synthetic score',
          max: 2,
          color: '#26734D',
          message: 'The synthetic inputs produced the lower test category.',
          recommendation: 'No medical action is associated with this test fixture.',
        },
        {
          label: 'Higher synthetic score',
          min: 2,
          color: '#9A5B00',
          message: 'The synthetic inputs produced the higher test category.',
          recommendation: 'No medical action is associated with this test fixture.',
        },
      ],
    },
    uiConfig: {
      theme: { accent: '#0D5CAB' },
      steps: [
        { key: 'profile', title: 'Profile', parameterGroups: ['profile'] },
        {
          key: 'measurements',
          title: 'Optional measurement',
          parameterGroups: ['measurements'],
        },
      ],
      result: {
        layout: [
          'score-gauge',
          'category',
          'key-contributors',
          'domain-breakdown',
          'biomarker-details',
          'recommendations',
        ],
      },
    },
    content: {
      schemaVersion: 'content-page.v1',
      contentId: slug + '-content',
      version: 1,
      locale: 'en-IN',
      slug,
      title: 'Synthetic wellness demo',
      summary: 'A nonclinical development fixture used only for generic interface checks.',
      blocks: [
        {
          id: 'intro',
          type: 'markdown',
          markdown:
            '## About this fixture\n\nThis page proves that structured content and a generic calculator can render together.',
        },
        {
          id: 'faq',
          type: 'faq',
          items: [
            {
              id: 'purpose',
              question: 'Is this a real health assessment?',
              answerMarkdown: 'No. It contains only synthetic test logic.',
            },
          ],
        },
        { id: 'calculator', type: 'calculator-embed', calculatorSlug: slug },
        {
          id: 'disclaimer',
          type: 'disclaimer',
          markdown: 'Do not use this synthetic fixture for health decisions.',
        },
      ],
      claims: [],
      citations: [],
      authorship: {
        contributors: [{ id: 'automation', displayName: 'P5 automation', role: 'editor' }],
        ownerId: 'automation',
        createdAt: REVIEWED_AT,
        updatedAt: REVIEWED_AT,
      },
      medicalReview: {
        status: 'not-applicable',
        scope: 'not-applicable',
        reviewerId: null,
        reviewedAt: null,
        nextReviewAt: null,
        decisionNote: 'Synthetic nonclinical development fixture.',
      },
      seo: {
        metaTitle: 'Synthetic wellness demo',
        metaDescription: 'Temporary nonclinical calculator interface fixture.',
        canonicalPath: '/c/' + slug,
        robots: { index: false, follow: false },
        schemaTypes: ['WebPage', 'FAQPage', 'BreadcrumbList'],
      },
      publication: {
        status: 'published',
        publishedAt: REVIEWED_AT,
        retiredAt: null,
        changelog: 'Synthetic P5 browser fixture.',
      },
    },
  };
}

function measurementSnapshot(envelope: JsonRecord): JsonRecord {
  return {
    measurementRevisionId: String(envelope._id),
    key: envelope.key,
    revision: envelope.revision,
    definitionHash: envelope.definitionHash,
    definition: envelope.definition,
    sources: envelope.sources,
  };
}

function idString(value: unknown): string {
  return value instanceof Types.ObjectId ? value.toString() : String(value ?? '');
}

export function p5FixtureOwnershipIssue(
  slug: string,
  footprint: P5FixtureFootprint,
): string | undefined {
  const identity = p5FixtureIdentity(slug);
  if (
    footprint.calculators.length !== 1 ||
    footprint.versions.length !== 1 ||
    footprint.measurements.length !== 1
  ) {
    return 'P5 fixture footprint cardinality is not exactly one calculator, version, and measurement.';
  }
  const calculator = footprint.calculators[0]!;
  const version = footprint.versions[0]!;
  const measurement = footprint.measurements[0]!;
  const expectedEnvelope = createP5MeasurementEnvelope(slug);
  if (
    idString(calculator._id) !== identity.calculatorId.toString() ||
    calculator.slug !== slug ||
    calculator.name !== 'Synthetic wellness demo' ||
    calculator.status !== 'published' ||
    idString(calculator.currentVersionId) !== identity.versionId.toString()
  ) {
    return 'The calculator record is not exactly owned by the P5 development fixture.';
  }
  if (
    idString(version._id) !== identity.versionId.toString() ||
    idString(version.calculatorId) !== identity.calculatorId.toString() ||
    version.calculatorSlug !== slug ||
    version.version !== 1 ||
    version.status !== 'published' ||
    version.versionHash !== identity.versionHash ||
    !stableMeasurementEqual(version.payload, fixturePayload(slug)) ||
    !stableMeasurementEqual(version.measurementRevisionIds, [identity.measurementId.toString()]) ||
    !stableMeasurementEqual(version.measurementSnapshots, [measurementSnapshot(expectedEnvelope)])
  ) {
    return 'The calculator version is not exactly owned by the P5 development fixture.';
  }
  if (
    idString(measurement._id) !== identity.measurementId.toString() ||
    measurement.key !== identity.measurementKey ||
    measurement.revision !== 1 ||
    measurement.status !== 'verified' ||
    !stableMeasurementEqual(measurement.definition, expectedEnvelope.definition) ||
    !stableMeasurementEqual(measurement.sources, expectedEnvelope.sources) ||
    !stableMeasurementEqual(measurement.migrationProvenance, expectedEnvelope.migrationProvenance)
  ) {
    return 'The measurement record is not exactly owned by the P5 development fixture.';
  }
  return undefined;
}

async function readFootprint(slug: string, session?: ClientSession): Promise<P5FixtureFootprint> {
  const identity = p5FixtureIdentity(slug);
  const calculatorsQuery = CalculatorModel.find({ slug }).lean();
  const versionsQuery = CalculatorVersionModel.find({ calculatorSlug: slug }).lean();
  const measurementsQuery = MeasurementRevisionModel.find({
    $or: [{ _id: identity.measurementId }, { key: identity.measurementKey }],
  }).lean();
  if (session) {
    calculatorsQuery.session(session);
    versionsQuery.session(session);
    measurementsQuery.session(session);
  }
  const [calculators, versions, measurements] = await Promise.all([
    calculatorsQuery,
    versionsQuery,
    measurementsQuery,
  ]);
  return {
    calculators: calculators as unknown as JsonRecord[],
    versions: versions as unknown as JsonRecord[],
    measurements: measurements as unknown as JsonRecord[],
  };
}

function footprintEmpty(footprint: P5FixtureFootprint): boolean {
  return (
    footprint.calculators.length === 0 &&
    footprint.versions.length === 0 &&
    footprint.measurements.length === 0
  );
}

async function cleanup(slug: string): Promise<{ assessments: number; results: number }> {
  const footprint = await readFootprint(slug);
  if (footprintEmpty(footprint)) return { assessments: 0, results: 0 };
  const issue = p5FixtureOwnershipIssue(slug, footprint);
  if (issue) throw new Error(issue + ' Cleanup is refused.');
  const identity = p5FixtureIdentity(slug);
  return withTransaction(async (session) => {
    const [resultDeletion, assessmentDeletion] = await Promise.all([
      ResultModel.deleteMany({ calculatorSlug: slug }).session(session),
      AssessmentModel.deleteMany({ calculatorSlug: slug }).session(session),
    ]);
    await CalculatorVersionModel.deleteOne({ _id: identity.versionId }).session(session);
    await CalculatorModel.deleteOne({ _id: identity.calculatorId }).session(session);
    await MeasurementRevisionModel.deleteOne({
      _id: identity.measurementId,
      key: identity.measurementKey,
      'migrationProvenance.fixture': P5_FIXTURE_ID,
      'migrationProvenance.fixtureSlug': slug,
    }).session(session);
    return {
      assessments: assessmentDeletion.deletedCount,
      results: resultDeletion.deletedCount,
    };
  });
}

async function seed(slug: string): Promise<void> {
  const identity = p5FixtureIdentity(slug);
  if (!footprintEmpty(await readFootprint(slug))) {
    throw new Error('Refusing to overwrite an existing footprint for ' + slug + '.');
  }
  const envelope = createP5MeasurementEnvelope(slug);
  await withTransaction(async (session) => {
    if (!footprintEmpty(await readFootprint(slug, session))) {
      throw new Error('The ' + slug + ' fixture target changed before seed commit.');
    }
    await new MeasurementRevisionModel(envelope).save({ session });
    await new CalculatorModel({
      _id: identity.calculatorId,
      slug,
      name: 'Synthetic wellness demo',
      status: 'published',
      currentVersionId: identity.versionId,
    }).save({ session });
    await new CalculatorVersionModel({
      _id: identity.versionId,
      calculatorId: identity.calculatorId,
      calculatorSlug: slug,
      version: 1,
      status: 'published',
      engineSemanticVersion: '1.0.0',
      payload: fixturePayload(slug),
      measurementRevisionIds: [identity.measurementId.toString()],
      measurementSnapshots: [measurementSnapshot(envelope)],
      versionHash: identity.versionHash,
      publishedAt: new Date(REVIEWED_AT),
      immutableAt: new Date(REVIEWED_AT),
    }).save({ session });
  });
  const issue = p5FixtureOwnershipIssue(slug, await readFootprint(slug));
  if (issue) throw new Error('P5 seed verification failed: ' + issue);
}

async function main(): Promise<void> {
  const [command, slug, ...arguments_] = process.argv.slice(2);
  if (command !== 'seed' && command !== 'cleanup' && command !== 'inspect') {
    throw new Error('Use seed, cleanup, or inspect.');
  }
  assertFixtureSlug(slug);
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (!environment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  assertSafeP5FixtureEnvironment(environment);
  if (command !== 'inspect' && !arguments_.includes(P5_WRITE_OPT_IN)) {
    throw new Error('P5 fixture writes require the explicit ' + P5_WRITE_OPT_IN + ' opt-in.');
  }
  await connectDatabase({ environment });
  try {
    if (command === 'inspect') {
      const footprint = await readFootprint(slug);
      const issue = footprintEmpty(footprint)
        ? 'Fixture is absent.'
        : p5FixtureOwnershipIssue(slug, footprint);
      console.log(
        JSON.stringify({
          status: issue ? 'not-owned' : 'ok',
          action: 'inspect',
          database: environment.mongoDbName,
          slug,
          measurementKey: p5FixtureIdentity(slug).measurementKey,
          footprint: {
            calculators: footprint.calculators.length,
            versions: footprint.versions.length,
            measurements: footprint.measurements.length,
          },
          issue: issue ?? null,
        }),
      );
      return;
    }
    if (command === 'cleanup') {
      const deleted = await cleanup(slug);
      console.log(
        JSON.stringify({
          status: 'ok',
          action: 'cleanup',
          database: environment.mongoDbName,
          slug,
          deleted,
        }),
      );
      return;
    }
    await ensureMeasurementRevisionIndexes();
    await seed(slug);
    console.log(
      JSON.stringify({
        status: 'ok',
        action: 'seed',
        database: environment.mongoDbName,
        slug,
        measurementKey: p5FixtureIdentity(slug).measurementKey,
        fixtureOnly: true,
        clinicalUse: false,
      }),
    );
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
