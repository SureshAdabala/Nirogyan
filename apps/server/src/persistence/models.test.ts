import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';

import {
  AdminGovernanceLockModel,
  AdminSessionModel,
  AdminUserModel,
  AuditLogModel,
  AnalyticsDailyModel,
  AnalyticsAttributionClaimModel,
  AnalyticsEventModel,
  AnalyticsMaterializationLockModel,
  AnonymousVisitorModel,
  AssessmentModel,
  CalculatorModel,
  CalculatorVersionModel,
  CacheInvalidationEventModel,
  JobRunModel,
  LeadModel,
  LoginAttemptModel,
  MeasurementRevisionModel,
  ResultModel,
} from './models';
import {
  classifyMeasurementTextIndexes,
  measurementRevisionMutationIssue,
  measurementRevisionUpdateIssue,
} from './models/measurement-revision';
import {
  calculatorVersionMutationIssue,
  calculatorVersionUpdateIssue,
} from './models/calculator-version';

describe('MongoDB persistence baseline models', () => {
  it('registers the required collections and indexes without a database connection', () => {
    expect(CalculatorModel.collection.name).toBe('calculators');
    expect(CalculatorVersionModel.collection.name).toBe('calculator_versions');
    expect(MeasurementRevisionModel.collection.name).toBe('biomarkers');
    expect(AdminSessionModel.collection.name).toBe('admin_sessions');
    expect(AdminGovernanceLockModel.collection.name).toBe('admin_governance_locks');
    expect(AdminUserModel.collection.name).toBe('admin_users');
    expect(AuditLogModel.collection.name).toBe('audit_logs');
    expect(AnalyticsDailyModel.collection.name).toBe('analytics_daily');
    expect(AnalyticsAttributionClaimModel.collection.name).toBe('analytics_attribution_claims');
    expect(AnalyticsAttributionClaimModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
    expect(AnalyticsEventModel.collection.name).toBe('analytics_events');
    expect(AnalyticsMaterializationLockModel.collection.name).toBe(
      'analytics_materialization_locks',
    );
    expect(AnalyticsEventModel.schema.path('utmTerm')).toBeUndefined();
    expect(AnalyticsEventModel.schema.path('utmContent')).toBeUndefined();
    expect(AnonymousVisitorModel.collection.name).toBe('anonymous_visitors');
    expect(AnonymousVisitorModel.schema.path('metadata')).toBeUndefined();
    expect(AssessmentModel.collection.name).toBe('assessments');
    expect(JobRunModel.collection.name).toBe('job_runs');
    expect(LeadModel.collection.name).toBe('leads');
    expect(LoginAttemptModel.collection.name).toBe('login_attempts');
    expect(ResultModel.collection.name).toBe('results');
    expect(AnalyticsDailyModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          {
            day: 1,
            timezone: 1,
            scope: 1,
            scopeKey: 1,
            identityBasis: 1,
            identityKeyVersion: 1,
          },
          expect.objectContaining({ unique: true, name: 'analytics_daily_partition_unique_v3' }),
        ],
      ]),
    );

    expect(CalculatorVersionModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { calculatorId: 1, version: -1 },
          { background: true, unique: true },
        ],
        [{ calculatorSlug: 1, status: 1 }, { background: true }],
      ]),
    );
    expect(MeasurementRevisionModel.schema.get('autoIndex')).toBe(false);
    expect(MeasurementRevisionModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { key: 1, revision: 1 },
          { background: true, unique: true },
        ],
        [
          { status: 1, key: 1, revision: -1 },
          { background: true, name: 'biomarker_public_latest_v1' },
        ],
        [
          { status: 1, 'definition.domainKeys': 1, key: 1, revision: -1 },
          { background: true, name: 'biomarker_public_domain_v1' },
        ],
        [
          { displayName: 'text', key: 'text', 'definition.aliases': 'text' },
          {
            background: true,
            default_language: 'english',
            language_override: 'language',
            name: 'biomarker_public_text_v1',
            weights: { displayName: 10, key: 8, 'definition.aliases': 6 },
          },
        ],
      ]),
    );
    expect(CacheInvalidationEventModel.collection.name).toBe('cache_invalidation_events');
    expect(CacheInvalidationEventModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ status: 1, createdAt: 1 }, { background: true }],
        [{ status: 1, nextRetryAt: 1, leaseExpiresAt: 1, createdAt: 1 }, { background: true }],
        [{ expiresAt: 1 }, { background: true, expireAfterSeconds: 0 }],
      ]),
    );
    expect(AdminSessionModel.schema.indexes()).toEqual(
      expect.arrayContaining([[{ expiresAt: 1 }, { background: true, expireAfterSeconds: 0 }]]),
    );
    expect(LeadModel.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ email: 1 }, { background: true }],
        [{ createdAt: -1 }, { background: true }],
        [{ expiresAt: 1 }, { background: true, expireAfterSeconds: 0 }],
      ]),
    );
    const validSketch = new AnalyticsDailyModel({
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      identitySketch: Array.from({ length: 64 }, () => 0),
      rolledUpAt: new Date(),
    });
    expect(validSketch.validateSync()).toBeUndefined();
    validSketch.identitySketch[0] = 66;
    expect(validSketch.validateSync()?.errors.identitySketch).toBeDefined();
  });

  it('protects published and retired calculator versions through document and query mutations', () => {
    const draftWithoutReviewEvidence = new CalculatorVersionModel({
      calculatorId: new Types.ObjectId(),
      calculatorSlug: 'draft-without-review',
      version: 1,
      status: 'draft',
      engineSemanticVersion: '1.0.0',
      payload: {},
    });
    expect(draftWithoutReviewEvidence.validateSync()).toBeUndefined();

    const published = {
      _id: new Types.ObjectId(),
      calculatorId: new Types.ObjectId(),
      calculatorSlug: 'nonclinical-example',
      version: 1,
      status: 'published',
      schemaId: 'urn:niro:schema:calculator-version:v1',
      engineSemanticVersion: '1.0.0',
      payload: { status: 'approved', scoringRules: [{ key: 'one' }] },
      measurementRevisionIds: ['507f1f77bcf86cd799439011'],
      measurementSnapshots: [{ key: 'marker', revision: 1 }],
      sourceHash: 'source',
      logicHash: 'logic',
      contentHash: 'content',
      reviewHash: 'review',
      versionHash: 'version',
      createdBy: new Types.ObjectId(),
      lastEditedBy: new Types.ObjectId(),
      approvedBy: new Types.ObjectId(),
      approvedAt: new Date('2026-08-27T00:00:00.000Z'),
      reviewEvidence: {
        reviewerId: new Types.ObjectId(),
        reviewedAt: new Date('2026-08-27T00:00:00.000Z'),
        decision: 'approved',
        scope: 'full-version',
        protectedHash: 'review',
      },
      publishedAt: new Date('2026-08-27T01:00:00.000Z'),
      immutableAt: new Date('2026-08-27T01:00:00.000Z'),
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
      updatedAt: new Date('2026-08-27T01:00:00.000Z'),
    };

    expect(calculatorVersionMutationIssue(published, { ...published })).toBeUndefined();
    expect(
      calculatorVersionMutationIssue(published, { ...published, status: 'retired' }),
    ).toBeUndefined();
    expect(
      calculatorVersionMutationIssue(published, {
        ...published,
        status: 'draft',
        payload: { status: 'draft' },
      }),
    ).toContain('immutable');
    expect(
      calculatorVersionUpdateIssue(published, { $set: { 'payload.name': 'mutated' } }),
    ).toContain('immutable');
    expect(
      calculatorVersionUpdateIssue(published, { $set: { status: 'retired' } }),
    ).toBeUndefined();
    expect(
      calculatorVersionUpdateIssue(
        { ...published, status: 'retired' },
        { $set: { status: 'retired' } },
      ),
    ).toContain('immutable');
    expect(
      calculatorVersionUpdateIssue(published, { ...published, status: 'retired' }, true),
    ).toBeUndefined();
  });

  it('classifies only the exact known legacy or expected biomarker text index as replaceable', () => {
    expect(classifyMeasurementTextIndexes([{ name: '_id_', key: { _id: 1 } }])).toEqual({
      kind: 'missing',
    });
    expect(
      classifyMeasurementTextIndexes([
        {
          name: 'displayName_text_key_text',
          key: { _fts: 'text', _ftsx: 1 },
          weights: { displayName: 1, key: 1 },
          default_language: 'english',
          language_override: 'language',
          textIndexVersion: 3,
        },
      ]),
    ).toEqual({ kind: 'legacy', name: 'displayName_text_key_text' });
    expect(
      classifyMeasurementTextIndexes([
        {
          name: 'biomarker_public_text_v1',
          key: { _fts: 'text', _ftsx: 1 },
          weights: { displayName: 10, key: 8, 'definition.aliases': 6 },
          default_language: 'english',
          language_override: 'language',
          textIndexVersion: 3,
        },
      ]),
    ).toEqual({ kind: 'expected', name: 'biomarker_public_text_v1' });
    expect(
      classifyMeasurementTextIndexes([
        {
          name: 'biomarker_public_text_v1',
          key: { _fts: 'text', _ftsx: 1 },
          weights: { displayName: 10, key: 8, 'definition.aliases': 6 },
          default_language: 'none',
          language_override: 'language',
          textIndexVersion: 3,
        },
      ]),
    ).toEqual({
      kind: 'unexpected',
      descriptions: ['biomarker_public_text_v1:definition.aliases,displayName,key'],
    });
    expect(
      classifyMeasurementTextIndexes([
        {
          name: 'unexpected_text',
          key: { _fts: 'text', _ftsx: 1 },
          weights: { 'definition.description.whatItMeasures': 1 },
        },
      ]),
    ).toEqual({
      kind: 'unexpected',
      descriptions: ['unexpected_text:definition.description.whatItMeasures'],
    });
  });

  it('retains source-preserving measurement migration metadata in the persistence envelope', () => {
    const measurement = new MeasurementRevisionModel({
      key: 'fixture-measurement',
      revision: 1,
      status: 'draft',
      displayName: 'Fixture measurement',
      kind: 'biomarker',
      canonicalUnit: 'mg/dL',
      definition: {},
      definitionHash: 'fixture-hash',
      sources: [],
      migrationProvenance: {
        sourcePath: 'data/fixtures/config-samples/biomarker-dataset.json',
        sourceKey: 'fixture-measurement',
      },
    });
    expect(measurement.toObject().migrationProvenance).toEqual({
      sourcePath: 'data/fixtures/config-samples/biomarker-dataset.json',
      sourceKey: 'fixture-measurement',
    });
  });

  it('allows only the exact verified-to-retired metadata transition', () => {
    const original = {
      _id: new Types.ObjectId(),
      key: 'fixture-measurement',
      revision: 2,
      status: 'verified',
      displayName: 'Fixture measurement',
      kind: 'biomarker',
      canonicalUnit: 'ratio',
      definition: { stable: true },
      definitionHash: 'definition-hash',
      sources: [{ id: 'source' }],
      reviewedBy: new Types.ObjectId(),
      reviewHash: 'review-hash',
      verifiedAt: new Date('2026-08-26T00:00:00.000Z'),
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    };
    expect(measurementRevisionMutationIssue(original, { ...original })).toBeUndefined();
    expect(
      measurementRevisionMutationIssue(original, {
        ...original,
        status: 'retired',
        retiredAt: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).toBeUndefined();
    expect(
      measurementRevisionMutationIssue(original, {
        ...original,
        status: 'retired',
        retiredAt: new Date('2026-08-27T00:00:00.000Z'),
        definition: { stable: false },
      }),
    ).toContain('immutable');
    expect(
      measurementRevisionMutationIssue(
        { ...original, status: 'retired', retiredAt: new Date('2026-08-27T00:00:00.000Z') },
        { ...original, status: 'verified' },
      ),
    ).toContain('immutable');
  });

  it('blocks protected revisions through every query-update shape except exact retirement', () => {
    const original = {
      key: 'fixture-measurement',
      revision: 2,
      status: 'verified',
      displayName: 'Fixture measurement',
      kind: 'biomarker',
      canonicalUnit: 'ratio',
      definition: { stable: true },
      definitionHash: 'definition-hash',
      sources: [],
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    };
    expect(
      measurementRevisionUpdateIssue(original, { $set: { 'definition.stable': false } }),
    ).toContain('immutable');
    expect(
      measurementRevisionUpdateIssue(original, {
        $set: { status: 'retired', retiredAt: new Date('2026-08-27T00:00:00.000Z') },
      }),
    ).toBeUndefined();
    expect(
      measurementRevisionUpdateIssue(
        original,
        {
          ...original,
          status: 'retired',
          retiredAt: new Date('2026-08-27T00:00:00.000Z'),
        },
        true,
      ),
    ).toBeUndefined();
    expect(
      measurementRevisionUpdateIssue(original, { $rename: { definition: 'changed' } }),
    ).toContain('immutable');
    expect(measurementRevisionUpdateIssue(original, { $unset: { updatedAt: 1 } })).toContain(
      'immutable',
    );
  });

  it('keeps lead documents TTL-bound and free of health-result linkage fields', () => {
    const lead = new LeadModel({
      email: 'PERSON@example.test',
      consent: true,
      consentVersion: 'privacy-v1',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      resultId: 'must-not-persist',
      assessmentId: 'must-not-persist',
      calculatorSlug: 'must-not-persist',
      visitorId: 'must-not-persist',
    } as never);
    expect(lead.validateSync()).toBeUndefined();
    const value = lead.toObject() as unknown as Record<string, unknown>;
    expect(value.resultId).toBeUndefined();
    expect(value.assessmentId).toBeUndefined();
    expect(value.calculatorSlug).toBeUndefined();
    expect(value.visitorId).toBeUndefined();

    const withoutConsent = new LeadModel({
      email: 'person@example.test',
      consent: false,
      consentVersion: 'privacy-v1',
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
    } as never);
    expect(withoutConsent.validateSync()?.errors.consent).toBeDefined();
  });
});
