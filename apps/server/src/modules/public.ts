import { createHash, randomBytes } from 'node:crypto';

import { calculate, ENGINE_SEMANTIC_VERSION } from '@niro/engine';
import { Router, type Request, type Response } from 'express';
import type { PipelineStage } from 'mongoose';

import { MeasurementRevisionModel } from '../persistence/models/measurement-revision';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { AssessmentModel } from '../persistence/models/assessment';
import { LeadModel } from '../persistence/models/lead';
import { ResultModel } from '../persistence/models/result';
import { withTransaction } from '../persistence/transactions';
import { isApprovedMeasurementEnvelope } from './measurement-contract';

type JsonRecord = Record<string, unknown>;
const RESULT_LAYOUT_BLOCKS = [
  'score-gauge',
  'category',
  'key-contributors',
  'domain-breakdown',
  'biomarker-details',
  'recommendations',
] as const;
type ResultLayoutBlock = (typeof RESULT_LAYOUT_BLOCKS)[number];
type ScoreDirection = 'higher-is-worse' | 'lower-is-worse' | 'higher-is-better' | 'lower-is-better';

export interface ResultPresentation {
  readonly calculatorSlug: string;
  readonly calculatorVersion: number;
  readonly name: string;
  readonly shortDescription: string;
  readonly disclaimers: readonly string[];
  readonly resultLayout: readonly ResultLayoutBlock[];
  readonly scoreScale?: {
    readonly min: number;
    readonly max: number;
    readonly direction: ScoreDirection;
  };
  readonly parameters: readonly {
    readonly key: string;
    readonly label: string;
    readonly biomarkerKey?: string;
    readonly canonicalUnit?: string;
  }[];
  readonly domains: readonly { readonly key: string; readonly label: string }[];
  readonly releaseState?: 'testing-unapproved';
}

export interface PublishedCalculatorRecord {
  readonly id?: string;
  readonly calculatorSlug: string;
  readonly version: number;
  readonly payload: JsonRecord;
  readonly releaseState?: 'testing-unapproved';
}

export interface PublicCatalogSource {
  readonly listPublished: () => Promise<readonly PublishedCalculatorRecord[]>;
  readonly getPublished: (slug: string) => Promise<PublishedCalculatorRecord | undefined>;
  readonly getUnavailableStatus?: (slug: string) => Promise<'retired' | undefined>;
}

export interface AssessmentStore {
  readonly save: (assessment: {
    readonly calculatorSlug: string;
    readonly versionId?: string;
    readonly version: number;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly result: ReturnType<typeof calculate>;
    readonly computeMs?: number;
    /** Present for HTTP assessments; optional only for legacy direct-store callers. */
    readonly presentation?: ResultPresentation;
    readonly visitorId?: string;
    readonly sessionId?: string;
    readonly omitted?: readonly string[];
    readonly idempotencyKey?: string;
  }) => Promise<{ readonly id: string; readonly shareToken: string }>;
}

export interface LeadStore {
  readonly save: (lead: {
    readonly email: string;
    readonly consentVersion: string;
  }) => Promise<void>;
}

export interface ResultSource {
  readonly getByShareToken: (shareToken: string) => Promise<JsonRecord | undefined>;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('The idempotency key has already been used for a different assessment request.');
    this.name = 'IdempotencyConflictError';
  }
}

export function createMongoAssessmentStore(options: {
  readonly retentionDays: number;
}): AssessmentStore {
  if (!Number.isSafeInteger(options.retentionDays) || options.retentionDays < 1) {
    throw new Error('Assessment retention must be a positive integer number of days.');
  }
  return {
    async save(assessment) {
      const idempotencyKeyHash = assessment.idempotencyKey
        ? hashIdempotencyKey(assessment.calculatorSlug, assessment.idempotencyKey)
        : undefined;
      try {
        return await withTransaction(async (session) => {
          if (idempotencyKeyHash) {
            const existing = await AssessmentModel.findOne({ idempotencyKeyHash })
              .session(session)
              .lean();
            if (existing) throw new IdempotencyConflictError();
          }
          const now = new Date();
          const expiresAt = new Date(now.getTime() + options.retentionDays * 86_400_000);
          const inputsCanonical = Object.fromEntries(
            assessment.result.parameters
              .filter((parameter) => parameter.value !== undefined)
              .map((parameter) => [
                parameter.key,
                { value: parameter.value, unit: parameter.canonicalUnit },
              ]),
          );
          const conversionHash = createHash('sha256')
            .update(JSON.stringify(inputsCanonical))
            .digest('hex');
          const assessmentDocument = new AssessmentModel({
            calculatorSlug: assessment.calculatorSlug,
            calculatorVersionId: assessment.versionId,
            calculatorVersion: assessment.version,
            engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
            inputsEntered: assessment.inputs,
            inputsCanonical,
            conversionHash,
            visitorId: assessment.visitorId,
            sessionId: assessment.sessionId,
            omittedParameters: [...(assessment.omitted ?? [])],
            idempotencyKeyHash,
            expiresAt,
          });
          await assessmentDocument.save({ session });
          const shareToken = randomBytes(32).toString('base64url');
          const shareTokenHash = createHash('sha256').update(shareToken).digest('hex');
          const resultDocument = new ResultModel({
            assessmentId: assessmentDocument._id,
            calculatorVersionId: assessment.versionId,
            calculatorSlug: assessment.calculatorSlug,
            calculatorVersion: assessment.version,
            engineSemanticVersion: ENGINE_SEMANTIC_VERSION,
            score: assessment.result.score,
            computeMs: assessment.computeMs,
            category: assessment.result.category,
            projection: {
              score: assessment.result.score,
              category: assessment.result.category,
              parameters: assessment.result.parameters,
              domains: assessment.result.domains,
              coverage: assessment.result.coverage,
              contributors: assessment.result.contributors,
              formulas: assessment.result.formulas,
              warnings: assessment.result.warnings,
              presentation: publicResultPresentation(assessment.presentation),
            },
            trace: assessment.result.trace,
            shareTokenHash,
            expiresAt,
          });
          await resultDocument.save({ session });
          return { id: resultDocument._id.toString(), shareToken };
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new IdempotencyConflictError();
        throw error;
      }
    },
  };
}

export function createMongoLeadStore(options: { readonly retentionDays: number }): LeadStore {
  if (!Number.isSafeInteger(options.retentionDays) || options.retentionDays < 1)
    throw new Error('Lead retention must be a positive integer number of days.');
  return {
    async save(lead) {
      const expiresAt = new Date(Date.now() + options.retentionDays * 86_400_000);
      if (Number.isNaN(expiresAt.getTime())) throw new Error('Lead retention expiry is invalid.');
      await LeadModel.create({
        email: lead.email,
        consent: true,
        consentVersion: lead.consentVersion,
        expiresAt,
      });
    },
  };
}

export function createMongoResultSource(): ResultSource {
  return {
    async getByShareToken(shareToken) {
      const shareTokenHash = createHash('sha256').update(shareToken).digest('hex');
      const result = await ResultModel.findOne({
        shareTokenHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!result) return undefined;
      return publicResultProjection(result.projection as JsonRecord);
    },
  };
}

function hashIdempotencyKey(slug: string, key: string): string {
  return createHash('sha256').update(`${slug}\u0000${key}`).digest('hex');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export interface CachedCatalogSource extends PublicCatalogSource {
  readonly invalidate: (slug?: string) => void;
}

export interface CatalogCacheObserver {
  readonly observeCatalogCache: (outcome: 'hit' | 'miss') => void;
}

let publicCatalogInvalidator: ((slug?: string) => void) | undefined;

export function invalidatePublicCatalogCache(slug?: string): void {
  publicCatalogInvalidator?.(slug);
}

export function createCachedCatalogSource(
  source: PublicCatalogSource,
  ttlMs = 30_000,
  observer?: CatalogCacheObserver,
): CachedCatalogSource {
  let listEntry:
    | { readonly expiresAt: number; readonly value: readonly PublishedCalculatorRecord[] }
    | undefined;
  const entries = new Map<
    string,
    { readonly expiresAt: number; readonly value: PublishedCalculatorRecord | undefined }
  >();
  return {
    async listPublished() {
      const now = Date.now();
      if (listEntry && listEntry.expiresAt > now) {
        observer?.observeCatalogCache('hit');
        return listEntry.value;
      }
      observer?.observeCatalogCache('miss');
      const value = await source.listPublished();
      listEntry = { expiresAt: now + ttlMs, value };
      return value;
    },
    async getPublished(slug) {
      const now = Date.now();
      const cached = entries.get(slug);
      if (cached && cached.expiresAt > now) {
        observer?.observeCatalogCache('hit');
        return cached.value;
      }
      observer?.observeCatalogCache('miss');
      const value = await source.getPublished(slug);
      entries.set(slug, { expiresAt: now + ttlMs, value });
      return value;
    },
    getUnavailableStatus: source.getUnavailableStatus
      ? (slug) => source.getUnavailableStatus!(slug)
      : undefined,
    invalidate(slug) {
      if (slug) entries.delete(slug);
      else entries.clear();
      listEntry = undefined;
    },
  };
}

export interface BiomarkerSource {
  readonly list: (query: {
    readonly domain?: string;
    readonly search?: string;
  }) => Promise<readonly JsonRecord[]>;
  readonly get: (key: string) => Promise<JsonRecord | undefined>;
  readonly related?: (record: JsonRecord) => Promise<readonly JsonRecord[]>;
  readonly usedInCalculators?: (key: string) => Promise<readonly JsonRecord[]>;
}

export interface PublicRouterOptions {
  readonly catalog?: PublicCatalogSource;
  readonly catalogCacheObserver?: CatalogCacheObserver;
  readonly result?: ResultSource;
  readonly biomarker?: BiomarkerSource;
  readonly assessmentStore?: AssessmentStore;
  readonly rateLimit?: { readonly windowMs?: number; readonly max?: number };
  readonly idempotencyTtlMs?: number;
  readonly leadCapture?: {
    readonly store: LeadStore;
    readonly consentVersion: string;
  };
  readonly leadRateLimit?: { readonly windowMs?: number; readonly max?: number };
  /**
   * Test-only public surface backed by exact live draft pointers. Callers must
   * mount this router separately; environment validation prevents production
   * or non-loopback use.
   */
  readonly publicTestRelease?: boolean;
}

/**
 * Resolve public calculator versions through the mutable calculator identity.
 * A version-level `published` flag is not sufficient: stale, orphaned, or
 * manually corrupted versions must never become discoverable unless the
 * published parent currently points at that exact immutable version.
 */
export function buildPublishedCalculatorPipeline(slug?: string): PipelineStage[] {
  return [
    {
      $match: {
        status: 'published',
        ...(slug ? { calculatorSlug: slug } : {}),
      },
    },
    {
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
    },
    { $match: { 'liveCalculator.0': { $exists: true } } },
    { $sort: { calculatorSlug: 1, version: -1 } },
    // A damaged database must still not emit duplicate public routes. The
    // unique identity index should make this redundant; keeping it here makes
    // the read boundary fail deterministically under legacy/manual corruption.
    { $group: { _id: '$calculatorSlug', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    { $project: { liveCalculator: 0 } },
    { $sort: { calculatorSlug: 1 } },
    ...(slug ? ([{ $limit: 1 }] as PipelineStage[]) : []),
  ];
}

function publishedCalculatorRecord(value: JsonRecord): PublishedCalculatorRecord | undefined {
  const calculatorSlug = stringValue(value.calculatorSlug);
  const version = finiteNumber(value.version);
  const payload = isRecord(value.payload) ? value.payload : undefined;
  if (
    !calculatorSlug ||
    version === undefined ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !payload ||
    value._id === undefined
  )
    return undefined;
  return {
    id: String(value._id),
    calculatorSlug,
    version,
    payload,
  };
}

function defaultCatalog(): PublicCatalogSource {
  return {
    async listPublished() {
      const versions = await CalculatorVersionModel.aggregate<JsonRecord>(
        buildPublishedCalculatorPipeline(),
      );
      return versions.flatMap((version) => {
        const projected = publishedCalculatorRecord(version);
        return projected ? [projected] : [];
      });
    },
    async getPublished(slug) {
      const versions = await CalculatorVersionModel.aggregate<JsonRecord>(
        buildPublishedCalculatorPipeline(slug),
      );
      return versions[0] ? publishedCalculatorRecord(versions[0]) : undefined;
    },
    async getUnavailableStatus(slug) {
      const retired = await CalculatorVersionModel.exists({
        calculatorSlug: slug,
        status: 'retired',
      });
      return retired ? 'retired' : undefined;
    },
  };
}

/**
 * Select the exact live identity pointer from MongoDB for the public testing
 * surface. Draft and current pointers are both eligible so a development
 * catalog remains complete, while orphaned/stale versions can never leak.
 */
export function buildPublicTestCalculatorPipeline(slug?: string): PipelineStage[] {
  return [
    {
      $match: {
        status: { $in: ['draft', 'in-review', 'approved'] },
        'payload.NIRO_SOURCE_STATUS': { $type: 'object' },
        'payload.sources': { $elemMatch: { type: 'niro' } },
        ...(slug ? { calculatorSlug: slug } : {}),
      },
    },
    {
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
                  { $eq: ['$slug', '$$calculatorSlug'] },
                  { $in: ['$status', ['draft', 'in-review', 'approved', 'published']] },
                  {
                    $or: [
                      { $eq: ['$draftVersionId', '$$versionId'] },
                      { $eq: ['$currentVersionId', '$$versionId'] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'liveCalculator',
      },
    },
    { $match: { 'liveCalculator.0': { $exists: true } } },
    { $sort: { calculatorSlug: 1, version: -1 } },
    { $group: { _id: '$calculatorSlug', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    { $project: { liveCalculator: 0 } },
    { $sort: { calculatorSlug: 1 } },
    ...(slug ? ([{ $limit: 1 }] as PipelineStage[]) : []),
  ];
}

export function createMongoPublicTestCatalogSource(): PublicCatalogSource {
  return {
    async listPublished() {
      const versions = await CalculatorVersionModel.aggregate<JsonRecord>(
        buildPublicTestCalculatorPipeline(),
      );
      return versions.flatMap((version) => {
        const projected = publishedCalculatorRecord(version);
        return projected ? [{ ...projected, releaseState: 'testing-unapproved' as const }] : [];
      });
    },
    async getPublished(slug) {
      const versions = await CalculatorVersionModel.aggregate<JsonRecord>(
        buildPublicTestCalculatorPipeline(slug),
      );
      const projected = versions[0] ? publishedCalculatorRecord(versions[0]) : undefined;
      return projected ? { ...projected, releaseState: 'testing-unapproved' as const } : undefined;
    },
    async getUnavailableStatus(slug) {
      const retired = await CalculatorVersionModel.exists({
        calculatorSlug: slug,
        status: 'retired',
      });
      return retired ? 'retired' : undefined;
    },
  };
}

function publicMeasurementMatch(): JsonRecord {
  return {
    status: 'verified',
    kind: { $in: ['biomarker', 'demographic', 'lifestyle'] },
    definitionHash: { $type: 'string', $ne: '' },
    reviewHash: { $type: 'string', $ne: '' },
    reviewedBy: { $type: 'objectId' },
    verifiedAt: { $type: 'date' },
    'definition.schemaVersion': 'measurement-definition.v1',
    'definition.kind': {
      $in: ['laboratory-biomarker', 'vital', 'anthropometric', 'questionnaire-response', 'context'],
    },
    'definition.status': 'approved',
    'definition.governance.reviewStatus': 'approved',
    'definition.governance.publishBlockers': { $size: 0 },
    'definition.governance.reviewerId': { $type: 'string', $ne: '' },
    'definition.governance.reviewedAt': { $type: 'string', $ne: '' },
    'sources.0': { $exists: true },
    sources: {
      $not: {
        $elemMatch: { verification: { $nin: ['fetch-verified', 'source-provided'] } },
      },
    },
    $expr: {
      $and: [
        { $eq: ['$definition.key', '$key'] },
        { $eq: ['$definition.version', '$revision'] },
        { $eq: ['$definition.displayName', '$displayName'] },
        { $eq: ['$definition.canonicalUnit.code', '$canonicalUnit'] },
        { $eq: ['$definition.sources', '$sources'] },
        {
          $eq: [
            {
              $convert: {
                input: '$definition.governance.reviewedAt',
                to: 'date',
                onError: null,
                onNull: null,
              },
            },
            '$verifiedAt',
          ],
        },
        {
          $eq: [
            {
              $convert: { input: '$reviewedBy', to: 'string', onError: '', onNull: '' },
            },
            '$definition.governance.reviewerId',
          ],
        },
        {
          $or: [
            {
              $eq: [{ $ifNull: ['$definition.governance.reviewExpiresAt', null] }, null],
            },
            {
              $gt: [
                {
                  $convert: {
                    input: '$definition.governance.reviewExpiresAt',
                    to: 'date',
                    onError: null,
                    onNull: null,
                  },
                },
                '$$NOW',
              ],
            },
          ],
        },
        {
          $allElementsTrue: {
            $map: {
              input: {
                $cond: [
                  { $isArray: '$definition.referenceRanges' },
                  '$definition.referenceRanges',
                  [],
                ],
              },
              as: 'range',
              in: {
                $or: [
                  { $eq: [{ $ifNull: ['$$range.reviewExpiresAt', null] }, null] },
                  {
                    $gt: [
                      {
                        $convert: {
                          input: '$$range.reviewExpiresAt',
                          to: 'date',
                          onError: null,
                          onNull: null,
                        },
                      },
                      '$$NOW',
                    ],
                  },
                ],
              },
            },
          },
        },
        {
          $or: [
            {
              $and: [
                { $eq: ['$kind', 'biomarker'] },
                { $in: ['$definition.kind', ['laboratory-biomarker', 'vital']] },
              ],
            },
            {
              $and: [
                { $eq: ['$kind', 'demographic'] },
                { $in: ['$definition.kind', ['anthropometric', 'context']] },
              ],
            },
            {
              $and: [
                { $eq: ['$kind', 'lifestyle'] },
                { $in: ['$definition.kind', ['questionnaire-response', 'context']] },
              ],
            },
          ],
        },
      ],
    },
  };
}

function latestVerifiedPipeline(match: JsonRecord, limit: number): PipelineStage[] {
  return [
    { $match: { ...publicMeasurementMatch(), ...match } },
    { $sort: { key: 1, revision: -1 } },
    { $group: { _id: '$key', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    { $sort: { displayName: 1, key: 1 } },
    { $limit: limit },
  ];
}

function publicTestMeasurementMatch(): JsonRecord {
  return {
    status: 'draft',
    kind: { $in: ['biomarker', 'demographic', 'lifestyle', 'derived'] },
    'definition.governance.legacyRecordRefs.0': { $exists: true },
    'definition.schemaVersion': 'measurement-definition.v1',
    'definition.kind': {
      $in: [
        'laboratory-biomarker',
        'vital',
        'anthropometric',
        'derived-measurement',
        'questionnaire-response',
        'context',
      ],
    },
    $expr: {
      $and: [
        { $eq: ['$definition.key', '$key'] },
        { $eq: ['$definition.version', '$revision'] },
        { $eq: ['$definition.displayName', '$displayName'] },
      ],
    },
  };
}

function latestPublicTestMeasurementPipeline(match: JsonRecord, limit: number): PipelineStage[] {
  return [
    { $match: { ...publicTestMeasurementMatch(), ...match } },
    { $sort: { key: 1, revision: -1 } },
    { $group: { _id: '$key', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    { $sort: { displayName: 1, key: 1 } },
    { $limit: limit },
  ];
}

export function buildPublicTestBiomarkerListPipeline(query: {
  readonly domain?: string;
  readonly search?: string;
}): PipelineStage[] {
  const match: JsonRecord = {};
  if (query.domain) match['definition.domainKeys'] = query.domain;
  if (query.search) match.$text = { $search: query.search };
  return latestPublicTestMeasurementPipeline(match, 100);
}

export function buildBiomarkerListPipeline(query: {
  readonly domain?: string;
  readonly search?: string;
}): PipelineStage[] {
  const match: JsonRecord = {};
  if (query.domain) match['definition.domainKeys'] = query.domain;
  if (query.search) match.$text = { $search: query.search };
  return latestVerifiedPipeline(match, 100);
}

export function buildPublicTestBiomarkerCalculatorUsagePipeline(key: string): PipelineStage[] {
  return [
    {
      $match: {
        status: { $in: ['draft', 'in-review', 'approved'] },
        'payload.NIRO_SOURCE_STATUS': { $type: 'object' },
        'payload.sources': { $elemMatch: { type: 'niro' } },
        'payload.parameters': { $elemMatch: { biomarkerKey: key } },
      },
    },
    {
      $lookup: {
        from: 'calculators',
        let: { calculatorId: '$calculatorId', versionId: '$_id', slug: '$calculatorSlug' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$calculatorId'] },
                  { $eq: ['$slug', '$$slug'] },
                  { $in: ['$status', ['draft', 'in-review', 'approved', 'published']] },
                  {
                    $or: [
                      { $eq: ['$draftVersionId', '$$versionId'] },
                      { $eq: ['$currentVersionId', '$$versionId'] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'liveCalculator',
      },
    },
    { $match: { 'liveCalculator.0': { $exists: true } } },
    { $sort: { calculatorSlug: 1, version: -1 } },
    { $group: { _id: '$calculatorSlug', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    {
      $project: {
        _id: 0,
        calculatorSlug: 1,
        version: 1,
        status: 1,
        'payload.name': 1,
        'payload.shortDescription': 1,
      },
    },
    { $sort: { calculatorSlug: 1 } },
    { $limit: 50 },
  ];
}

export function buildBiomarkerCalculatorUsagePipeline(key: string): PipelineStage[] {
  return [
    {
      $match: {
        status: 'published',
        'payload.parameters': { $elemMatch: { biomarkerKey: key } },
      },
    },
    {
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
    },
    { $match: { 'liveCalculator.0': { $exists: true } } },
    {
      $project: {
        _id: 0,
        calculatorSlug: 1,
        version: 1,
        status: 1,
        'payload.name': 1,
        'payload.shortDescription': 1,
      },
    },
    { $sort: { calculatorSlug: 1, version: -1 } },
    { $limit: 50 },
  ];
}

function domainKeys(record: JsonRecord): readonly string[] {
  if (!isRecord(record.definition)) return [];
  const keys = record.definition.domainKeys;
  return Array.isArray(keys)
    ? keys.filter((key): key is string => typeof key === 'string' && validSlug(key))
    : [];
}

export function createMongoBiomarkerSource(): BiomarkerSource {
  return {
    async list(query) {
      return (await MeasurementRevisionModel.aggregate<JsonRecord>(
        buildBiomarkerListPipeline(query),
      )) as JsonRecord[];
    },
    async get(key) {
      const records = await MeasurementRevisionModel.aggregate<JsonRecord>(
        latestVerifiedPipeline({ key }, 1),
      );
      return records[0];
    },
    async related(record) {
      const domains = domainKeys(record);
      if (domains.length === 0 || typeof record.key !== 'string') return [];
      return (await MeasurementRevisionModel.aggregate<JsonRecord>(
        latestVerifiedPipeline(
          {
            key: { $ne: record.key },
            'definition.domainKeys': { $in: domains },
          },
          8,
        ),
      )) as JsonRecord[];
    },
    async usedInCalculators(key) {
      return (await CalculatorVersionModel.aggregate<JsonRecord>(
        buildBiomarkerCalculatorUsagePipeline(key),
      )) as JsonRecord[];
    },
  };
}

export function createMongoPublicTestBiomarkerSource(): BiomarkerSource {
  return {
    async list(query) {
      return (await MeasurementRevisionModel.aggregate<JsonRecord>(
        buildPublicTestBiomarkerListPipeline(query),
      )) as JsonRecord[];
    },
    async get(key) {
      const records = await MeasurementRevisionModel.aggregate<JsonRecord>(
        latestPublicTestMeasurementPipeline({ key }, 1),
      );
      return records[0];
    },
    async related(record) {
      const domains = domainKeys(record);
      if (domains.length === 0 || typeof record.key !== 'string') return [];
      return (await MeasurementRevisionModel.aggregate<JsonRecord>(
        latestPublicTestMeasurementPipeline(
          {
            key: { $ne: record.key },
            'definition.domainKeys': { $in: domains },
          },
          8,
        ),
      )) as JsonRecord[];
    },
    async usedInCalculators(key) {
      return (await CalculatorVersionModel.aggregate<JsonRecord>(
        buildPublicTestBiomarkerCalculatorUsagePipeline(key),
      )) as JsonRecord[];
    },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function enumString(allowed: ReadonlySet<string>): (value: unknown) => string | undefined {
  return (value) => (typeof value === 'string' && allowed.has(value) ? value : undefined);
}

function safeHttpUrl(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2_000 ||
    value !== value.trim() ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return undefined;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
      return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function boundedPublicText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return undefined;
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })
    ? undefined
    : value;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

type PublicProjector = (value: unknown) => unknown;

/**
 * Construct a response object from an explicit field map. Unknown input keys
 * are unreachable by design, so new authoring/audit fields remain private
 * until the public contract deliberately adds them.
 */
function projectPublicRecord(
  value: unknown,
  fields: Readonly<Record<string, PublicProjector>>,
): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, projector]) => {
      const projected = projector(value[key]);
      return projected === undefined ? [] : [[key, projected]];
    }),
  );
}

function projectPublicArray(
  value: unknown,
  projector: PublicProjector,
): readonly unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const projected = projector(item);
    return projected === undefined ? [] : [projected];
  });
}

function stringArray(value: unknown): readonly string[] | undefined {
  return projectPublicArray(value, stringValue) as readonly string[] | undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positiveFiniteNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function unitInterval(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number >= 0 && number <= 1 ? number : undefined;
}

function publicScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  return finiteNumber(value);
}

function publicInput(value: unknown): string | number | boolean | null | JsonRecord | undefined {
  const scalar = publicScalar(value);
  if (scalar !== undefined) return scalar;
  if (!isRecord(value)) return undefined;
  const measurementValue = finiteNumber(value.value);
  if (measurementValue === undefined) return undefined;
  const unit = stringValue(value.unit);
  return { value: measurementValue, ...(unit ? { unit } : {}) };
}

function resultLayout(value: unknown): readonly ResultLayoutBlock[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(RESULT_LAYOUT_BLOCKS);
  return value.filter(
    (item): item is ResultLayoutBlock => typeof item === 'string' && allowed.has(item),
  );
}

function scoreDirection(value: unknown): ScoreDirection | undefined {
  return typeof value === 'string' &&
    ['higher-is-worse', 'lower-is-worse', 'higher-is-better', 'lower-is-better'].includes(value)
    ? (value as ScoreDirection)
    : undefined;
}

/**
 * Freeze the public display metadata needed to render this exact result later.
 * Every field is copied through an allowlist; runtime/scoring configuration is
 * deliberately absent even though the source payload contains it.
 */
export function buildResultPresentation(record: PublishedCalculatorRecord): ResultPresentation {
  const payload = record.payload;
  const uiConfig = isRecord(payload.uiConfig) ? payload.uiConfig : {};
  const uiResult = isRecord(uiConfig.result) ? uiConfig.result : {};
  const categories = isRecord(payload.resultCategories) ? payload.resultCategories : {};
  const scale = isRecord(categories.scale) ? categories.scale : {};
  const min = finiteNumber(scale.min);
  const max = finiteNumber(scale.max);
  const direction = scoreDirection(scale.direction);
  const scoreScale =
    min !== undefined && max !== undefined && direction !== undefined
      ? { min, max, direction }
      : undefined;
  const parameters = Array.isArray(payload.parameters)
    ? payload.parameters.filter(isRecord).flatMap((parameter) => {
        const key = stringValue(parameter.key);
        const label = stringValue(parameter.label);
        if (!key || !label) return [];
        const unit = isRecord(parameter.unit) ? parameter.unit : {};
        const biomarkerKey = stringValue(parameter.biomarkerKey);
        const canonicalUnit = stringValue(unit.canonical);
        return [
          {
            key,
            label,
            ...(biomarkerKey ? { biomarkerKey } : {}),
            ...(canonicalUnit ? { canonicalUnit } : {}),
          },
        ];
      })
    : [];
  const domains = Array.isArray(payload.domains)
    ? payload.domains.filter(isRecord).flatMap((domain) => {
        const key = stringValue(domain.key);
        const label = stringValue(domain.label);
        return key && label ? [{ key, label }] : [];
      })
    : [];
  return {
    calculatorSlug: record.calculatorSlug,
    calculatorVersion: record.version,
    name: stringValue(payload.name) ?? record.calculatorSlug,
    shortDescription: stringValue(payload.shortDescription) ?? '',
    disclaimers: Array.isArray(payload.disclaimers)
      ? payload.disclaimers.filter((item): item is string => typeof item === 'string')
      : [],
    resultLayout: resultLayout(uiResult.layout),
    ...(scoreScale ? { scoreScale } : {}),
    parameters,
    domains,
    ...(record.releaseState ? { releaseState: record.releaseState } : {}),
  };
}

function publicResultPresentation(value: unknown): ResultPresentation | undefined {
  if (!isRecord(value)) return undefined;
  const calculatorSlug = stringValue(value.calculatorSlug);
  const calculatorVersion = finiteNumber(value.calculatorVersion);
  const name = stringValue(value.name);
  const shortDescription = stringValue(value.shortDescription);
  if (
    !calculatorSlug ||
    calculatorVersion === undefined ||
    !Number.isInteger(calculatorVersion) ||
    calculatorVersion < 1 ||
    name === undefined ||
    shortDescription === undefined
  )
    return undefined;
  const scale = isRecord(value.scoreScale) ? value.scoreScale : undefined;
  const min = finiteNumber(scale?.min);
  const max = finiteNumber(scale?.max);
  const direction = scoreDirection(scale?.direction);
  const parameters = Array.isArray(value.parameters)
    ? value.parameters.filter(isRecord).flatMap((parameter) => {
        const key = stringValue(parameter.key);
        const label = stringValue(parameter.label);
        if (!key || !label) return [];
        const biomarkerKey = stringValue(parameter.biomarkerKey);
        const canonicalUnit = stringValue(parameter.canonicalUnit);
        return [
          {
            key,
            label,
            ...(biomarkerKey ? { biomarkerKey } : {}),
            ...(canonicalUnit ? { canonicalUnit } : {}),
          },
        ];
      })
    : [];
  const domains = Array.isArray(value.domains)
    ? value.domains.filter(isRecord).flatMap((domain) => {
        const key = stringValue(domain.key);
        const label = stringValue(domain.label);
        return key && label ? [{ key, label }] : [];
      })
    : [];
  return {
    calculatorSlug,
    calculatorVersion,
    name,
    shortDescription,
    disclaimers: Array.isArray(value.disclaimers)
      ? value.disclaimers.filter((item): item is string => typeof item === 'string')
      : [],
    resultLayout: resultLayout(value.resultLayout),
    ...(min !== undefined && max !== undefined && min < max && direction
      ? { scoreScale: { min, max, direction } }
      : {}),
    parameters,
    domains,
    ...(value.releaseState === 'testing-unapproved'
      ? { releaseState: 'testing-unapproved' as const }
      : {}),
  };
}

function publicConditionValue(value: unknown): unknown {
  if (Array.isArray(value)) return projectPublicArray(value, publicNonNullScalar);
  return publicNonNullScalar(value);
}

function publicNonNullScalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  return finiteNumber(value);
}

function publicCondition(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  // Formula identifiers are authoring/scoring implementation details. Keep
  // formula-gated fields fail-closed in the browser without revealing the
  // formula key, operator, or comparison value.
  if (Object.hasOwn(value, 'formula')) return { unavailable: true };
  if (Array.isArray(value.all)) {
    return { all: projectPublicArray(value.all, publicCondition) ?? [] };
  }
  if (Array.isArray(value.any)) {
    return { any: projectPublicArray(value.any, publicCondition) ?? [] };
  }
  if (value.not !== undefined) {
    const projected = publicCondition(value.not);
    return projected ? { not: projected } : undefined;
  }
  return projectPublicRecord(value, {
    param: stringValue,
    aggregate: stringValue,
    op: stringValue,
    value: publicConditionValue,
  });
}

function publicParameter(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    key: stringValue,
    label: stringValue,
    group: stringValue,
    biomarkerKey: stringValue,
    inputType: stringValue,
    unit: (unit) =>
      projectPublicRecord(unit, {
        canonical: stringValue,
        allowed: (allowed) =>
          projectPublicArray(allowed, (choice) =>
            projectPublicRecord(choice, {
              code: stringValue,
              factor: finiteNumber,
              offset: finiteNumber,
            }),
          ),
      }),
    validation: (validation) =>
      projectPublicRecord(validation, {
        required: booleanValue,
        min: finiteNumber,
        max: finiteNumber,
        integer: booleanValue,
        softMin: finiteNumber,
        softMax: finiteNumber,
      }),
    options: (options) =>
      projectPublicArray(options, (option) =>
        projectPublicRecord(option, {
          value: publicNonNullScalar,
          label: stringValue,
        }),
      ),
    defaultOption: publicNonNullScalar,
    missingPolicy: stringValue,
    visibility: publicCondition,
    order: nonNegativeInteger,
    helpText: stringValue,
    placeholder: stringValue,
  });
}

function publicContentBlock(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.id);
  const type = stringValue(value.type);
  if (!id || !type) return undefined;
  const common = {
    id,
    type,
    ...(stringArray(value.claimIds) ? { claimIds: stringArray(value.claimIds) } : {}),
  };
  switch (type) {
    case 'markdown':
    case 'disclaimer':
      return { ...common, ...(stringValue(value.markdown) ? { markdown: value.markdown } : {}) };
    case 'callout':
      return {
        ...common,
        ...(stringValue(value.tone) ? { tone: value.tone } : {}),
        ...(stringValue(value.title) ? { title: value.title } : {}),
        ...(stringValue(value.markdown) ? { markdown: value.markdown } : {}),
      };
    case 'faq':
      return {
        ...common,
        items:
          projectPublicArray(value.items, (item) =>
            projectPublicRecord(item, {
              id: stringValue,
              question: stringValue,
              answerMarkdown: stringValue,
              claimIds: stringArray,
            }),
          ) ?? [],
      };
    case 'steps':
      return {
        ...common,
        steps:
          projectPublicArray(value.steps, (step) =>
            projectPublicRecord(step, {
              title: stringValue,
              markdown: stringValue,
              claimIds: stringArray,
            }),
          ) ?? [],
      };
    case 'table':
      return {
        ...common,
        ...(stringValue(value.caption) ? { caption: value.caption } : {}),
        headers: stringArray(value.headers) ?? [],
        rows: projectPublicArray(value.rows, (row) => stringArray(row)) ?? [],
      };
    case 'media':
      return {
        ...common,
        ...(stringValue(value.assetId) ? { assetId: value.assetId } : {}),
        ...(stringValue(value.alt) ? { alt: value.alt } : {}),
        ...(stringValue(value.caption) ? { caption: value.caption } : {}),
      };
    case 'related':
      return {
        ...common,
        ...(stringArray(value.calculatorSlugs)
          ? { calculatorSlugs: stringArray(value.calculatorSlugs) }
          : {}),
        ...(stringArray(value.measurementKeys)
          ? { measurementKeys: stringArray(value.measurementKeys) }
          : {}),
        ...(stringArray(value.contentSlugs)
          ? { contentSlugs: stringArray(value.contentSlugs) }
          : {}),
      };
    case 'calculator-embed':
      return {
        ...common,
        ...(stringValue(value.calculatorSlug) ? { calculatorSlug: value.calculatorSlug } : {}),
      };
    case 'crisis-resources':
      return {
        ...common,
        ...(stringValue(value.triggerRef) ? { triggerRef: value.triggerRef } : {}),
        ...(stringValue(value.markdown) ? { markdown: value.markdown } : {}),
        resources:
          projectPublicArray(value.resources, (resource) =>
            projectPublicRecord(resource, {
              region: stringValue,
              label: stringValue,
              contact: stringValue,
              url: stringValue,
            }),
          ) ?? [],
      };
    default:
      return undefined;
  }
}

function publicContentClaim(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    id: stringValue,
    text: stringValue,
    kind: stringValue,
    citationIds: stringArray,
    reviewStatus: stringValue,
  });
}

function publicContentCitation(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const type = stringValue(value.type);
  const citation = projectPublicRecord(value, {
    id: stringValue,
    type: stringValue,
    org: stringValue,
    authors: stringArray,
    title: stringValue,
    url: type === 'internal' ? () => undefined : stringValue,
    localRef: type === 'niro' ? stringValue : () => undefined,
    identifier: stringValue,
    publishedAt: stringValue,
    accessedAt: stringValue,
    verificationStatus: stringValue,
    licenseStatus: stringValue,
    primarySource: booleanValue,
  });
  return citation;
}

function publicContentSeo(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    metaTitle: stringValue,
    metaDescription: stringValue,
    canonicalPath: stringValue,
    robots: (robots) => projectPublicRecord(robots, { index: booleanValue, follow: booleanValue }),
    schemaTypes: stringArray,
    openGraph: (openGraph) =>
      projectPublicRecord(openGraph, {
        title: stringValue,
        description: stringValue,
        image: (image) => projectPublicRecord(image, { assetId: stringValue, alt: stringValue }),
      }),
    keywords: stringArray,
    redirectsFrom: stringArray,
  });
}

function publicRelatedContent(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    calculatorSlugs: stringArray,
    measurementKeys: stringArray,
    contentSlugs: stringArray,
  });
}

function publicContentPage(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    schemaVersion: stringValue,
    contentId: stringValue,
    version: nonNegativeInteger,
    locale: stringValue,
    slug: stringValue,
    title: stringValue,
    summary: stringValue,
    blocks: (blocks) => projectPublicArray(blocks, publicContentBlock),
    claims: (claims) => projectPublicArray(claims, publicContentClaim),
    citations: (citations) => projectPublicArray(citations, publicContentCitation),
    seo: publicContentSeo,
    related: publicRelatedContent,
  });
}

function publicMeasurementUnit(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    code: stringValue,
    dimension: enumString(
      new Set([
        'dimensionless',
        'mass',
        'length',
        'time',
        'temperature',
        'pressure',
        'substance-concentration',
        'mass-concentration',
        'count-concentration',
        'enzyme-activity-concentration',
        'rate',
        'area',
        'volume',
        'energy',
        'composite',
      ]),
    ),
    display: stringValue,
    ucum: stringValue,
  });
}

function publicInterval(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    min: finiteNumber,
    max: finiteNumber,
    minInclusive: booleanValue,
    maxInclusive: booleanValue,
  });
}

function publicMeasurementConversion(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const kind = stringValue(value.kind);
  if (kind === 'affine') {
    return projectPublicRecord(value, {
      kind: stringValue,
      fromUnit: stringValue,
      toUnit: stringValue,
      factor: positiveFiniteNumber,
      offset: finiteNumber,
      sourceClaimIds: stringArray,
    });
  }
  if (kind === 'composite') {
    return projectPublicRecord(value, {
      kind: stringValue,
      adapter: enumString(new Set(['feet-inches-to-centimetres', 'stone-pounds-to-kilograms'])),
      from: (from) =>
        projectPublicArray(from, (item) =>
          projectPublicRecord(item, { field: stringValue, unit: stringValue }),
        ),
      toUnit: stringValue,
      sourceClaimIds: stringArray,
    });
  }
  return undefined;
}

function publicReferenceRange(value: unknown): JsonRecord | undefined {
  if (!isRecord(value) || value.interpretationOnly !== true) return undefined;
  return projectPublicRecord(value, {
    id: stringValue,
    label: stringValue,
    unit: stringValue,
    interval: publicInterval,
    context: (context) =>
      projectPublicRecord(context, {
        sexAtBirth: enumString(new Set(['female', 'male', 'intersex', 'not-specified'])),
        ageMinYears: finiteNumber,
        ageMaxYears: finiteNumber,
        pregnancyStatus: enumString(new Set(['pregnant', 'not-pregnant', 'unknown'])),
        menopausalStatus: enumString(new Set(['pre', 'peri', 'post', 'unknown'])),
        fastingStatus: enumString(new Set(['fasting', 'non-fasting', 'unknown'])),
        specimen: (item) => boundedPublicText(item, 200),
        sampleTiming: (item) => boundedPublicText(item, 200),
        population: (item) => boundedPublicText(item, 300),
        method: (item) => boundedPublicText(item, 300),
      }),
    interpretation: stringValue,
    interpretationOnly: booleanValue,
    sourceClaimIds: stringArray,
    conflictGroup: stringValue,
  });
}

function publicMeasurementDefinition(value: unknown): JsonRecord | undefined {
  return projectPublicRecord(value, {
    aliases: stringArray,
    formerKeys: stringArray,
    panels: stringArray,
    domainKeys: stringArray,
    valueType: enumString(new Set(['number', 'integer', 'boolean', 'coded-value'])),
    canonicalUnit: publicMeasurementUnit,
    acceptedUnits: (units) => projectPublicArray(units, publicMeasurementUnit),
    conversions: (conversions) => projectPublicArray(conversions, publicMeasurementConversion),
    referenceRanges: (ranges) => projectPublicArray(ranges, publicReferenceRange),
    description: (description) =>
      projectPublicRecord(description, {
        whatItMeasures: stringValue,
        whyItMatters: stringValue,
        collectionNotes: stringValue,
        limitations: stringValue,
      }),
  });
}

function publicMeasurementSource(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const type = enumString(new Set(['niro', 'external', 'internal']))(value.type);
  const verification = enumString(new Set(['fetch-verified', 'source-provided']))(
    value.verification,
  );
  if (!type || !verification) return undefined;
  return projectPublicRecord(value, {
    id: stringValue,
    type: () => type,
    org: stringValue,
    title: stringValue,
    url: type === 'internal' ? () => undefined : safeHttpUrl,
    accessed: stringValue,
    verification: () => verification,
    claimIds: stringArray,
  });
}

function publicBiomarkerProjection(
  value: JsonRecord,
  allowUnapprovedTesting = false,
): JsonRecord | undefined {
  if (!allowUnapprovedTesting && !isApprovedMeasurementEnvelope(value)) return undefined;
  const definition = isRecord(value.definition) ? value.definition : {};
  const canonicalUnit = isRecord(definition.canonicalUnit)
    ? stringValue(definition.canonicalUnit.code)
    : undefined;
  const projected = projectPublicRecord(
    {
      key: definition.key,
      revision: definition.version,
      displayName: definition.displayName,
      kind: definition.kind,
      canonicalUnit,
      definition,
      sources: definition.sources ?? value.sources,
    },
    {
      key: stringValue,
      revision: nonNegativeInteger,
      displayName: stringValue,
      kind: enumString(
        new Set([
          'laboratory-biomarker',
          'vital',
          'anthropometric',
          'derived-measurement',
          'questionnaire-response',
          'context',
        ]),
      ),
      canonicalUnit: stringValue,
      definition: publicMeasurementDefinition,
      sources: (sources) => projectPublicArray(sources, publicMeasurementSource),
    },
  );
  if (
    !projected ||
    typeof projected.key !== 'string' ||
    typeof projected.displayName !== 'string' ||
    typeof projected.revision !== 'number' ||
    typeof projected.kind !== 'string' ||
    !isRecord(projected.definition) ||
    !Array.isArray(projected.sources)
  )
    return undefined;
  return allowUnapprovedTesting ? { ...projected, releaseState: 'testing-unapproved' } : projected;
}

function isVerifiedBiomarkerRecord(value: JsonRecord): boolean {
  return isApprovedMeasurementEnvelope(value);
}

function publicRelatedBiomarkerProjection(
  value: JsonRecord,
  allowUnapprovedTesting = false,
): JsonRecord | undefined {
  if (!allowUnapprovedTesting && !isApprovedMeasurementEnvelope(value)) return undefined;
  const definition = isRecord(value.definition) ? value.definition : {};
  const key = stringValue(definition.key);
  const displayName = stringValue(definition.displayName);
  if (!key || !displayName) return undefined;
  const canonicalUnit = isRecord(definition.canonicalUnit)
    ? stringValue(definition.canonicalUnit.code)
    : undefined;
  const domains = stringArray(definition.domainKeys);
  return {
    key,
    displayName,
    ...(canonicalUnit ? { canonicalUnit } : {}),
    ...(domains ? { domainKeys: domains } : {}),
    relation: 'same-domain',
  };
}

function publicUsedInCalculatorProjection(
  value: JsonRecord,
  allowUnapprovedTesting = false,
): JsonRecord | undefined {
  if (
    value.status !== 'published' &&
    (!allowUnapprovedTesting || !['draft', 'in-review', 'approved'].includes(String(value.status)))
  )
    return undefined;
  const calculatorSlug = stringValue(value.calculatorSlug);
  const version = nonNegativeInteger(value.version);
  if (!calculatorSlug || version === undefined) return undefined;
  const payload = isRecord(value.payload) ? value.payload : {};
  const name = stringValue(payload.name);
  const shortDescription = stringValue(payload.shortDescription);
  return {
    calculatorSlug,
    version,
    ...(name ? { name } : {}),
    ...(shortDescription ? { shortDescription } : {}),
  };
}

function publicCategory(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const category = Object.fromEntries(
    ['label', 'color', 'message', 'recommendation'].flatMap((key) => {
      const field = stringValue(value[key]);
      return field === undefined ? [] : [[key, field]];
    }),
  );
  return Object.keys(category).length > 0 ? category : undefined;
}

function publicResultCategories(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const bands = Array.isArray(value.bands)
    ? value.bands
        .filter(isRecord)
        .map((band) =>
          Object.fromEntries(
            ['label', 'color', 'message', 'recommendation'].flatMap((key) =>
              band[key] === undefined ? [] : [[key, band[key]]],
            ),
          ),
        )
    : undefined;
  return bands ? { bands } : {};
}

function publicProjection(payload: JsonRecord): JsonRecord {
  return (
    projectPublicRecord(payload, {
      name: stringValue,
      shortDescription: stringValue,
      disclaimers: stringArray,
      parameters: (parameters) => projectPublicArray(parameters, publicParameter),
      uiConfig: (uiConfig) =>
        projectPublicRecord(uiConfig, {
          theme: (theme) => projectPublicRecord(theme, { accent: stringValue }),
          steps: (steps) =>
            projectPublicArray(steps, (step) =>
              projectPublicRecord(step, {
                key: stringValue,
                title: stringValue,
                parameterGroups: stringArray,
              }),
            ),
          result: (result) =>
            projectPublicRecord(result, {
              layout: resultLayout,
            }),
        }),
      content: publicContentPage,
      resultCategories: publicResultCategories,
    }) ?? {}
  );
}

function publicResultProjection(projection: JsonRecord): JsonRecord {
  const value = projection;
  const parameters = Array.isArray(value.parameters)
    ? value.parameters.filter(isRecord).flatMap((parameter) => {
        const key = stringValue(parameter.key);
        if (!key) return [];
        const input = publicInput(parameter.input);
        const parameterValue = publicScalar(parameter.value);
        const canonicalUnit = stringValue(parameter.canonicalUnit);
        const status =
          typeof parameter.status === 'string' &&
          ['scored', 'missing', 'excluded', 'blocked'].includes(parameter.status)
            ? parameter.status
            : undefined;
        return [
          Object.fromEntries(
            [
              ['key', key],
              ['input', input],
              ['value', parameterValue],
              ['canonicalUnit', canonicalUnit],
              ['missing', typeof parameter.missing === 'boolean' ? parameter.missing : undefined],
              ['imputed', typeof parameter.imputed === 'boolean' ? parameter.imputed : undefined],
              [
                'applicable',
                typeof parameter.applicable === 'boolean' ? parameter.applicable : undefined,
              ],
              ['status', status],
            ].filter(([, item]) => item !== undefined),
          ),
        ];
      })
    : undefined;
  const domains = Array.isArray(value.domains)
    ? value.domains.filter(isRecord).flatMap((domain) => {
        const key = stringValue(domain.key);
        if (!key) return [];
        const status =
          typeof domain.status === 'string' &&
          ['scored', 'empty', 'blocked'].includes(domain.status)
            ? domain.status
            : undefined;
        return [
          Object.fromEntries(
            [
              ['key', key],
              ['score', finiteNumber(domain.score)],
              ['scoredCount', nonNegativeInteger(domain.scoredCount)],
              ['missingCount', nonNegativeInteger(domain.missingCount)],
              ['applicableCount', nonNegativeInteger(domain.applicableCount)],
              ['coverage', unitInterval(domain.coverage)],
              ['status', status],
            ].filter(([, item]) => item !== undefined),
          ),
        ];
      })
    : undefined;
  const coverageValue = isRecord(value.coverage) ? value.coverage : undefined;
  const coverage = coverageValue
    ? Object.fromEntries(
        [
          ['scoredParameterCount', nonNegativeInteger(coverageValue.scoredParameterCount)],
          [
            'applicableScoredParameterCount',
            nonNegativeInteger(coverageValue.applicableScoredParameterCount),
          ],
          ['parameterCoverage', unitInterval(coverageValue.parameterCoverage)],
          ['domainCoverage', unitInterval(coverageValue.domainCoverage)],
        ].filter(([, item]) => item !== undefined),
      )
    : undefined;
  const contributors = isRecord(value.contributors)
    ? {
        harmful: publicContributorKeys(value.contributors.harmful),
        protective: publicContributorKeys(value.contributors.protective),
      }
    : undefined;
  const presentation = publicResultPresentation(value.presentation);
  return Object.fromEntries(
    [
      ['score', finiteNumber(value.score)],
      ['category', publicCategory(value.category)],
      ['parameters', parameters],
      ['domains', domains],
      ['coverage', coverage],
      ['contributors', contributors],
      [
        'warnings',
        Array.isArray(value.warnings)
          ? value.warnings.filter((warning): warning is string => typeof warning === 'string')
          : undefined,
      ],
      ['presentation', presentation],
    ].filter(([, item]) => item !== undefined),
  );
}

function publicContributorKeys(value: unknown): readonly JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item) => {
    const key = stringValue(item.key);
    if (!key) return [];
    const status =
      typeof item.status === 'string' &&
      ['scored', 'missing', 'excluded', 'blocked'].includes(item.status)
        ? item.status
        : undefined;
    return [{ key, ...(status ? { status } : {}) }];
  });
}

function etag(value: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(value)).digest('hex')}"`;
}

function etagMatches(request: Request, tag: string): boolean {
  const header = request.header('If-None-Match');
  if (!header) return false;
  return header
    .split(',')
    .map((item) => item.trim())
    .some((item) => item === '*' || item === tag || item === `W/${tag}`);
}

function setCacheHeaders(response: Response): void {
  response.setHeader('Cache-Control', 'public, max-age=30, must-revalidate');
  response.setHeader('Vary', 'Accept-Encoding');
}

function setCatalogHeaders(response: Response, publicTestRelease: boolean): void {
  if (!publicTestRelease) {
    setCacheHeaders(response);
    return;
  }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('X-Niro-Mode', 'public-testing');
}

function setPrivateNoStoreHeaders(response: Response): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
}

function setResultPrivacyHeaders(response: Response): void {
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  setPrivateNoStoreHeaders(response);
}

function envelope(response: Response, data: unknown, status = 200): void {
  response.status(status).json({ data });
}

function failure(
  response: Response,
  code: string,
  message: string,
  status: number,
  fields?: unknown,
): void {
  response
    .status(status)
    .json({ error: { code, message, ...(fields === undefined ? {} : { fields }) } });
}

function rateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { started: number; count: number }>();
  return (request: Request, response: Response, next: () => void): void => {
    const now = Date.now();
    for (const [key, record] of hits) {
      if (now - record.started >= windowMs) hits.delete(key);
    }
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const current = hits.get(key);
    const record =
      !current || now - current.started >= windowMs
        ? { started: now, count: 1 }
        : { ...current, count: current.count + 1 };
    hits.set(key, record);
    if (record.count > max) {
      const retryAfter = Math.max(1, Math.ceil((record.started + windowMs - now) / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      response.setHeader('Cache-Control', 'no-store');
      response.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests; retry later.' },
      });
      return;
    }
    next();
  };
}

function validSlug(slug: string): boolean {
  return slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validParameterKey(key: string): boolean {
  return key.length <= 150 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key);
}

function boundedIdentifier(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return undefined;
  if ([...value].some((character) => character.charCodeAt(0) < 32)) return undefined;
  return value;
}

function boundedSearch(value: unknown, max = 100): string | undefined {
  if (typeof value !== 'string') return undefined;
  const search = value.trim();
  if (search.length === 0 || search.length > max) return undefined;
  if (
    [...search].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return undefined;
  return search;
}

function normalizedLeadEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    [...email].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ? email : undefined;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

const CONFIGURATION_ERROR_CODES = new Set([
  'NO_SCORING_RULE',
  'NO_BAND_MATCH',
  'NO_SCORING_CONTEXT',
  'NO_SCORING_BAND',
  'AGGREGATE_EMPTY',
  'DOMAIN_UNSCORABLE',
  'FORMULA_DOMAIN_ERROR',
  'LOOKUP_MISS',
  'SCALE_ASSERTION_FAILED',
]);

const INPUT_ERROR_CODES = new Set([
  'INVALID_INPUT',
  'MISSING_REQUIRED_INPUT',
  'UNKNOWN_PARAMETER',
  'UNIT_NOT_ALLOWED',
  'UNIT_VALUE_INVALID',
  'BLOCKED_BY_POLICY',
]);

function inputErrorFields(errors: readonly { path: string; code: string; message: string }[]) {
  return Object.fromEntries(
    errors.map((error) => [error.path, { code: error.code, message: error.message }]),
  );
}

function isInputError(error: { readonly path: string; readonly code: string }): boolean {
  return (
    INPUT_ERROR_CODES.has(error.code) &&
    (error.code !== 'BLOCKED_BY_POLICY' || error.path.startsWith('inputs.'))
  );
}

function isConfigurationError(error: { readonly path: string; readonly code: string }): boolean {
  return (
    CONFIGURATION_ERROR_CODES.has(error.code) ||
    (error.code === 'BLOCKED_BY_POLICY' && !error.path.startsWith('inputs.'))
  );
}

export function createPublicRouter(options: PublicRouterOptions = {}): Router {
  const publicTestRelease = options.publicTestRelease === true;
  const configuredCatalog =
    options.catalog ??
    (publicTestRelease ? createMongoPublicTestCatalogSource() : defaultCatalog());
  const catalog =
    publicTestRelease || 'invalidate' in configuredCatalog
      ? configuredCatalog
      : createCachedCatalogSource(configuredCatalog, 30_000, options.catalogCacheObserver);
  if (!publicTestRelease && 'invalidate' in catalog && typeof catalog.invalidate === 'function')
    publicCatalogInvalidator = (catalog as CachedCatalogSource).invalidate;
  const resultSource = options.result ?? createMongoResultSource();
  const biomarker =
    options.biomarker ??
    (publicTestRelease ? createMongoPublicTestBiomarkerSource() : createMongoBiomarkerSource());
  const router = Router();
  if (publicTestRelease) {
    router.use((_request, response, next) => {
      setCatalogHeaders(response, true);
      next();
    });
  }
  const idempotencyReplay = new Map<
    string,
    { readonly fingerprint: string; readonly expiresAt: number; readonly response: JsonRecord }
  >();
  router.get('/calculators', async (_request, response, next) => {
    try {
      const records = await catalog.listPublished();
      const data = records.map((record) => {
        const projected = publicProjection(record.payload);
        return {
          slug: record.calculatorSlug,
          calculatorSlug: record.calculatorSlug,
          version: record.version,
          ...(record.releaseState ? { releaseState: record.releaseState } : {}),
          ...Object.fromEntries(
            ['name', 'shortDescription', 'disclaimers'].flatMap((key) =>
              projected[key] === undefined ? [] : [[key, projected[key]]],
            ),
          ),
        };
      });
      const tag = etag(data);
      response.setHeader('ETag', tag);
      setCatalogHeaders(response, publicTestRelease);
      if (etagMatches(_request, tag)) {
        response.status(304).end();
        return;
      }
      envelope(response, data);
    } catch (error) {
      next(error);
    }
  });
  router.get('/calculators/:slug', async (request, response, next) => {
    try {
      if (!validSlug(request.params.slug)) {
        failure(response, 'INVALID_SLUG', 'Calculator slug is invalid.', 400);
        return;
      }
      const record = await catalog.getPublished(request.params.slug);
      if (!record) {
        const unavailableStatus = await catalog.getUnavailableStatus?.(request.params.slug);
        setCatalogHeaders(response, publicTestRelease);
        if (unavailableStatus === 'retired') {
          failure(response, 'CALCULATOR_RETIRED', 'This calculator has been retired.', 410);
          return;
        }
        failure(response, 'NOT_FOUND', 'Published calculator not found.', 404);
        return;
      }
      const data = {
        slug: record.calculatorSlug,
        calculatorSlug: record.calculatorSlug,
        version: record.version,
        ...(record.releaseState ? { releaseState: record.releaseState } : {}),
        ...publicProjection(record.payload),
      };
      const tag = etag(data);
      response.setHeader('ETag', tag);
      setCatalogHeaders(response, publicTestRelease);
      if (etagMatches(request, tag)) {
        response.status(304).end();
        return;
      }
      envelope(response, data);
    } catch (error) {
      next(error);
    }
  });
  router.get('/biomarkers', async (request, response, next) => {
    try {
      const allowedQuery = new Set(['domain', 'search']);
      const unknownQuery = Object.keys(request.query).filter((key) => !allowedQuery.has(key));
      if (unknownQuery.length > 0) {
        failure(response, 'INVALID_QUERY', 'Unsupported biomarker query field.', 422, {
          unknown: unknownQuery,
        });
        return;
      }
      const rawDomain = request.query.domain;
      const domain = typeof rawDomain === 'string' && validSlug(rawDomain) ? rawDomain : undefined;
      const search =
        request.query.search === undefined ? undefined : boundedSearch(request.query.search);
      if (rawDomain !== undefined && !domain) {
        failure(response, 'INVALID_QUERY', 'The domain query value is invalid.', 422);
        return;
      }
      if (request.query.search !== undefined && !search) {
        failure(response, 'INVALID_QUERY', 'The search query value is invalid.', 422);
        return;
      }
      const records = await biomarker.list({
        domain,
        search,
      });
      const data = records
        .filter((record) => publicTestRelease || isVerifiedBiomarkerRecord(record))
        .flatMap((record) => {
          const projected = publicBiomarkerProjection(record, publicTestRelease);
          return projected ? [projected] : [];
        });
      const tag = etag(data);
      response.setHeader('ETag', tag);
      setCatalogHeaders(response, publicTestRelease);
      if (etagMatches(request, tag)) {
        response.status(304).end();
        return;
      }
      envelope(response, data);
    } catch (error) {
      next(error);
    }
  });
  router.get('/biomarkers/:key', async (request, response, next) => {
    try {
      const key = request.params.key;
      if (!key || !validSlug(key)) {
        failure(response, 'INVALID_PARAMETER', 'The biomarker key is invalid.', 422);
        return;
      }
      const result = await biomarker.get(key);
      if (!result || (!publicTestRelease && !isVerifiedBiomarkerRecord(result))) {
        setCatalogHeaders(response, publicTestRelease);
        failure(response, 'NOT_FOUND', 'Biomarker not found.', 404);
        return;
      }
      const [relatedRecords, calculatorRecords] = await Promise.all([
        biomarker.related?.(result) ?? Promise.resolve([]),
        biomarker.usedInCalculators?.(key) ?? Promise.resolve([]),
      ]);
      const projectedResult = publicBiomarkerProjection(result, publicTestRelease);
      if (!projectedResult) {
        setCatalogHeaders(response, publicTestRelease);
        failure(response, 'NOT_FOUND', 'Biomarker not found.', 404);
        return;
      }
      const data = {
        ...projectedResult,
        relatedBiomarkers: relatedRecords
          .filter((record) => publicTestRelease || isVerifiedBiomarkerRecord(record))
          .flatMap((record) => {
            const projected = publicRelatedBiomarkerProjection(record, publicTestRelease);
            return projected ? [projected] : [];
          }),
        usedInCalculators: calculatorRecords.flatMap((record) => {
          const projected = publicUsedInCalculatorProjection(record, publicTestRelease);
          return projected ? [projected] : [];
        }),
      };
      const tag = etag(data);
      response.setHeader('ETag', tag);
      setCatalogHeaders(response, publicTestRelease);
      if (etagMatches(request, tag)) {
        response.status(304).end();
        return;
      }
      envelope(response, data);
    } catch (error) {
      next(error);
    }
  });
  router.get('/results/:shareToken', async (request, response, next) => {
    setResultPrivacyHeaders(response);
    try {
      const shareToken = request.params.shareToken;
      if (!shareToken || shareToken.length > 256 || /[^A-Za-z0-9_-]/.test(shareToken)) {
        failure(response, 'NOT_FOUND', 'Result not found or expired.', 404);
        return;
      }
      const result = await resultSource.getByShareToken(shareToken);
      if (!result) {
        failure(response, 'NOT_FOUND', 'Result not found or expired.', 404);
        return;
      }
      envelope(response, publicResultProjection(result));
    } catch (error) {
      next(error);
    }
  });
  const leads = Router();
  leads.use((_request, response, next) => {
    setPrivateNoStoreHeaders(response);
    next();
  });
  leads.use(
    rateLimiter(options.leadRateLimit?.windowMs ?? 60_000, options.leadRateLimit?.max ?? 5),
  );
  leads.post('/', async (request, response, next) => {
    try {
      if (!options.leadCapture) {
        failure(
          response,
          'LEAD_CAPTURE_UNAVAILABLE',
          'Optional email capture is not currently available.',
          503,
        );
        return;
      }
      if (!isRecord(request.body)) {
        failure(response, 'INVALID_REQUEST', 'A lead request object is required.', 422);
        return;
      }
      const allowedBodyKeys = new Set(['email', 'consent', 'consentVersion']);
      if (Object.keys(request.body).some((key) => !allowedBodyKeys.has(key))) {
        failure(response, 'INVALID_REQUEST', 'Request contains an unsupported field.', 422);
        return;
      }
      const email = normalizedLeadEmail(request.body.email);
      if (!email) {
        failure(response, 'INVALID_REQUEST', 'A valid email address is required.', 422, {
          email: { code: 'INVALID_EMAIL', message: 'Enter a valid email address.' },
        });
        return;
      }
      if (request.body.consent !== true) {
        failure(response, 'CONSENT_REQUIRED', 'Explicit email consent is required.', 422, {
          consent: { code: 'CONSENT_REQUIRED', message: 'Consent must be selected.' },
        });
        return;
      }
      if (request.body.consentVersion !== options.leadCapture.consentVersion) {
        failure(
          response,
          'CONSENT_VERSION_MISMATCH',
          'The consent text changed; refresh the page and review it again.',
          422,
        );
        return;
      }
      await options.leadCapture.store.save({
        email,
        consentVersion: options.leadCapture.consentVersion,
      });
      envelope(response, { accepted: true }, 201);
    } catch (error) {
      next(error);
    }
  });
  router.use('/leads', leads);
  const assess = Router();
  assess.use((_request, response, next) => {
    setPrivateNoStoreHeaders(response);
    next();
  });
  assess.use(rateLimiter(options.rateLimit?.windowMs ?? 60_000, options.rateLimit?.max ?? 30));
  assess.post('/calculators/:slug/assess', async (request, response, next) => {
    try {
      const slug = request.params.slug;
      if (!validSlug(slug)) {
        failure(response, 'INVALID_SLUG', 'Calculator slug is invalid.', 400);
        return;
      }
      const record = await catalog.getPublished(slug);
      if (!record) {
        failure(response, 'NOT_FOUND', 'Published calculator not found.', 404);
        return;
      }
      const body = isRecord(request.body) ? request.body : {};
      const allowedBodyKeys = new Set([
        'inputs',
        'omitted',
        'visitorId',
        'sessionId',
        'idempotencyKey',
      ]);
      const unknownBodyKey = Object.keys(body).find((key) => !allowedBodyKeys.has(key));
      if (unknownBodyKey) {
        failure(response, 'INVALID_REQUEST', `Unknown request field "${unknownBodyKey}".`, 422);
        return;
      }
      const inputs = body.inputs;
      if (!isRecord(inputs)) {
        failure(response, 'INVALID_REQUEST', 'Body must contain an inputs object.', 422);
        return;
      }
      const omitted = body.omitted;
      if (
        omitted !== undefined &&
        (!Array.isArray(omitted) ||
          omitted.length > 200 ||
          omitted.some((item) => typeof item !== 'string' || !validParameterKey(item)))
      ) {
        failure(response, 'INVALID_REQUEST', 'omitted must be an array of parameter keys.', 422);
        return;
      }
      const parameterKeys = new Set(
        Array.isArray(record.payload.parameters)
          ? record.payload.parameters.filter(isRecord).map((parameter) => parameter.key)
          : [],
      );
      const omittedKeys = (omitted ?? []) as string[];
      const unknownOmitted = omittedKeys.find((key) => !parameterKeys.has(key));
      if (unknownOmitted) {
        failure(response, 'INVALID_REQUEST', `Unknown omitted parameter "${unknownOmitted}".`, 422);
        return;
      }
      const visitorId =
        body.visitorId === undefined ? undefined : boundedIdentifier(body.visitorId);
      const sessionId =
        body.sessionId === undefined ? undefined : boundedIdentifier(body.sessionId);
      if (body.visitorId !== undefined && !visitorId) {
        failure(response, 'INVALID_REQUEST', 'visitorId is invalid.', 422);
        return;
      }
      if (body.sessionId !== undefined && !sessionId) {
        failure(response, 'INVALID_REQUEST', 'sessionId is invalid.', 422);
        return;
      }
      const headerIdempotencyKey = request.header('Idempotency-Key');
      const bodyIdempotencyKey = body.idempotencyKey;
      if (
        bodyIdempotencyKey !== undefined &&
        (typeof bodyIdempotencyKey !== 'string' ||
          (bodyIdempotencyKey !== headerIdempotencyKey && headerIdempotencyKey !== undefined))
      ) {
        failure(response, 'INVALID_REQUEST', 'Idempotency key values must match.', 422);
        return;
      }
      const idempotencyKey =
        typeof bodyIdempotencyKey === 'string' ? bodyIdempotencyKey : headerIdempotencyKey;
      if (idempotencyKey !== undefined && !/^[A-Za-z0-9._~-]{8,128}$/.test(idempotencyKey)) {
        failure(response, 'INVALID_REQUEST', 'Idempotency key must be 8–128 safe characters.', 422);
        return;
      }
      const calculationInputs = { ...inputs };
      for (const key of omittedKeys) delete calculationInputs[key];
      const calculationStartedAt = performance.now();
      const result = calculate(record.payload, calculationInputs, {
        includeTrace: false,
      });
      const computeMs = Math.max(0, performance.now() - calculationStartedAt);
      if (!result.ok) {
        const inputErrors = result.errors.filter(isInputError);
        if (inputErrors.length > 0) {
          failure(
            response,
            'INPUT_VALIDATION_FAILED',
            'Inputs did not satisfy the calculator contract.',
            422,
            inputErrorFields(inputErrors),
          );
        } else if (result.errors.some(isConfigurationError)) {
          failure(
            response,
            'CALCULATOR_CONFIGURATION_INVALID',
            'This calculator is temporarily unavailable while its configuration is reviewed.',
            503,
          );
        } else {
          failure(
            response,
            'INPUT_VALIDATION_FAILED',
            'Inputs did not satisfy the calculator contract.',
            422,
            inputErrorFields(result.errors),
          );
        }
        return;
      }
      if (!options.assessmentStore) {
        failure(
          response,
          'ASSESSMENT_PERSISTENCE_UNAVAILABLE',
          'Assessment persistence is not configured.',
          503,
        );
        return;
      }
      if (!record.id) {
        failure(
          response,
          'VERSION_REFERENCE_UNAVAILABLE',
          'This calculator version cannot be reproduced safely yet.',
          503,
        );
        return;
      }
      const replayKey = idempotencyKey ? `${record.calculatorSlug}:${idempotencyKey}` : undefined;
      const replayFingerprint = idempotencyKey
        ? fingerprint({
            versionId: record.id,
            inputs: calculationInputs,
            omitted: omittedKeys,
            visitorId,
            sessionId,
          })
        : undefined;
      if (replayKey && replayFingerprint) {
        const now = Date.now();
        for (const [key, entry] of idempotencyReplay) {
          if (entry.expiresAt <= now) idempotencyReplay.delete(key);
        }
        const prior = idempotencyReplay.get(replayKey);
        if (prior) {
          if (prior.fingerprint !== replayFingerprint) {
            failure(
              response,
              'IDEMPOTENCY_KEY_REUSED',
              'Idempotency key was reused with different inputs.',
              409,
            );
            return;
          }
          envelope(response, prior.response);
          return;
        }
      }
      const saved = await options.assessmentStore.save({
        calculatorSlug: record.calculatorSlug,
        versionId: record.id,
        version: record.version,
        inputs: inputs,
        result,
        computeMs,
        presentation: buildResultPresentation(record),
        visitorId,
        sessionId,
        omitted: omittedKeys,
        idempotencyKey,
      });
      const data = {
        id: saved.id,
        calculatorSlug: record.calculatorSlug,
        version: record.version,
        score: result.score,
        category: result.category,
        shareToken: saved.shareToken,
        ...(record.releaseState ? { releaseState: record.releaseState } : {}),
      };
      if (replayKey && replayFingerprint) {
        idempotencyReplay.set(replayKey, {
          fingerprint: replayFingerprint,
          expiresAt: Date.now() + (options.idempotencyTtlMs ?? 86_400_000),
          response: data,
        });
        if (idempotencyReplay.size > 10_000) {
          const oldest = idempotencyReplay.keys().next().value;
          if (oldest) idempotencyReplay.delete(oldest);
        }
      }
      envelope(response, data);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        failure(response, 'IDEMPOTENCY_KEY_REUSED', error.message, 409);
        return;
      }
      next(error);
    }
  });
  router.use(assess);
  return router;
}
