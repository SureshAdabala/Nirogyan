import type { Server } from 'node:http';

import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { createAuthService } from '../auth/service';
import { loadEnvironment } from '../config/env';
import type { AdminRole } from '../persistence/models/admin-user';
import { AuditLogModel } from '../persistence/models/audit-log';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { MeasurementRevisionModel } from '../persistence/models/measurement-revision';
import { draftPayloadSafetyIssue, measurementDefinitionIssue, protectedReviewHash } from './admin';
import { stableMeasurementHash } from './measurement-contract';

const ACCESS_SECRET = 'access-secret-for-test';
const ADMIN_ID = '64c000000000000000000001';

let server: Server;
let baseUrl: string;

function accessToken(role: AdminRole, id = ADMIN_ID): string {
  return jwt.sign(
    {
      sub: id,
      email: `${role}@example.test`,
      role,
      tokenType: 'access',
    },
    ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: 60 },
  );
}

function authHeaders(role: AdminRole): Record<string, string> {
  return { authorization: `Bearer ${accessToken(role)}` };
}

function draftVersion(payload: Record<string, unknown> = {}) {
  const record = {
    _id: new Types.ObjectId('64c000000000000000000010'),
    calculatorSlug: 'test-calculator',
    version: 1,
    status: 'draft' as const,
    payload,
    measurementRevisionIds: [] as string[],
    measurementSnapshots: [] as unknown[],
    versionHash: 'initial-version-hash',
    updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    save: vi.fn(),
  };
  record.save.mockResolvedValue(record);
  return record;
}

function executableTestCasePayload(): Record<string, unknown> {
  return {
    calculatorSlug: 'test-calculator',
    version: 1,
    parameters: [
      {
        key: 'age',
        label: 'Age',
        group: 'general',
        inputType: 'number',
        order: 1,
        validation: { required: true, min: 0, max: 120 },
        missingPolicy: 'block',
      },
    ],
    scoringRules: [
      {
        parameterKey: 'age',
        contexts: [
          {
            when: null,
            bands: [
              { min: null, max: 40, points: 0 },
              { min: 40, max: null, points: 2 },
            ],
          },
        ],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['age'] }],
    resultCategories: {
      scale: { min: 0, max: 2, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        { label: 'low', max: 2, color: '#00aa00' },
        { label: 'high', min: 2, color: '#aa0000' },
      ],
    },
    testCases: [
      {
        key: 'age-high-boundary',
        name: 'Age at the high-band boundary',
        kind: 'boundary',
        inputs: { age: 40 },
        expected: { finalScore: 2 },
      },
    ],
  };
}

function protectedReviewPayload(): Record<string, unknown> {
  return {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: 'test-calculator',
    name: 'Test calculator',
    version: 3,
    status: 'approved',
    shortDescription: 'Reviewed short description.',
    disclaimers: ['Reviewed educational disclaimer.'],
    engineSemanticVersion: '1.0.0',
    NIRO_SOURCE_STATUS: {
      banner: 'Source reviewed',
      explanation: 'Reviewed source status.',
      remainingClarifications: [],
    },
    parameters: [
      {
        key: 'marker',
        label: 'Marker',
        group: 'measurements',
        biomarkerKey: 'test-marker',
        inputType: 'number',
        unit: {
          canonical: 'mg/dL',
          allowed: [
            { code: 'mg/dL', factor: 1 },
            { code: 'mmol/L', factor: 18 },
          ],
        },
        validation: { required: false, min: 0, max: 1000 },
        missingPolicy: 'impute-rule',
        order: 1,
        helpText: 'Reviewed measurement guidance.',
      },
    ],
    scoringRules: [
      {
        parameterKey: 'marker',
        contexts: [{ when: null, bands: [{ min: null, max: null, points: 1 }] }],
      },
    ],
    parameterGroupsAggregation: [
      {
        key: 'marker-group',
        memberParameterKeys: ['marker'],
        method: 'max',
        emptyPolicy: 'zero',
      },
    ],
    imputationRules: [
      {
        key: 'marker-imputation',
        targetParameterKey: 'marker',
        when: { parameterKey: 'marker', operator: 'missing' },
        action: { setPoints: 0 },
      },
    ],
    lookupTables: [
      {
        key: 'marker-lookup',
        input: 'marker',
        entries: [{ key: 1, value: 2 }],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    floorRules: [
      {
        key: 'marker-floor',
        appliesWhen: { parameterKey: 'marker', operator: 'gte', value: 1 },
        tiers: [{ min: 1, floor: 1 }],
      },
    ],
    domains: [
      {
        key: 'overall',
        label: 'Overall',
        weight: 1,
        parameterKeys: [],
        aggregateKeys: ['marker-group'],
      },
    ],
    domainAggregationPolicy: {
      missingDomain: 'block',
      zeroDenominator: 'block',
    },
    adjustmentRules: [
      {
        key: 'marker-adjustment',
        label: 'Marker adjustment',
        points: 1,
        when: { parameterKey: 'marker', operator: 'gte', value: 1 },
      },
    ],
    resultCategories: {
      scale: { min: 0, max: 10, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        {
          label: 'Reviewed result',
          min: 0,
          max: null,
          color: '#123456',
          message: 'Reviewed result message.',
          recommendation: 'Reviewed recommendation.',
        },
      ],
      overrides: [
        {
          when: { parameterKey: 'marker', operator: 'gte', value: 10 },
          minCategory: 'Reviewed result',
        },
      ],
    },
    uiConfig: {
      theme: { accent: '#123456' },
      steps: [{ key: 'measurements', title: 'Measurements', parameterGroups: ['measurements'] }],
      result: { layout: ['category', 'recommendations'] },
    },
    content: {
      schemaVersion: 'content-page.v1',
      contentId: 'test-calculator',
      version: 1,
      locale: 'en-IN',
      slug: 'test-calculator',
      title: 'Reviewed calculator content',
      summary: 'A reviewed calculator content summary used for protected hashing.',
      blocks: [
        {
          id: 'reviewed-content',
          type: 'markdown',
          markdown: 'Reviewed medical content.',
          claimIds: ['reviewed-claim'],
        },
      ],
      claims: [
        {
          id: 'reviewed-claim',
          text: 'Reviewed medical claim.',
          kind: 'medical-fact',
          citationIds: ['reviewed-citation'],
          reviewStatus: 'verified',
        },
      ],
      citations: [
        {
          id: 'reviewed-citation',
          type: 'internal',
          title: 'Reviewed citation',
          localRef: 'reviewed-source#section-1',
          verificationStatus: 'source-provided',
          licenseStatus: 'not-applicable',
        },
      ],
      authorship: {
        contributors: [{ id: 'author-1', displayName: 'Author', role: 'author' }],
        ownerId: 'author-1',
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      },
      medicalReview: {
        status: 'approved',
        scope: 'full-page',
        reviewerId: 'reviewer-1',
        reviewedAt: '2026-08-30T00:00:00.000Z',
        nextReviewAt: '2027-08-30T00:00:00.000Z',
        decisionNote: 'Approved for the protected snapshot.',
        approvedClaimIds: ['reviewed-claim'],
      },
      seo: {
        metaTitle: 'Reviewed calculator content title',
        metaDescription:
          'A sufficiently long reviewed description for the protected calculator content fixture.',
        canonicalPath: '/c/test-calculator',
        robots: { index: true, follow: true },
        schemaTypes: ['MedicalWebPage'],
      },
      publication: {
        status: 'approved',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Reviewed content.',
      },
    },
    sources: [
      {
        type: 'internal',
        ref: 'reviewed-source#section-1',
        verification: 'source-provided',
        claimIds: ['reviewed-claim'],
      },
    ],
    governance: {
      clinicalStatus: 'approved',
      sourceReviewStatus: 'verified',
      discrepancyIds: [],
      publishBlockers: [],
      reviews: [
        {
          reviewerId: 'reviewer-1',
          reviewedAt: '2026-08-30T00:00:00.000Z',
          decision: 'approved',
          scope: 'full-version',
        },
      ],
      measurementRevisionIds: ['measurement-revision-1'],
      sourceReviewExpiresAt: '2027-08-30T00:00:00.000Z',
    },
    testCases: [
      {
        key: 'reviewed-source-example',
        name: 'Reviewed source example',
        kind: 'source-worked-example',
        inputs: { marker: 1 },
        expected: { finalScore: 1, category: 'Reviewed result' },
        source: {
          type: 'internal',
          ref: 'reviewed-source#worked-example',
          verification: 'source-provided',
        },
      },
    ],
  };
}

function childRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${key} is not a record in the protected-review test fixture.`);
  return value as Record<string, unknown>;
}

function firstChildRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${key} is not a nonempty array in the protected-review test fixture.`);
  }
  const first = value[0];
  if (first === null || typeof first !== 'object' || Array.isArray(first))
    throw new Error(`${key}[0] is not a record in the protected-review test fixture.`);
  return first as Record<string, unknown>;
}

function canonicalDraftMeasurementDefinition(
  sources: unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const governance = {
    reviewStatus: 'unreviewed',
    reviewedAt: null,
    reviewerId: null,
    publishBlockers: [],
    ...(typeof overrides.governance === 'object' && overrides.governance !== null
      ? overrides.governance
      : {}),
  };
  return {
    schemaVersion: 'measurement-definition.v1',
    key: 'test-marker',
    version: 1,
    status: 'draft',
    displayName: 'Test marker',
    kind: 'laboratory-biomarker',
    valueType: 'number',
    canonicalUnit: { code: 'ratio', dimension: 'dimensionless', display: 'ratio' },
    acceptedUnits: [{ code: 'ratio', dimension: 'dimensionless', display: 'ratio' }],
    conversions: [],
    inputBounds: {
      hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: [],
    sources,
    ...overrides,
    governance,
  };
}

function draftMeasurement(sources: unknown[], overrides: Record<string, unknown> = {}) {
  const definition = canonicalDraftMeasurementDefinition(sources, overrides);
  const record = {
    _id: new Types.ObjectId('64c000000000000000000020'),
    key: 'test-marker',
    revision: 1,
    status: 'draft' as const,
    displayName: 'Test marker',
    kind: 'biomarker' as const,
    canonicalUnit: 'ratio',
    definition,
    definitionHash: stableMeasurementHash(definition),
    sources,
    reviewedBy: undefined as Types.ObjectId | undefined,
    reviewHash: undefined as string | undefined,
    verifiedAt: undefined as Date | undefined,
    retiredAt: undefined,
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    updatedAt: new Date('2026-08-23T00:00:00.000Z'),
    save: vi.fn(),
  };
  record.save.mockResolvedValue(record);
  return record;
}

beforeAll(async () => {
  const authService = createAuthService({
    accessSecret: ACCESS_SECRET,
    refreshSecret: 'refresh-secret-for-test',
  });
  const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
    authService: {
      ...authService,
      verifyRequest: async (token: string) => authService.verifyAccess(token),
    },
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address unavailable');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe('admin calculator API boundary', () => {
  it('binds every normative clinical logic, content, source, governance, and test field to the review hash', () => {
    const measurementRevisionIds = ['measurement-revision-1'];
    const measurementSnapshots = [{ key: 'test-marker', revision: 1, definitionHash: 'hash-1' }];
    const baselinePayload = protectedReviewPayload();
    const baseline = protectedReviewHash(
      baselinePayload,
      measurementRevisionIds,
      measurementSnapshots,
    );
    const mutations: readonly [
      label: string,
      mutate: (payload: Record<string, unknown>) => void,
    ][] = [
      [
        'parameter unit conversion',
        (payload) => {
          const unit = childRecord(firstChildRecord(payload, 'parameters'), 'unit');
          firstChildRecord(unit, 'allowed').factor = 2;
        },
      ],
      [
        'parameter missing-data policy',
        (payload) => {
          firstChildRecord(payload, 'parameters').missingPolicy = 'block';
        },
      ],
      [
        'parameter validation bound',
        (payload) => {
          childRecord(firstChildRecord(payload, 'parameters'), 'validation').max = 999;
        },
      ],
      [
        'parameter-group aggregation',
        (payload) => {
          firstChildRecord(payload, 'parameterGroupsAggregation').method = 'min';
        },
      ],
      [
        'imputation rule',
        (payload) => {
          childRecord(firstChildRecord(payload, 'imputationRules'), 'action').setPoints = 2;
        },
      ],
      [
        'lookup table',
        (payload) => {
          const table = firstChildRecord(payload, 'lookupTables');
          firstChildRecord(table, 'entries').value = 3;
        },
      ],
      [
        'scoring rule',
        (payload) => {
          const rule = firstChildRecord(payload, 'scoringRules');
          const context = firstChildRecord(rule, 'contexts');
          firstChildRecord(context, 'bands').points = 2;
        },
      ],
      [
        'formula',
        (payload) => {
          firstChildRecord(payload, 'formulas').expression = 'sum(points) + 1';
        },
      ],
      [
        'floor rule',
        (payload) => {
          const floor = firstChildRecord(payload, 'floorRules');
          firstChildRecord(floor, 'tiers').floor = 2;
        },
      ],
      [
        'domain',
        (payload) => {
          firstChildRecord(payload, 'domains').weight = 0.5;
        },
      ],
      [
        'domain aggregation policy',
        (payload) => {
          childRecord(payload, 'domainAggregationPolicy').missingDomain = 'exclude';
        },
      ],
      [
        'adjustment rule',
        (payload) => {
          firstChildRecord(payload, 'adjustmentRules').points = 2;
        },
      ],
      [
        'result boundary',
        (payload) => {
          const categories = childRecord(payload, 'resultCategories');
          firstChildRecord(categories, 'bands').min = 1;
        },
      ],
      [
        'result message',
        (payload) => {
          const categories = childRecord(payload, 'resultCategories');
          firstChildRecord(categories, 'bands').message = 'Changed result message.';
        },
      ],
      [
        'result recommendation',
        (payload) => {
          const categories = childRecord(payload, 'resultCategories');
          firstChildRecord(categories, 'bands').recommendation = 'Changed recommendation.';
        },
      ],
      [
        'result override',
        (payload) => {
          const categories = childRecord(payload, 'resultCategories');
          firstChildRecord(categories, 'overrides').minCategory = 'Changed category';
        },
      ],
      [
        'root educational disclaimer',
        (payload) => {
          payload.disclaimers = ['Changed educational disclaimer.'];
        },
      ],
      [
        'medical content block',
        (payload) => {
          const content = childRecord(payload, 'content');
          firstChildRecord(content, 'blocks').markdown = 'Changed medical content.';
        },
      ],
      [
        'medical claim',
        (payload) => {
          const content = childRecord(payload, 'content');
          firstChildRecord(content, 'claims').text = 'Changed medical claim.';
        },
      ],
      [
        'claim citation',
        (payload) => {
          const content = childRecord(payload, 'content');
          firstChildRecord(content, 'citations').localRef = 'changed-source#section-2';
        },
      ],
      [
        'calculator source verification',
        (payload) => {
          firstChildRecord(payload, 'sources').verification = 'needs-verification';
        },
      ],
      [
        'Niro source status',
        (payload) => {
          childRecord(payload, 'NIRO_SOURCE_STATUS').explanation = 'Changed source status.';
        },
      ],
      [
        'governance evidence',
        (payload) => {
          childRecord(payload, 'governance').sourceReviewExpiresAt = '2028-08-30T00:00:00.000Z';
        },
      ],
      [
        'required saved-test evidence',
        (payload) => {
          const testCase = firstChildRecord(payload, 'testCases');
          childRecord(testCase, 'expected').finalScore = 2;
        },
      ],
      [
        'engine semantic version',
        (payload) => {
          payload.engineSemanticVersion = '2.0.0';
        },
      ],
      [
        'result presentation contract',
        (payload) => {
          const uiConfig = childRecord(payload, 'uiConfig');
          childRecord(uiConfig, 'result').layout = ['category'];
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const changed = structuredClone(baselinePayload);
      mutate(changed);
      expect(
        protectedReviewHash(changed, measurementRevisionIds, measurementSnapshots),
        label,
      ).not.toBe(baseline);
    }

    expect(
      protectedReviewHash(baselinePayload, ['measurement-revision-2'], measurementSnapshots),
      'measurement revision identity',
    ).not.toBe(baseline);
    expect(
      protectedReviewHash(baselinePayload, measurementRevisionIds, [
        { key: 'test-marker', revision: 1, definitionHash: 'hash-2' },
      ]),
      'measurement snapshot',
    ).not.toBe(baseline);
  });

  it('excludes only lifecycle version and status from the protected review hash', () => {
    const baselinePayload = protectedReviewPayload();
    const baseline = protectedReviewHash(baselinePayload, [], []);
    const lifecycleCopy = structuredClone(baselinePayload);
    lifecycleCopy.version = 4;
    lifecycleCopy.status = 'published';

    expect(protectedReviewHash(lifecycleCopy, [], [])).toBe(baseline);

    lifecycleCopy.calculatorSlug = 'changed-calculator';
    expect(protectedReviewHash(lifecycleCopy, [], [])).not.toBe(baseline);
  });

  it('bounds nested draft JSON while allowing the contract discriminator', () => {
    expect(
      draftPayloadSafetyIssue({
        $schema: 'niro-platform/calculator-version.v1',
        nested: [{ safe: true }],
      }),
    ).toBeUndefined();
    expect(draftPayloadSafetyIssue({ nested: { $where: 'unsafe' } })).toContain(
      'operator-like key',
    );
    expect(draftPayloadSafetyIssue(JSON.parse('{"__proto__":{"polluted":true}}'))).toContain(
      'forbidden key',
    );
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 42; index += 1) nested = { nested };
    expect(draftPayloadSafetyIssue(nested)).toContain('nesting depth');
  });

  it('returns 401 before touching calculator persistence when authentication is absent', async () => {
    const find = vi.spyOn(CalculatorVersionModel, 'findOne');

    const response = await fetch(`${baseUrl}/api/v1/admin/calculators/test/versions/1`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid bearer token', async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      headers: { authorization: 'Bearer not-a-valid-token' },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_TOKEN' } });
  });

  it('returns 403 when an editor accesses an admin-only user-management endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: authHeaders('editor'),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('returns 403 when a medical reviewer accesses an editor-only mutation', async () => {
    const response = await fetch(`${baseUrl}/api/v1/admin/calculators`, {
      method: 'POST',
      headers: { ...authHeaders('medical-reviewer'), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('requires If-Match for draft edits and rejects a stale validator', async () => {
    const record = draftVersion({ calculatorSlug: 'test-calculator', version: 1 });
    vi.spyOn(CalculatorVersionModel, 'findOne').mockResolvedValue(record as never);

    const missing = await fetch(`${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1`, {
      method: 'PATCH',
      headers: { ...authHeaders('editor'), 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { calculatorSlug: 'test-calculator', version: 1 } }),
    });
    const stale = await fetch(`${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1`, {
      method: 'PATCH',
      headers: {
        ...authHeaders('editor'),
        'content-type': 'application/json',
        'if-match': '"stale-version"',
      },
      body: JSON.stringify({ payload: { calculatorSlug: 'test-calculator', version: 1 } }),
    });

    expect(missing.status).toBe(428);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: 'IF_MATCH_REQUIRED' },
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
    });
    expect(record.save).not.toHaveBeenCalled();
  });

  it('rejects unknown admin body fields before persistence', async () => {
    const find = vi.spyOn(CalculatorVersionModel, 'findOne');
    const response = await fetch(
      `${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1/preview`,
      {
        method: 'POST',
        headers: { ...authHeaders('editor'), 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: {}, $where: 'never execute data' }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST', fields: { unknown: ['$where'] } },
    });
    expect(find).not.toHaveBeenCalled();
  });

  it('accepts the current ETag for a draft edit and returns a fresh ETag', async () => {
    const record = draftVersion({ calculatorSlug: 'test-calculator', version: 1, content: {} });
    vi.spyOn(CalculatorVersionModel, 'findOne').mockResolvedValue(record as never);
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

    const read = await fetch(`${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1`, {
      headers: authHeaders('editor'),
    });
    const etag = read.headers.get('etag');
    expect(read.status).toBe(200);
    expect(etag).toBeTruthy();

    const update = await fetch(`${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1`, {
      method: 'PATCH',
      headers: {
        ...authHeaders('editor'),
        'content-type': 'application/json',
        'if-match': etag ?? '',
      },
      body: JSON.stringify({
        payload: { calculatorSlug: 'test-calculator', version: 1, content: { title: 'New' } },
      }),
    });

    expect(update.status).toBe(200);
    expect(update.headers.get('etag')).toBeTruthy();
    expect(update.headers.get('etag')).not.toBe(etag);
    expect(record.save).toHaveBeenCalledOnce();
  });

  it('rejects malformed preview inputs and drafts that are not executable', async () => {
    const record = draftVersion({});
    vi.spyOn(CalculatorVersionModel, 'findOne').mockResolvedValue(record as never);

    const malformed = await fetch(
      `${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1/preview`,
      {
        method: 'POST',
        headers: { ...authHeaders('editor'), 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: [] }),
      },
    );
    const nonExecutable = await fetch(
      `${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1/preview`,
      {
        method: 'POST',
        headers: { ...authHeaders('editor'), 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: {} }),
      },
    );

    expect(malformed.status).toBe(422);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    });
    expect(nonExecutable.status).toBe(422);
    await expect(nonExecutable.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('accepts every expectation allowed by the saved-test contract', async () => {
    const record = draftVersion(executableTestCasePayload());
    vi.spyOn(CalculatorVersionModel, 'findOne').mockResolvedValue(record as never);
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

    const response = await fetch(
      `${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1/test-cases`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders('editor'),
          'content-type': 'application/json',
          'if-match': '"initial-version-hash"',
        },
        body: JSON.stringify({
          testCases: [
            {
              key: 'multi-assertion-case',
              name: 'Multiple declared expectations',
              kind: 'regression',
              inputs: { age: 40 },
              expected: { finalScore: 2, category: 'high' },
            },
          ],
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        testCases: [
          {
            key: 'multi-assertion-case',
            expected: { finalScore: 2, category: 'high' },
          },
        ],
      },
    });
    expect(record.save).toHaveBeenCalledOnce();
  });

  it('runs saved boundary cases deterministically without persisting a result', async () => {
    const record = draftVersion(executableTestCasePayload());
    vi.spyOn(CalculatorVersionModel, 'findOne').mockResolvedValue(record as never);

    const response = await fetch(
      `${baseUrl}/api/v1/admin/calculators/test-calculator/versions/1/test-cases/run`,
      {
        method: 'POST',
        headers: authHeaders('editor'),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        passed: true,
        cases: [
          {
            key: 'age-high-boundary',
            passed: true,
            result: { ok: true, score: 2, category: 'high', errors: [] },
          },
        ],
      },
    });
    expect(record.save).not.toHaveBeenCalled();
  });

  it('requires resolved sources and valid conversions before medical verification', async () => {
    const noSource = draftMeasurement([]);
    const unresolvedSource = draftMeasurement([
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'needs-verification',
      },
    ]);
    const invalidConversion = draftMeasurement(
      [
        {
          id: 'test-source',
          type: 'internal',
          title: 'Test source',
          ref: 'test',
          verification: 'source-provided',
          claimIds: ['conversion-claim'],
        },
      ],
      {
        conversions: [
          {
            kind: 'affine',
            fromUnit: 'other-unit',
            toUnit: 'ratio',
            factor: 1,
            offset: 0,
            sourceClaimIds: ['conversion-claim'],
          },
        ],
      },
    );
    const valid = draftMeasurement([
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
      },
    ]);
    const blocked = draftMeasurement(
      [
        {
          id: 'test-source',
          type: 'internal',
          title: 'Test source',
          ref: 'test',
          verification: 'source-provided',
        },
      ],
      { governance: { publishBlockers: ['Clinical source mapping requires review.'] } },
    );
    vi.spyOn(MeasurementRevisionModel, 'findOne')
      .mockResolvedValueOnce(noSource as never)
      .mockResolvedValueOnce(unresolvedSource as never)
      .mockResolvedValueOnce(invalidConversion as never)
      .mockResolvedValueOnce(blocked as never)
      .mockResolvedValueOnce(valid as never);
    vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);

    const verify = () =>
      fetch(`${baseUrl}/api/v1/admin/biomarkers/test-marker/1/verify`, {
        method: 'POST',
        headers: authHeaders('medical-reviewer'),
      });
    const missing = await verify();
    const unresolved = await verify();
    const invalid = await verify();
    const publishBlocked = await verify();
    const accepted = await verify();

    expect(missing.status).toBe(422);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'SOURCE_REQUIRED' } });
    expect(unresolved.status).toBe(422);
    await expect(unresolved.json()).resolves.toMatchObject({
      error: { code: 'SOURCE_UNRESOLVED' },
    });
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'MEASUREMENT_SEMANTIC_INVALID' },
    });
    expect(publishBlocked.status).toBe(422);
    await expect(publishBlocked.json()).resolves.toMatchObject({
      error: {
        code: 'MEASUREMENT_PUBLISH_BLOCKED',
        fields: { blockerCount: 1 },
      },
    });
    expect(blocked.save).not.toHaveBeenCalled();
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({ data: { status: 'verified' } });
    expect(valid.save).toHaveBeenCalledOnce();
  });

  it('does not accept a source id as evidence for a claim id', async () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
      },
    ];
    const record = draftMeasurement(sources, {
      referenceRanges: [
        {
          id: 'fixture-range',
          label: 'Fixture range',
          unit: 'ratio',
          interval: { min: 1, max: 2, minInclusive: true, maxInclusive: true },
          context: {},
          interpretationOnly: true,
          sourceClaimIds: ['test-source'],
        },
      ],
    });
    vi.spyOn(MeasurementRevisionModel, 'findOne').mockResolvedValue(record as never);

    const response = await fetch(`${baseUrl}/api/v1/admin/biomarkers/test-marker/1/verify`, {
      method: 'POST',
      headers: authHeaders('medical-reviewer'),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'MEASUREMENT_SEMANTIC_INVALID',
        message: 'Reference range 0 references unresolved claim test-source.',
      },
    });
    expect(record.save).not.toHaveBeenCalled();
  });

  it('rejects expired review evidence and soft input bounds outside hard bounds', async () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
      },
    ];
    const expired = draftMeasurement(sources, {
      governance: { reviewExpiresAt: '2000-01-01T00:00:00.000Z' },
    });
    const outside = draftMeasurement(sources, {
      inputBounds: {
        hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
        soft: { min: -1, max: 90, minInclusive: true, maxInclusive: true },
      },
    });
    const rangeSources = [
      {
        ...sources[0],
        claimIds: ['range-claim'],
      },
    ];
    const expiredRange = draftMeasurement(rangeSources, {
      referenceRanges: [
        {
          id: 'expired-range',
          label: 'Expired fixture range',
          unit: 'ratio',
          interval: { min: 1, max: 2, minInclusive: true, maxInclusive: true },
          context: {},
          interpretationOnly: true,
          sourceClaimIds: ['range-claim'],
          reviewExpiresAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    });
    vi.spyOn(MeasurementRevisionModel, 'findOne')
      .mockResolvedValueOnce(expired as never)
      .mockResolvedValueOnce(outside as never)
      .mockResolvedValueOnce(expiredRange as never);

    const verify = () =>
      fetch(`${baseUrl}/api/v1/admin/biomarkers/test-marker/1/verify`, {
        method: 'POST',
        headers: authHeaders('medical-reviewer'),
      });
    const expiredResponse = await verify();
    const outsideResponse = await verify();
    const expiredRangeResponse = await verify();

    expect(expiredResponse.status).toBe(422);
    await expect(expiredResponse.json()).resolves.toMatchObject({
      error: { code: 'MEASUREMENT_REVIEW_EXPIRED' },
    });
    expect(outsideResponse.status).toBe(422);
    await expect(outsideResponse.json()).resolves.toMatchObject({
      error: {
        code: 'MEASUREMENT_SEMANTIC_INVALID',
        message: 'Soft input bounds cannot extend below hard input bounds.',
      },
    });
    expect(expiredRangeResponse.status).toBe(422);
    await expect(expiredRangeResponse.json()).resolves.toMatchObject({
      error: { code: 'MEASUREMENT_REVIEW_EXPIRED' },
    });
  });

  it('checks each present interval bound for finiteness', () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
      },
    ];
    const minOnly = canonicalDraftMeasurementDefinition(sources, {
      inputBounds: { hard: { min: Number.POSITIVE_INFINITY, minInclusive: true } },
    });
    const maxOnly = canonicalDraftMeasurementDefinition(sources, {
      inputBounds: { hard: { max: Number.NEGATIVE_INFINITY, maxInclusive: true } },
    });

    expect(measurementDefinitionIssue(minOnly, sources)).toBe(
      'Hard input bounds min must be a finite number.',
    );
    expect(measurementDefinitionIssue(maxOnly, sources)).toBe(
      'Hard input bounds max must be a finite number.',
    );
  });

  it('fails closed with the stable v1 code for every derived verification attempt', async () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
        claimIds: ['derived-claim'],
      },
    ];
    const record = draftMeasurement(sources, {
      kind: 'derived-measurement',
      derived: {
        expression: 'test-marker-input',
        dependsOn: ['test-marker-input'],
        semanticVersion: '1.0.0',
        sourceClaimIds: ['derived-claim'],
      },
    });
    Object.assign(record, { kind: 'derived' });
    vi.spyOn(MeasurementRevisionModel, 'findOne').mockResolvedValue(record as never);

    const response = await fetch(`${baseUrl}/api/v1/admin/biomarkers/test-marker/1/verify`, {
      method: 'POST',
      headers: authHeaders('medical-reviewer'),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'DERIVED_VERIFICATION_UNSUPPORTED_V1' },
    });
    expect(record.save).not.toHaveBeenCalled();
  });

  it('requires controlled unit pairs and one route for every noncanonical scalar unit', () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
        claimIds: ['conversion-claim'],
      },
    ];
    const missingRoute = canonicalDraftMeasurementDefinition(sources, {
      canonicalUnit: { code: 'mg/dL', dimension: 'mass-concentration', display: 'mg/dL' },
      acceptedUnits: [
        { code: 'mg/dL', dimension: 'mass-concentration', display: 'mg/dL' },
        { code: 'mg/L', dimension: 'mass-concentration', display: 'mg/L' },
      ],
    });
    expect(measurementDefinitionIssue(missingRoute, sources)).toBe(
      'Accepted noncanonical unit mg/L must have exactly one conversion to mg/dL.',
    );

    const routed = {
      ...missingRoute,
      conversions: [
        {
          kind: 'affine',
          fromUnit: 'mg/L',
          toUnit: 'mg/dL',
          factor: 0.1,
          offset: 0,
          sourceClaimIds: ['conversion-claim'],
        },
      ],
    };
    expect(measurementDefinitionIssue(routed, sources)).toBeUndefined();

    const unknownPair = canonicalDraftMeasurementDefinition(sources, {
      canonicalUnit: { code: 'mystery', dimension: 'dimensionless', display: 'mystery' },
      acceptedUnits: [{ code: 'mystery', dimension: 'dimensionless', display: 'mystery' }],
    });
    expect(measurementDefinitionIssue(unknownPair, sources)).toBe(
      'Canonical unit mystery is not registered with dimension dimensionless.',
    );
  });

  it('accepts only the exact declared composite adapters and coherent conflict groups', () => {
    const sources = [
      {
        id: 'test-source',
        type: 'internal',
        title: 'Test source',
        ref: 'test',
        verification: 'source-provided',
        claimIds: ['adapter-claim', 'range-a', 'range-b'],
      },
    ];
    const exactAdapter = canonicalDraftMeasurementDefinition(sources, {
      canonicalUnit: { code: 'cm', dimension: 'length', display: 'cm' },
      acceptedUnits: [{ code: 'cm', dimension: 'length', display: 'cm' }],
      conversions: [
        {
          kind: 'composite',
          adapter: 'feet-inches-to-centimetres',
          from: [
            { field: 'feet', unit: 'ft' },
            { field: 'inches', unit: 'in' },
          ],
          toUnit: 'cm',
          sourceClaimIds: ['adapter-claim'],
        },
      ],
      referenceRanges: [
        {
          id: 'range-a',
          label: 'Range A',
          unit: 'cm',
          interval: { min: 1, minInclusive: true },
          context: {},
          interpretationOnly: true,
          sourceClaimIds: ['range-a'],
          conflictGroup: 'height-conflict',
        },
        {
          id: 'range-b',
          label: 'Range B',
          unit: 'cm',
          interval: { max: 2, maxInclusive: true },
          context: {},
          interpretationOnly: true,
          sourceClaimIds: ['range-b'],
          conflictGroup: 'height-conflict',
        },
      ],
      governance: { conflictIds: ['height-conflict'] },
    });
    expect(measurementDefinitionIssue(exactAdapter, sources)).toBeUndefined();

    const invalidAdapter = structuredClone(exactAdapter);
    const conversion = (invalidAdapter.conversions as Record<string, unknown>[])[0];
    if (conversion)
      conversion.from = [
        { field: 'ft', unit: 'ft' },
        { field: 'in', unit: 'in' },
      ];
    expect(measurementDefinitionIssue(invalidAdapter, sources)).toBe(
      'Composite conversion 0 has invalid component fields.',
    );

    const singletonConflict = structuredClone(exactAdapter);
    (singletonConflict.referenceRanges as unknown[]).pop();
    expect(measurementDefinitionIssue(singletonConflict, sources)).toBe(
      'Conflict group height-conflict must identify at least two reference ranges.',
    );

    const unbounded = canonicalDraftMeasurementDefinition(sources, {
      inputBounds: { hard: {} },
    });
    expect(measurementDefinitionIssue(unbounded, sources)).toBe(
      'Hard input bounds must declare at least one finite bound.',
    );
  });
});
