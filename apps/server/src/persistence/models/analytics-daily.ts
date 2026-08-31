import { model, models, Schema, type Model } from 'mongoose';

export interface AnalyticsDailyDocument {
  day: string;
  timezone: string;
  scope: 'global' | 'calculator';
  scopeKey: string;
  calculatorSlug?: string;
  identityBasis: 'visitor' | 'session';
  identityKeyVersion: string;
  minimumCohortSize: number;
  visitors: number;
  sessions: number;
  newVisitors: number;
  returningVisitors: number;
  identitySketch: number[];
  assessments: number;
  results: number;
  leads: number;
  eventCounts: Record<string, number>;
  sessionDurationTotalMs: number;
  sessionDurationSamples: number;
  pageViews: number;
  breakdowns: Record<string, Record<string, number>>;
  funnel: Record<string, number>;
  stepViews: Record<string, number>;
  scoreBuckets: Record<string, number>;
  categoryCounts: Record<string, number>;
  omittedParameterCounts: Record<string, number>;
  unitCounts: Record<string, number>;
  versionCounts: Record<string, number>;
  computeMsTotal: number;
  computeMsSamples: number;
  sourceEventCount: number;
  sourceMaxOccurredAt?: Date;
  sourceRetentionDays?: {
    events: number;
    assessments: number;
    leads: number;
    visitors?: number;
  };
  sourceCompletenessCheckedAt?: Date;
  rolledUpAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsDailySchema = new Schema<AnalyticsDailyDocument>(
  {
    day: { type: String, required: true },
    timezone: { type: String, required: true },
    scope: { type: String, enum: ['global', 'calculator'], required: true },
    scopeKey: { type: String, required: true },
    calculatorSlug: { type: String },
    identityBasis: { type: String, enum: ['visitor', 'session'], required: true },
    identityKeyVersion: { type: String, required: true },
    minimumCohortSize: { type: Number, required: true, min: 2, max: 100, default: 5 },
    visitors: { type: Number, required: true, min: 0, default: 0 },
    sessions: { type: Number, required: true, min: 0, default: 0 },
    newVisitors: { type: Number, required: true, min: 0, default: 0 },
    returningVisitors: { type: Number, required: true, min: 0, default: 0 },
    identitySketch: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) =>
          value.length === 64 &&
          value.every(
            (register) => Number.isSafeInteger(register) && register >= 0 && register <= 65,
          ),
        message: 'identitySketch must contain exactly 64 safe HLL registers in the range 0..65.',
      },
    },
    assessments: { type: Number, required: true, min: 0, default: 0 },
    results: { type: Number, required: true, min: 0, default: 0 },
    leads: { type: Number, required: true, min: 0, default: 0 },
    eventCounts: { type: Schema.Types.Mixed, required: true, default: {} },
    sessionDurationTotalMs: { type: Number, required: true, min: 0, default: 0 },
    sessionDurationSamples: { type: Number, required: true, min: 0, default: 0 },
    pageViews: { type: Number, required: true, min: 0, default: 0 },
    breakdowns: { type: Schema.Types.Mixed, required: true, default: {} },
    funnel: { type: Schema.Types.Mixed, required: true, default: {} },
    stepViews: { type: Schema.Types.Mixed, required: true, default: {} },
    scoreBuckets: { type: Schema.Types.Mixed, required: true, default: {} },
    categoryCounts: { type: Schema.Types.Mixed, required: true, default: {} },
    omittedParameterCounts: { type: Schema.Types.Mixed, required: true, default: {} },
    unitCounts: { type: Schema.Types.Mixed, required: true, default: {} },
    versionCounts: { type: Schema.Types.Mixed, required: true, default: {} },
    computeMsTotal: { type: Number, required: true, min: 0, default: 0 },
    computeMsSamples: { type: Number, required: true, min: 0, default: 0 },
    sourceEventCount: { type: Number, required: true, min: 0, default: 0 },
    sourceMaxOccurredAt: { type: Date },
    sourceRetentionDays: {
      events: { type: Number, min: 1 },
      assessments: { type: Number, min: 1 },
      leads: { type: Number, min: 1 },
      visitors: { type: Number, min: 1 },
    },
    sourceCompletenessCheckedAt: { type: Date },
    rolledUpAt: { type: Date, required: true },
  },
  { collection: 'analytics_daily', timestamps: true },
);

AnalyticsDailySchema.index(
  { day: 1, timezone: 1, scope: 1, scopeKey: 1, identityBasis: 1, identityKeyVersion: 1 },
  { unique: true, name: 'analytics_daily_partition_unique_v3' },
);
AnalyticsDailySchema.index({ day: -1 });
AnalyticsDailySchema.index({ calculatorSlug: 1, day: -1 });
AnalyticsDailySchema.index({ timezone: 1, day: 1, scope: 1, calculatorSlug: 1 });

export const AnalyticsDailyModel: Model<AnalyticsDailyDocument> =
  (models.AnalyticsDaily as Model<AnalyticsDailyDocument> | undefined) ??
  model<AnalyticsDailyDocument>('AnalyticsDaily', AnalyticsDailySchema);

const PARTITION_INDEX = {
  day: 1,
  timezone: 1,
  scope: 1,
  scopeKey: 1,
  identityBasis: 1,
  identityKeyVersion: 1,
} as const;
const LEGACY_PARTITION_INDEXES = [
  { day: 1, timezone: 1, scopeKey: 1 },
  { day: 1, timezone: 1, scopeKey: 1, identityKeyVersion: 1 },
  { day: 1, timezone: 1, scopeKey: 1, identityBasis: 1, identityKeyVersion: 1 },
] as const;

function sameIndexKey(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value,
    )
  );
}

function mongoErrorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error
    ? (error as { readonly code?: unknown }).code
    : undefined;
}

async function existingIndexes(): Promise<
  Awaited<ReturnType<typeof AnalyticsDailyModel.collection.indexes>>
> {
  try {
    return await AnalyticsDailyModel.collection.indexes();
  } catch (error) {
    // updateMany without an upsert does not create a fresh collection. Mongoose
    // auto-creation can race this explicit startup migration, so a missing
    // namespace means there are simply no indexes yet; createIndex below will
    // create the collection atomically.
    if (mongoErrorCode(error) === 26) return [];
    throw error;
  }
}

/**
 * Explicit production-safe upgrade for the permanent analytics partition key.
 * Only exact, known legacy unique indexes are removed; unrelated indexes are
 * never synchronized away.
 */
export async function ensureAnalyticsDailyIndexes(): Promise<{
  readonly migratedDocuments: number;
  readonly droppedLegacyIndexes: readonly string[];
}> {
  const migration = await AnalyticsDailyModel.updateMany(
    {
      $or: [
        { identityBasis: { $exists: false } },
        { identityKeyVersion: { $exists: false } },
        { minimumCohortSize: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          identityBasis: { $ifNull: ['$identityBasis', 'session'] },
          identityKeyVersion: { $ifNull: ['$identityKeyVersion', 'v1'] },
          minimumCohortSize: { $ifNull: ['$minimumCohortSize', 5] },
        },
      },
    ],
  );
  let indexes = await existingIndexes();
  if (!indexes.some((index) => index.unique === true && sameIndexKey(index.key, PARTITION_INDEX))) {
    await AnalyticsDailyModel.collection.createIndex(PARTITION_INDEX, {
      unique: true,
      name: 'analytics_daily_partition_unique_v3',
    });
    indexes = await AnalyticsDailyModel.collection.indexes();
  }
  const droppedLegacyIndexes: string[] = [];
  for (const index of indexes) {
    if (
      index.unique === true &&
      typeof index.name === 'string' &&
      LEGACY_PARTITION_INDEXES.some((legacy) => sameIndexKey(index.key, legacy))
    ) {
      try {
        await AnalyticsDailyModel.collection.dropIndex(index.name);
        droppedLegacyIndexes.push(index.name);
      } catch (error) {
        // Concurrent application instances can both observe the same legacy
        // index. Only Mongo's exact "already gone" outcomes are safe to ignore.
        const code = mongoErrorCode(error);
        if (code !== 26 && code !== 27) throw error;
      }
    }
  }
  return { migratedDocuments: migration.modifiedCount, droppedLegacyIndexes };
}
