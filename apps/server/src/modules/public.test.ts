import { describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { loadEnvironment } from '../config/env';
import {
  buildResultPresentation,
  buildBiomarkerCalculatorUsagePipeline,
  buildBiomarkerListPipeline,
  buildPublishedCalculatorPipeline,
  createCachedCatalogSource,
  createMongoAssessmentStore,
  createMongoLeadStore,
  type PublishedCalculatorRecord,
  type ResultPresentation,
} from './public';
import { measurementReviewHash, stableMeasurementHash } from './measurement-contract';

const config = {
  calculatorSlug: 'public-fixture',
  name: 'Public fixture',
  version: 1,
  shortDescription: 'A nonclinical test calculator.',
  disclaimers: ['For testing only.'],
  parameters: [
    {
      key: 'value',
      label: 'Value',
      group: 'general',
      inputType: 'number',
      order: 1,
      validation: { required: true },
      biomarkerKey: 'fixture-value',
      unit: { canonical: 'mg/dL' },
    },
  ],
  scoringRules: [
    {
      parameterKey: 'value',
      contexts: [
        {
          when: null,
          bands: [
            { min: null, max: 10, points: 1 },
            { min: 10, points: 2 },
          ],
        },
      ],
    },
  ],
  formulas: [{ key: 'final-score', expression: 'sum(points)' }],
  domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['value'] }],
  resultCategories: {
    scale: { min: 0, max: 2, direction: 'higher-is-worse' },
    bandEdges: 'min-inclusive',
    bands: [
      { label: 'low', max: 2, color: '#00aa00' },
      { label: 'high', min: 2, color: '#aa0000' },
    ],
  },
  uiConfig: {
    steps: [],
    result: { layout: ['score-gauge', 'category', 'domain-breakdown', 'recommendations'] },
  },
};

const record: PublishedCalculatorRecord = {
  id: 'public-fixture-version-id',
  calculatorSlug: 'public-fixture',
  version: 1,
  payload: config,
};
const source = {
  listPublished: async () => [record],
  getPublished: async (slug: string) => (slug === record.calculatorSlug ? record : undefined),
};

const FIXTURE_REVIEWER_ID = '64c000000000000000000099';

function approvedBiomarkerFixture(options: {
  readonly key: string;
  readonly revision?: number;
  readonly displayName: string;
  readonly unit: string;
  readonly dimension?: string;
  readonly domains?: readonly string[];
  readonly aliases?: readonly string[];
  readonly description?: Record<string, unknown>;
  readonly referenceRanges?: readonly Record<string, unknown>[];
  readonly sourceOverrides?: Record<string, unknown>;
  readonly governanceOverrides?: Record<string, unknown>;
}) {
  const revision = options.revision ?? 1;
  const reviewedAt = '2026-01-01T00:00:00.000Z';
  const claimId = `${options.key}-claim`;
  const sources = [
    {
      id: `${options.key}-source`,
      type: 'internal',
      title: `${options.displayName} fixture source`,
      ref: `fixture:${options.key}`,
      verification: 'source-provided',
      claimIds: [claimId],
      ...options.sourceOverrides,
    },
  ];
  const definition = {
    schemaVersion: 'measurement-definition.v1',
    key: options.key,
    version: revision,
    status: 'approved',
    displayName: options.displayName,
    ...(options.aliases ? { aliases: options.aliases } : {}),
    kind: 'laboratory-biomarker',
    ...(options.domains ? { domainKeys: options.domains } : {}),
    valueType: 'number',
    canonicalUnit: {
      code: options.unit,
      dimension: options.dimension ?? 'mass-concentration',
      display: options.unit,
    },
    acceptedUnits: [
      {
        code: options.unit,
        dimension: options.dimension ?? 'mass-concentration',
        display: options.unit,
      },
    ],
    conversions: [
      {
        kind: 'affine',
        fromUnit: options.unit,
        toUnit: options.unit,
        factor: 1,
        offset: 0,
        sourceClaimIds: [claimId],
      },
    ],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: options.referenceRanges ?? [],
    ...(options.description ? { description: options.description } : {}),
    sources,
    governance: {
      reviewStatus: 'approved',
      reviewedAt,
      reviewerId: FIXTURE_REVIEWER_ID,
      publishBlockers: [],
      ...options.governanceOverrides,
    },
  };
  const definitionHash = stableMeasurementHash(definition);
  return {
    key: options.key,
    revision,
    status: 'verified',
    displayName: options.displayName,
    kind: 'biomarker',
    canonicalUnit: options.unit,
    definition,
    definitionHash,
    sources,
    reviewedBy: FIXTURE_REVIEWER_ID,
    verifiedAt: new Date(reviewedAt),
    reviewHash: measurementReviewHash({
      definitionHash,
      sources,
      reviewerId: FIXTURE_REVIEWER_ID,
      reviewedAt,
    }),
  };
}

describe('public API baseline', () => {
  it('builds an immutable result presentation without scoring implementation details', () => {
    const presentation = buildResultPresentation(record);
    expect(presentation).toEqual({
      calculatorSlug: 'public-fixture',
      calculatorVersion: 1,
      name: 'Public fixture',
      shortDescription: 'A nonclinical test calculator.',
      disclaimers: ['For testing only.'],
      resultLayout: ['score-gauge', 'category', 'domain-breakdown', 'recommendations'],
      scoreScale: { min: 0, max: 2, direction: 'higher-is-worse' },
      parameters: [
        {
          key: 'value',
          label: 'Value',
          biomarkerKey: 'fixture-value',
          canonicalUnit: 'mg/dL',
        },
      ],
      domains: [{ key: 'overall', label: 'Overall' }],
    });
    const serialized = JSON.stringify(presentation);
    expect(serialized).not.toContain('points');
    expect(serialized).not.toContain('formula');
    expect(serialized).not.toContain('weight');
    expect(serialized).not.toContain('bands');
  });

  it('rejects an invalid lead retention policy before persistence is constructed', () => {
    expect(() => createMongoLeadStore({ retentionDays: 0 })).toThrow(/positive integer/);
  });

  it('rejects an invalid assessment retention policy before persistence is constructed', () => {
    expect(() => createMongoAssessmentStore({ retentionDays: 0 })).toThrow(/positive integer/);
  });

  it('projects published configs and supports ETag revalidation', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { catalog: source });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const url = `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture`;
      const first = await fetch(url);
      expect(first.status).toBe(200);
      const body = await first.json();
      expect(body.data.releaseState).toBeUndefined();
      expect(body.data.scoringRules).toBeUndefined();
      expect(body.data.formulas).toBeUndefined();
      expect(body.data.domains).toBeUndefined();
      expect(body.data.resultCategories.bands[0].max).toBeUndefined();
      expect(first.headers.get('x-niro-mode')).toBeNull();
      expect(first.headers.get('x-robots-tag')).toBeNull();
      expect(first.headers.get('cache-control')).toContain('public');
      const tag = first.headers.get('etag');
      expect(tag).toBeTruthy();
      const second = await fetch(url, { headers: { 'If-None-Match': tag ?? '' } });
      expect(second.status).toBe(304);

      const list = await fetch(`http://127.0.0.1:${address.port}/api/v1/calculators`);
      expect(list.status).toBe(200);
      const listTag = list.headers.get('etag');
      expect(listTag).toBeTruthy();
      const listNotModified = await fetch(`http://127.0.0.1:${address.port}/api/v1/calculators`, {
        headers: { 'If-None-Match': listTag ?? '' },
      });
      expect(listNotModified.status).toBe(304);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('labels and persists an injected draft only through the no-store public-test router', async () => {
    const draftRecord: PublishedCalculatorRecord = {
      ...record,
      releaseState: 'testing-unapproved',
    };
    const reviewedBiomarker = approvedBiomarkerFixture({
      key: 'fixture-value',
      revision: 2,
      displayName: 'Fixture value draft',
      unit: 'mg/dL',
      domains: ['metabolic'],
    });
    const draftBiomarker = { ...reviewedBiomarker, status: 'draft' };
    let saves = 0;
    let savedCalculatorSlug: string | undefined;
    let savedReleaseState: ResultPresentation['releaseState'];
    const app = createApp(
      loadEnvironment({
        NODE_ENV: 'development',
        PUBLIC_TEST_CATALOG_ENABLED: 'true',
        HOST: '127.0.0.1',
        CORS_ORIGINS: 'http://localhost:3000',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB_NAME: 'niro_dev',
      }),
      undefined,
      {
        catalog: {
          listPublished: async () => [draftRecord],
          getPublished: async (slug) =>
            slug === draftRecord.calculatorSlug ? draftRecord : undefined,
        },
        biomarker: {
          list: async () => [draftBiomarker],
          get: async (key) => (key === draftBiomarker.key ? draftBiomarker : undefined),
        },
        assessmentStore: {
          save: async (assessment) => {
            saves += 1;
            savedCalculatorSlug = assessment.calculatorSlug;
            savedReleaseState = assessment.presentation?.releaseState;
            return { id: 'draft-result', shareToken: 'draft-share-token' };
          },
        },
      },
    );
    const server = app.listen(0);

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const root = `http://127.0.0.1:${address.port}/api/v1/public-test`;

      const calculators = await fetch(`${root}/calculators`);
      expect(calculators.status).toBe(200);
      expect(calculators.headers.get('cache-control')).toBe('no-store');
      expect(calculators.headers.get('pragma')).toBe('no-cache');
      expect(calculators.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
      expect(calculators.headers.get('x-niro-mode')).toBe('public-testing');
      await expect(calculators.json()).resolves.toMatchObject({
        data: [
          {
            calculatorSlug: 'public-fixture',
            version: 1,
            releaseState: 'testing-unapproved',
          },
        ],
      });

      const biomarkers = await fetch(`${root}/biomarkers`);
      expect(biomarkers.status).toBe(200);
      expect(biomarkers.headers.get('cache-control')).toBe('no-store');
      expect(biomarkers.headers.get('x-robots-tag')).toContain('noindex');
      expect(biomarkers.headers.get('x-niro-mode')).toBe('public-testing');
      await expect(biomarkers.json()).resolves.toMatchObject({
        data: [
          {
            key: 'fixture-value',
            revision: 2,
            releaseState: 'testing-unapproved',
          },
        ],
      });

      const assessment = await fetch(`${root}/calculators/public-fixture/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: { value: 5 } }),
      });
      expect(assessment.status).toBe(200);
      expect(assessment.headers.get('cache-control')).toBe('no-store');
      expect(assessment.headers.get('x-robots-tag')).toContain('noindex');
      expect(assessment.headers.get('x-niro-mode')).toBe('public-testing');
      await expect(assessment.json()).resolves.toMatchObject({
        data: {
          id: 'draft-result',
          calculatorSlug: 'public-fixture',
          version: 1,
          shareToken: 'draft-share-token',
          releaseState: 'testing-unapproved',
        },
      });
      expect(saves).toBe(1);
      expect(savedCalculatorSlug).toBe('public-fixture');
      expect(savedReleaseState).toBe('testing-unapproved');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('excludes orphaned, stale, and manually flagged versions without the current published parent', () => {
    const pipeline = buildPublishedCalculatorPipeline();
    expect(pipeline[0]).toEqual({ $match: { status: 'published' } });
    expect(pipeline).toContainEqual({
      $lookup: {
        from: 'calculators',
        let: {
          calculatorId: '$calculatorId',
          versionId: '$_id',
          calculatorSlug: '$calculatorSlug',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$calculatorId'] },
                  { $eq: ['$currentVersionId', '$$versionId'] },
                  { $eq: ['$slug', '$$calculatorSlug'] },
                  { $eq: ['$status', 'published'] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'liveCalculator',
      },
    });
    expect(pipeline).toContainEqual({ $match: { 'liveCalculator.0': { $exists: true } } });
  });

  it('collapses corrupted duplicate published rows to one public route', () => {
    const pipeline = buildPublishedCalculatorPipeline();
    expect(pipeline).toContainEqual({ $sort: { calculatorSlug: 1, version: -1 } });
    expect(pipeline).toContainEqual({
      $group: { _id: '$calculatorSlug', record: { $first: '$$ROOT' } },
    });
    expect(pipeline).toContainEqual({ $replaceRoot: { newRoot: '$record' } });
    expect(pipeline).toContainEqual({ $project: { liveCalculator: 0 } });
  });

  it('scopes calculator detail to one current published parent/version pair', () => {
    const pipeline = buildPublishedCalculatorPipeline('public-fixture');
    expect(pipeline[0]).toEqual({
      $match: { status: 'published', calculatorSlug: 'public-fixture' },
    });
    expect(pipeline.at(-1)).toEqual({ $limit: 1 });
  });

  it('builds a latest-verified, nested-domain, alias-text-search pipeline', () => {
    const pipeline = buildBiomarkerListPipeline({
      domain: 'metabolic',
      search: 'blood sugar',
    });
    expect(pipeline[0]).toMatchObject({
      $match: {
        status: 'verified',
        'definition.status': 'approved',
        'definition.governance.reviewStatus': 'approved',
        'definition.domainKeys': 'metabolic',
        $text: { $search: 'blood sugar' },
      },
    });
    expect(pipeline).toContainEqual({ $sort: { key: 1, revision: -1 } });
    expect(pipeline).toContainEqual({
      $group: { _id: '$key', record: { $first: '$$ROOT' } },
    });
    expect(pipeline).toContainEqual({ $sort: { displayName: 1, key: 1 } });
    expect(pipeline).toContainEqual({ $limit: 100 });
    expect(JSON.stringify(pipeline)).not.toContain('published');
    expect(JSON.stringify(pipeline)).not.toContain('retired');
    expect(JSON.stringify(pipeline)).not.toContain('derived-measurement');
  });

  it('joins biomarker usage to the calculator current published version', () => {
    const pipeline = buildBiomarkerCalculatorUsagePipeline('fixture-value');
    expect(pipeline).toContainEqual({
      $lookup: {
        from: 'calculators',
        let: { calculatorId: '$calculatorId', versionId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$calculatorId'] },
                  { $eq: ['$currentVersionId', '$$versionId'] },
                  { $eq: ['$status', 'published'] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'liveCalculator',
      },
    });
    expect(pipeline).toContainEqual({ $match: { 'liveCalculator.0': { $exists: true } } });
  });

  it('validates biomarker query fields and delegates a bounded normalized search', async () => {
    const queries: unknown[] = [];
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      biomarker: {
        list: async (query) => {
          queries.push(query);
          return [];
        },
        get: async () => undefined,
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const root = `http://127.0.0.1:${address.port}/api/v1/biomarkers`;
      const valid = await fetch(`${root}?domain=metabolic&search=%20glucose%20`);
      expect(valid.status).toBe(200);
      expect(queries).toEqual([{ domain: 'metabolic', search: 'glucose' }]);

      const unknown = await fetch(`${root}?sort=private`);
      expect(unknown.status).toBe(422);
      expect((await unknown.json()).error.fields).toEqual({ unknown: ['sort'] });
      expect(queries).toHaveLength(1);

      expect((await fetch(`${root}?domain=Not_A_Domain`)).status).toBe(422);
      expect((await fetch(`${root}?search=%20%20%20`)).status).toBe(422);
      expect(queries).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns only reviewed biomarker detail with safe taxonomy and live-calculator links', async () => {
    const privateMarker = 'PRIVATE-P6-LINK-MARKER';
    const reviewed = approvedBiomarkerFixture({
      key: 'fasting-glucose',
      revision: 2,
      displayName: 'Fasting glucose',
      unit: 'mg/dL',
      domains: ['metabolic'],
      description: { whatItMeasures: 'A reviewed measurement.' },
    });
    const related = approvedBiomarkerFixture({
      key: 'hba1c',
      revision: 4,
      displayName: 'HbA1c',
      unit: '%',
      dimension: 'dimensionless',
      domains: ['metabolic'],
    });
    const expiredReview = approvedBiomarkerFixture({
      key: 'expired-review',
      displayName: 'Expired review',
      unit: 'mg/dL',
      governanceOverrides: { reviewExpiresAt: '2000-01-01T00:00:00.000Z' },
    });
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      biomarker: {
        list: async () => [
          reviewed,
          expiredReview,
          { ...reviewed, key: 'draft-only', status: 'draft' },
        ],
        get: async (key) =>
          key === reviewed.key
            ? reviewed
            : key === 'draft-only'
              ? { ...reviewed, key, status: 'draft' }
              : undefined,
        related: async () => [
          related,
          {
            status: 'draft',
            key: 'draft-related',
            revision: 1,
            displayName: privateMarker,
          },
        ],
        usedInCalculators: async () => [
          {
            status: 'published',
            calculatorSlug: 'live-calculator',
            version: 3,
            payload: {
              name: 'Live calculator',
              shortDescription: 'Uses this measurement.',
              scoringRules: privateMarker,
            },
            reviewHash: privateMarker,
          },
          {
            status: 'draft',
            calculatorSlug: 'draft-calculator',
            version: 9,
            payload: { name: privateMarker },
          },
        ],
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const root = `http://127.0.0.1:${address.port}/api/v1/biomarkers`;
      const list = await fetch(root);
      expect((await list.json()).data).toHaveLength(1);

      const response = await fetch(`${root}/fasting-glucose`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.relatedBiomarkers).toEqual([
        {
          key: 'hba1c',
          displayName: 'HbA1c',
          canonicalUnit: '%',
          domainKeys: ['metabolic'],
          relation: 'same-domain',
        },
      ]);
      expect(body.data.usedInCalculators).toEqual([
        {
          calculatorSlug: 'live-calculator',
          version: 3,
          name: 'Live calculator',
          shortDescription: 'Uses this measurement.',
        },
      ]);
      expect(JSON.stringify(body)).not.toContain(privateMarker);
      expect(response.headers.get('cache-control')).toContain('public');
      expect(response.headers.get('etag')).toBeTruthy();

      const missing = await fetch(`${root}/draft-only`);
      expect(missing.status).toBe(404);
      expect(missing.headers.get('cache-control')).toContain('public');
      expect((await fetch(`${root}/INVALID_key`)).status).toBe(422);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('excludes a structurally valid, fully hashed derived envelope from every public read', async () => {
    const base = approvedBiomarkerFixture({
      key: 'derived-fixture',
      displayName: 'Derived fixture',
      unit: 'ratio',
      dimension: 'dimensionless',
    });
    const definition = {
      ...(base.definition as Record<string, unknown>),
      kind: 'derived-measurement',
      derived: {
        expression: 'source-fixture',
        dependsOn: ['source-fixture'],
        semanticVersion: '1.0.0',
        sourceClaimIds: ['derived-fixture-claim'],
      },
    };
    const definitionHash = stableMeasurementHash(definition);
    const derived = {
      ...base,
      kind: 'derived',
      definition,
      definitionHash,
      reviewHash: measurementReviewHash({
        definitionHash,
        sources: base.sources as unknown[],
        reviewerId: FIXTURE_REVIEWER_ID,
        reviewedAt: '2026-01-01T00:00:00.000Z',
      }),
    };
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      biomarker: {
        list: async () => [derived],
        get: async () => derived,
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const root = `http://127.0.0.1:${address.port}/api/v1/biomarkers`;
      await expect((await fetch(root)).json()).resolves.toEqual({ data: [] });
      expect((await fetch(`${root}/derived-fixture`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns only the exact public calculator DTO shape from adversarial published data', async () => {
    const privateMarker = 'PRIVATE-PROJECTION-MARKER';
    const adversarialRecord: PublishedCalculatorRecord = {
      ...record,
      payload: {
        ...config,
        NIRO_SOURCE_STATUS: { banner: privateMarker },
        PURPOSE_NOTE: privateMarker,
        sources: [{ type: 'internal', ref: privateMarker, note: privateMarker }],
        parameters: [
          {
            ...config.parameters[0],
            source: { type: 'internal', ref: privateMarker, note: privateMarker },
            visibility: { formula: privateMarker, op: 'gte', value: 123 },
            internalTrace: privateMarker,
          },
        ],
        content: {
          schemaVersion: 'content-page.v1',
          contentId: 'public-fixture-content',
          version: 1,
          locale: 'en-IN',
          slug: 'public-fixture',
          title: 'Public fixture content',
          summary: 'Safe public summary.',
          blocks: [
            {
              id: 'intro',
              type: 'markdown',
              markdown: 'Safe public copy.',
              internalTrace: privateMarker,
            },
          ],
          claims: [
            {
              id: 'claim-one',
              text: 'Safe public claim.',
              kind: 'nonmedical',
              citationIds: ['citation-one'],
              reviewStatus: 'verified',
              reviewNote: privateMarker,
            },
          ],
          citations: [
            {
              id: 'citation-one',
              type: 'internal',
              title: 'Safe source title',
              url: `https://example.test/${privateMarker}`,
              localRef: privateMarker,
              note: privateMarker,
              verificationStatus: 'source-provided',
              licenseStatus: 'not-applicable',
            },
          ],
          authorship: {
            ownerId: privateMarker,
            contributors: [{ id: privateMarker, displayName: 'Private author', role: 'author' }],
          },
          medicalReview: { reviewerId: privateMarker, decisionNote: privateMarker },
          publication: { status: 'published', changelog: privateMarker },
          seo: {
            metaTitle: 'Public fixture calculator',
            metaDescription:
              'A safe public fixture description that is intentionally long enough for metadata.',
            canonicalPath: '/c/public-fixture',
            robots: { index: true, follow: true, privateMarker },
            schemaTypes: ['MedicalWebPage'],
            privateMarker,
          },
          related: { calculatorSlugs: ['related-fixture'], privateMarker },
          privateMarker,
        },
        privateMarker,
      },
    };
    const adversarialSource = {
      listPublished: async () => [adversarialRecord],
      getPublished: async () => adversarialRecord,
    };
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: adversarialSource,
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const base = `http://127.0.0.1:${address.port}/api/v1`;
      const detail = await fetch(`${base}/calculators/public-fixture`);
      expect(detail.status).toBe(200);
      const body = await detail.json();
      expect(Object.keys(body.data).sort()).toEqual(
        [
          'calculatorSlug',
          'content',
          'disclaimers',
          'name',
          'parameters',
          'resultCategories',
          'shortDescription',
          'slug',
          'uiConfig',
          'version',
        ].sort(),
      );
      expect(Object.keys(body.data.parameters[0]).sort()).toEqual(
        [
          'biomarkerKey',
          'group',
          'inputType',
          'key',
          'label',
          'order',
          'unit',
          'validation',
          'visibility',
        ].sort(),
      );
      expect(body.data.parameters[0].visibility).toEqual({ unavailable: true });
      expect(Object.keys(body.data.content).sort()).toEqual(
        [
          'blocks',
          'citations',
          'claims',
          'contentId',
          'locale',
          'related',
          'schemaVersion',
          'seo',
          'slug',
          'summary',
          'title',
          'version',
        ].sort(),
      );
      expect(body.data.content.citations[0]).toEqual({
        id: 'citation-one',
        type: 'internal',
        title: 'Safe source title',
        verificationStatus: 'source-provided',
        licenseStatus: 'not-applicable',
      });
      expect(JSON.stringify(body)).not.toContain(privateMarker);
      expect(JSON.stringify(body)).not.toContain('"formula"');
      expect(body.data.content.authorship).toBeUndefined();
      expect(body.data.sources).toBeUndefined();

      const list = await fetch(`${base}/calculators`);
      const listBody = await list.json();
      expect(Object.keys(listBody.data[0]).sort()).toEqual(
        ['calculatorSlug', 'disclaimers', 'name', 'shortDescription', 'slug', 'version'].sort(),
      );
      expect(JSON.stringify(listBody)).not.toContain(privateMarker);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('distinguishes a retired calculator from an unknown slug', async () => {
    const retiredSource = {
      ...source,
      getUnavailableStatus: async (slug: string) =>
        slug === 'retired-fixture' ? ('retired' as const) : undefined,
    };
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: retiredSource,
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const base = `http://127.0.0.1:${address.port}/api/v1/calculators`;
      const retired = await fetch(`${base}/retired-fixture`);
      expect(retired.status).toBe(410);
      expect(retired.headers.get('cache-control')).toBe('public, max-age=30, must-revalidate');
      await expect(retired.json()).resolves.toEqual({
        error: { code: 'CALCULATOR_RETIRED', message: 'This calculator has been retired.' },
      });
      const missing = await fetch(`${base}/unknown-fixture`);
      expect(missing.status).toBe(404);
      expect(missing.headers.get('cache-control')).toBe('public, max-age=30, must-revalidate');
      await expect(missing.json()).resolves.toEqual({
        error: { code: 'NOT_FOUND', message: 'Published calculator not found.' },
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns 503 when assessment persistence has not been configured', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { catalog: source });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture/assess`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputs: { value: 5 } }),
        },
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns a bounded 400 error for malformed JSON', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { catalog: source });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture/assess/`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        },
      );
      expect(response.status).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual({
        error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' },
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('serves expiring capability results with noindex/no-store headers', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      result: {
        getByShareToken: async (token) => (token === 'test-token' ? { score: 1 } : undefined),
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/results/test-token`);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-robots-tag')).toContain('noindex');
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual({ data: { score: 1 } });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('sanitizes stored result internals and applies privacy headers to misses', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      result: {
        getByShareToken: async (token) =>
          token === 'test-token'
            ? {
                score: { formula: 'private-score()' },
                category: { label: 'Low', message: { formula: 'private-message()' } },
                parameters: [
                  {
                    key: 'value',
                    input: { formula: 'private-input()' },
                    value: 5,
                    points: 2,
                    possiblePoints: 2,
                    status: 'scored',
                  },
                ],
                domains: [
                  {
                    key: 'overall',
                    score: 1,
                    weight: 1,
                    points: 2,
                    earnedPoints: 2,
                    status: 'scored',
                  },
                ],
                coverage: { scoredParameterCount: 1, parameterCoverage: 1, possiblePoints: 2 },
                formulas: { rawScore: 2 },
                warnings: ['Safe warning', { formula: 'private-warning()' }],
                contributors: {
                  harmful: [{ key: 'value', status: { formula: 'private-status()' } }],
                  protective: [],
                },
                trace: [{ stage: 'score', points: 2 }],
                presentation: {
                  ...buildResultPresentation(record),
                  formulas: { private: true },
                  thresholds: [1, 2],
                  parameters: [
                    {
                      key: 'value',
                      label: 'Value',
                      biomarkerKey: 'fixture-value',
                      canonicalUnit: 'mg/dL',
                      points: 2,
                    },
                  ],
                  domains: [{ key: 'overall', label: 'Overall', weight: 1 }],
                },
              }
            : undefined,
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/results/test-token`);
      expect(response.status).toBe(200);
      const body = await response.json();
      const json = JSON.stringify(body);
      expect(json).not.toContain('formula');
      expect(json).not.toContain('points');
      expect(json).not.toContain('weight');
      expect(json).not.toContain('trace');
      expect(body.data.score).toBeUndefined();
      expect(body.data.category).toEqual({ label: 'Low' });
      expect(body.data.parameters[0].input).toBeUndefined();
      expect(body.data.warnings).toEqual(['Safe warning']);
      expect(body.data.contributors.harmful).toEqual([{ key: 'value' }]);
      expect(body.data.presentation).toEqual(buildResultPresentation(record));
      const missing = await fetch(`http://127.0.0.1:${address.port}/api/v1/results/not-found`);
      expect(missing.status).toBe(404);
      expect(missing.headers.get('cache-control')).toBe('no-store');
      expect(missing.headers.get('x-robots-tag')).toContain('noindex');
      const malformed = await fetch(`http://127.0.0.1:${address.port}/api/v1/results/%E0%A4%A`);
      expect(malformed.status).toBe(404);
      expect(malformed.headers.get('cache-control')).toBe('no-store');
      expect(malformed.headers.get('x-robots-tag')).toContain('noindex');
      await expect(malformed.json()).resolves.toEqual({
        error: { code: 'NOT_FOUND', message: 'Result not found or expired.' },
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('sanitizes biomarker list and detail persistence metadata consistently', async () => {
    const privateMarker = 'PRIVATE-BIOMARKER-MARKER';
    const rawBiomarker = {
      ...approvedBiomarkerFixture({
        key: 'fixture-value',
        revision: 2,
        displayName: 'Fixture value',
        unit: 'mg/dL',
        aliases: ['Fixture measurement'],
        description: { whatItMeasures: 'A nonclinical fixture.' },
        referenceRanges: [
          {
            id: 'fixture-range',
            label: 'Fixture range',
            unit: 'mg/dL',
            interval: { min: 1, max: 10, minInclusive: true, maxInclusive: true },
            context: { specimen: 'serum', population: 'Test population' },
            interpretationOnly: true,
            sourceClaimIds: ['fixture-value-claim'],
            reviewExpiresAt: '2090-01-01T00:00:00.000Z',
          },
        ],
        sourceOverrides: {
          url: `https://example.test/${privateMarker}`,
          note: privateMarker,
        },
        governanceOverrides: { legacyRecordRefs: [privateMarker] },
      }),
      _id: 'database-id',
      migrationProvenance: { sourcePath: privateMarker },
    };
    /*
     * The fixture above is a fully valid approved canonical envelope. Private
     * migration, governance, and source-note fields are present only in places
     * the schema permits, proving the allowlist without inventing an impossible
     * "approved" record that violates measurement-definition.v1.
     */
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      biomarker: {
        list: async () => [rawBiomarker],
        get: async () => rawBiomarker,
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      for (const path of ['/api/v1/biomarkers', '/api/v1/biomarkers/fixture-value']) {
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
        expect(response.status).toBe(200);
        const body = await response.json();
        const item = Array.isArray(body.data) ? body.data[0] : body.data;
        expect(item).toMatchObject({
          key: 'fixture-value',
          revision: 2,
          displayName: 'Fixture value',
          canonicalUnit: 'mg/dL',
        });
        expect(Object.keys(item).sort()).toEqual(
          [
            'canonicalUnit',
            'definition',
            'displayName',
            'key',
            'kind',
            'revision',
            'sources',
            ...(path.endsWith('/fixture-value') ? ['relatedBiomarkers', 'usedInCalculators'] : []),
          ].sort(),
        );
        expect(Object.keys(item.definition).sort()).toEqual(
          [
            'acceptedUnits',
            'aliases',
            'canonicalUnit',
            'conversions',
            'description',
            'referenceRanges',
            'valueType',
          ].sort(),
        );
        expect(item.sources).toEqual([
          {
            id: 'fixture-value-source',
            type: 'internal',
            title: 'Fixture value fixture source',
            verification: 'source-provided',
            claimIds: ['fixture-value-claim'],
          },
        ]);
        const serialized = JSON.stringify(item);
        expect(serialized).not.toContain('database-id');
        expect(serialized).not.toContain('private-hash');
        expect(serialized).not.toContain('private-reviewer');
        expect(serialized).not.toContain(privateMarker);
        expect(serialized).not.toContain('private-dependency');
        expect(serialized).not.toContain('formula');
        expect(serialized).not.toContain('expression');
        expect(serialized).not.toContain('governance');
        expect(response.headers.get('cache-control')).toContain('public');
        const tag = response.headers.get('etag');
        expect(tag).toBeTruthy();
        const notModified = await fetch(`http://127.0.0.1:${address.port}${path}`, {
          headers: { 'If-None-Match': tag ?? '' },
        });
        expect(notModified.status).toBe(304);
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('keeps lead capture optional and stores only normalized consented email data', async () => {
    const saved: { email: string; consentVersion: string }[] = [];
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      leadCapture: {
        consentVersion: 'privacy-v1',
        store: { save: async (lead) => void saved.push(lead) },
      },
      leadRateLimit: { max: 10, windowMs: 60_000 },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const url = `http://127.0.0.1:${address.port}/api/v1/leads`;
      const linked = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'person@example.test',
          consent: true,
          consentVersion: 'privacy-v1',
          calculatorSlug: 'public-fixture',
        }),
      });
      expect(linked.status).toBe(422);
      expect(JSON.stringify(await linked.json())).not.toContain('calculatorSlug');
      expect(saved).toHaveLength(0);

      const staleConsent = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'person@example.test',
          consent: true,
          consentVersion: 'privacy-v0',
        }),
      });
      expect(staleConsent.status).toBe(422);

      const accepted = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '  PERSON@Example.Test ',
          consent: true,
          consentVersion: 'privacy-v1',
        }),
      });
      expect(accepted.status).toBe(201);
      expect(accepted.headers.get('cache-control')).toBe('no-store');
      await expect(accepted.json()).resolves.toEqual({ data: { accepted: true } });
      expect(saved).toEqual([{ email: 'person@example.test', consentVersion: 'privacy-v1' }]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns no-store unavailable and rate-limited lead responses safely', async () => {
    const unavailableApp = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
    });
    const unavailableServer = unavailableApp.listen(0);
    try {
      const address = unavailableServer.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/leads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'person@example.test',
          consent: true,
          consentVersion: 'privacy-v1',
        }),
      });
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
    } finally {
      await new Promise<void>((resolve, reject) =>
        unavailableServer.close((error) => (error ? reject(error) : resolve())),
      );
    }

    const limitedApp = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      leadCapture: {
        consentVersion: 'privacy-v1',
        store: { save: async () => undefined },
      },
      leadRateLimit: { max: 1, windowMs: 60_000 },
    });
    const limitedServer = limitedApp.listen(0);
    try {
      const address = limitedServer.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const request = () =>
        fetch(`http://127.0.0.1:${address.port}/api/v1/leads`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'person@example.test',
            consent: true,
            consentVersion: 'privacy-v1',
          }),
        });
      expect((await request()).status).toBe(201);
      const limited = await request();
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();
      expect(limited.headers.get('cache-control')).toBe('no-store');
    } finally {
      await new Promise<void>((resolve, reject) =>
        limitedServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('keeps malformed trailing-slash lead requests private', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { catalog: source });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/leads/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      });
      expect(response.status).toBe(400);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('validates assess requests, replays idempotent requests, and rejects key reuse', async () => {
    let saves = 0;
    let capturedPresentation: ResultPresentation | undefined;
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      assessmentStore: {
        save: async (assessment) => {
          saves += 1;
          capturedPresentation = assessment.presentation;
          return { id: `result-${saves}`, shareToken: `share-token-${saves}` };
        },
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const url = `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture/assess`;
      const first = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'idem-1234' },
        body: JSON.stringify({ inputs: { value: 5 } }),
      });
      expect(first.status).toBe(200);
      const firstBody = await first.json();
      const second = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'idem-1234' },
        body: JSON.stringify({ inputs: { value: 5 } }),
      });
      expect(second.status).toBe(200);
      await expect(second.json()).resolves.toEqual(firstBody);
      expect(saves).toBe(1);
      expect(capturedPresentation).toEqual(buildResultPresentation(record));

      const reused = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': 'idem-1234' },
        body: JSON.stringify({ inputs: { value: 6 } }),
      });
      expect(reused.status).toBe(409);

      const invalid = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: { value: 5 }, unexpected: true }),
      });
      expect(invalid.status).toBe(422);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns 422 when an omitted required input also causes downstream configuration errors', async () => {
    let saves = 0;
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      assessmentStore: {
        save: async () => {
          saves += 1;
          return { id: 'result', shareToken: 'share-token' };
        },
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture/assess`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputs: { value: 5 }, omitted: ['value'] }),
        },
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'INPUT_VALIDATION_FAILED',
          fields: { 'inputs.value': { code: 'MISSING_REQUIRED_INPUT' } },
        },
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(saves).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns a retry hint when the assess rate limit is exceeded', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      catalog: source,
      rateLimit: { max: 1, windowMs: 60_000 },
      assessmentStore: {
        save: async () => ({ id: 'result', shareToken: 'share-token' }),
      },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const url = `http://127.0.0.1:${address.port}/api/v1/calculators/public-fixture/assess`;
      const request = () =>
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputs: { value: 5 } }),
        });
      expect((await request()).status).toBe(200);
      const limited = await request();
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();
      expect(limited.headers.get('cache-control')).toBe('no-store');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('invalidates cached published configuration deterministically', async () => {
    let calls = 0;
    const cached = createCachedCatalogSource(
      {
        async listPublished() {
          calls += 1;
          return [record];
        },
        async getPublished() {
          calls += 1;
          return record;
        },
      },
      60_000,
    );
    await cached.getPublished(record.calculatorSlug);
    await cached.getPublished(record.calculatorSlug);
    expect(calls).toBe(1);
    cached.invalidate(record.calculatorSlug);
    await cached.getPublished(record.calculatorSlug);
    expect(calls).toBe(2);
  });
});
