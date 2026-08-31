import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

import { CONTRACT_SCHEMA_IDS } from '@niro/contracts';

import { LIFECYCLE_STATUSES, type LifecycleStatus } from '../types';

export interface CalculatorVersionDocument {
  calculatorId: Types.ObjectId;
  calculatorSlug: string;
  version: number;
  status: LifecycleStatus;
  schemaId: string;
  engineSemanticVersion: string;
  payload: Record<string, unknown>;
  measurementRevisionIds: string[];
  measurementSnapshots: unknown[];
  sourceHash?: string;
  logicHash?: string;
  contentHash?: string;
  reviewHash?: string;
  versionHash?: string;
  createdBy?: Types.ObjectId;
  lastEditedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  reviewEvidence?: {
    reviewerId: Types.ObjectId;
    reviewedAt: Date;
    decision: 'approved';
    scope: 'full-version';
    protectedHash: string;
  };
  publishedAt?: Date;
  immutableAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type JsonRecord = Record<string, unknown>;
const PROTECTED_CALCULATOR_VERSION_STATUSES = ['published', 'retired'] as const;
const IMMUTABLE_CALCULATOR_VERSION_FIELDS = [
  'calculatorId',
  'calculatorSlug',
  'version',
  'schemaId',
  'engineSemanticVersion',
  'payload',
  'measurementRevisionIds',
  'measurementSnapshots',
  'sourceHash',
  'logicHash',
  'contentHash',
  'reviewHash',
  'versionHash',
  'createdBy',
  'lastEditedBy',
  'approvedBy',
  'approvedAt',
  'reviewEvidence',
  'publishedAt',
  'immutableAt',
  'createdAt',
] as const;
const IMMUTABLE_CALCULATOR_VERSION_MESSAGE =
  'Published and retired calculator versions are immutable; create a new draft.';

const ReviewEvidenceSchema = new Schema(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    reviewedAt: { type: Date, required: true },
    decision: { type: String, enum: ['approved'], required: true },
    scope: { type: String, enum: ['full-version'], required: true },
    protectedHash: { type: String, required: true },
  },
  { _id: false },
);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedComparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalizedComparable(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => key !== '__v' && key !== 'updatedAt')
      .sort()
      .map((key) => [key, normalizedComparable(value[key])]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizedComparable(left)) === JSON.stringify(normalizedComparable(right));
}

/** Pure invariant shared by document middleware and focused persistence tests. */
export function calculatorVersionMutationIssue(
  original: JsonRecord,
  next: JsonRecord,
): string | undefined {
  if (!PROTECTED_CALCULATOR_VERSION_STATUSES.includes(original.status as never)) return undefined;
  if (IMMUTABLE_CALCULATOR_VERSION_FIELDS.some((field) => !sameValue(original[field], next[field])))
    return IMMUTABLE_CALCULATOR_VERSION_MESSAGE;
  if (original.status === 'published' && next.status === 'retired') return undefined;
  return original.status === next.status ? undefined : IMMUTABLE_CALCULATOR_VERSION_MESSAGE;
}

function updateEntries(update: JsonRecord): {
  readonly supported: boolean;
  readonly paths: readonly {
    readonly operator: string;
    readonly path: string;
    readonly value: unknown;
  }[];
} {
  const operatorKeys = Object.keys(update).filter((key) => key.startsWith('$'));
  if (operatorKeys.length === 0)
    return {
      supported: true,
      paths: Object.entries(update).map(([path, value]) => ({ operator: '$set', path, value })),
    };
  if (Object.keys(update).some((key) => !key.startsWith('$')))
    return { supported: false, paths: [] };
  const supportedOperators = new Set(['$set', '$unset', '$inc', '$setOnInsert']);
  if (operatorKeys.some((operator) => !supportedOperators.has(operator)))
    return { supported: false, paths: [] };
  const paths: { operator: string; path: string; value: unknown }[] = [];
  for (const operator of operatorKeys) {
    const values = update[operator];
    if (!isRecord(values)) return { supported: false, paths: [] };
    for (const [path, value] of Object.entries(values)) paths.push({ operator, path, value });
  }
  return { supported: true, paths };
}

function effectiveUpdateEntries(update: JsonRecord) {
  const entries = updateEntries(update);
  return {
    supported: entries.supported,
    paths: entries.paths.filter(
      ({ operator, path }) =>
        operator !== '$setOnInsert' &&
        !(operator === '$set' && path === 'updatedAt') &&
        !(['$set', '$inc'].includes(operator) && path === '__v'),
    ),
  };
}

function exactRetirementUpdate(update: JsonRecord): boolean {
  const entries = effectiveUpdateEntries(update);
  return (
    entries.supported &&
    entries.paths.length === 1 &&
    entries.paths[0]?.operator === '$set' &&
    entries.paths[0]?.path === 'status' &&
    entries.paths[0]?.value === 'retired'
  );
}

/** Pure query-update invariant; replacements compare the complete protected envelope. */
export function calculatorVersionUpdateIssue(
  original: JsonRecord,
  update: JsonRecord,
  replacement = false,
): string | undefined {
  if (!PROTECTED_CALCULATOR_VERSION_STATUSES.includes(original.status as never)) return undefined;
  if (replacement)
    return calculatorVersionMutationIssue(original, { ...update, _id: original._id });
  const effective = effectiveUpdateEntries(update);
  if (!effective.supported) return IMMUTABLE_CALCULATOR_VERSION_MESSAGE;
  if (effective.paths.length === 0) return undefined;
  if (original.status === 'published' && exactRetirementUpdate(update)) return undefined;
  return IMMUTABLE_CALCULATOR_VERSION_MESSAGE;
}

const CalculatorVersionSchema = new Schema<CalculatorVersionDocument>(
  {
    calculatorId: { type: Schema.Types.ObjectId, ref: 'Calculator', required: true },
    calculatorSlug: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: LIFECYCLE_STATUSES, required: true, default: 'draft' },
    schemaId: { type: String, required: true, default: CONTRACT_SCHEMA_IDS.calculatorVersion },
    engineSemanticVersion: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    measurementRevisionIds: { type: [String], required: true, default: [] },
    measurementSnapshots: { type: Schema.Types.Mixed, required: true, default: [] },
    sourceHash: { type: String },
    logicHash: { type: String },
    contentHash: { type: String },
    reviewHash: { type: String },
    versionHash: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedAt: { type: Date },
    reviewEvidence: { type: ReviewEvidenceSchema, default: undefined },
    publishedAt: { type: Date },
    immutableAt: { type: Date },
  },
  { collection: 'calculator_versions', timestamps: true, optimisticConcurrency: true },
);

CalculatorVersionSchema.index({ calculatorId: 1, version: -1 }, { unique: true });
CalculatorVersionSchema.index({ calculatorSlug: 1, status: 1 });
CalculatorVersionSchema.index({ versionHash: 1 }, { unique: true, sparse: true });

CalculatorVersionSchema.pre('save', async function protectPublishedVersion() {
  if (this.isNew) return;
  const versionModel = this.constructor as Model<CalculatorVersionDocument>;
  const original = await versionModel.collection.findOne({ _id: this._id });
  if (!original) return;
  const issue = calculatorVersionMutationIssue(
    original as unknown as JsonRecord,
    this.toObject({ depopulate: true, minimize: false }) as unknown as JsonRecord,
  );
  if (issue) throw new Error(issue);
});

type CalculatorVersionMutationQuery = Query<unknown, CalculatorVersionDocument>;

async function protectPublishedVersionQuery(
  this: CalculatorVersionMutationQuery,
  replacement = false,
): Promise<void> {
  const rawUpdate = this.getUpdate();
  if (!isRecord(rawUpdate)) throw new Error(IMMUTABLE_CALCULATOR_VERSION_MESSAGE);
  const filter = this.getFilter();
  const versionModel = this.model as Model<CalculatorVersionDocument>;
  const session = this.getOptions().session;
  const protectedRecords = await versionModel.collection
    .find(
      {
        $and: [filter, { status: { $in: [...PROTECTED_CALCULATOR_VERSION_STATUSES] } }],
      } as never,
      { ...(session ? { session } : {}) },
    )
    .toArray();
  for (const original of protectedRecords) {
    const issue = calculatorVersionUpdateIssue(
      original as unknown as JsonRecord,
      rawUpdate,
      replacement,
    );
    if (issue) throw new Error(issue);
  }

  const retirementIntent = replacement
    ? rawUpdate.status === 'retired'
    : exactRetirementUpdate(rawUpdate);
  this.setQuery({
    $and: [
      filter,
      retirementIntent
        ? { status: 'published' }
        : { status: { $nin: [...PROTECTED_CALCULATOR_VERSION_STATUSES] } },
    ],
  });
}

for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'] as const) {
  CalculatorVersionSchema.pre(
    operation,
    { document: false, query: true },
    async function calculatorVersionQueryGuard() {
      await protectPublishedVersionQuery.call(this, operation === 'replaceOne');
    },
  );
}

export type CalculatorVersionModelDocument = HydratedDocument<CalculatorVersionDocument>;
export const CalculatorVersionModel: Model<CalculatorVersionDocument> =
  (models.CalculatorVersion as Model<CalculatorVersionDocument> | undefined) ??
  model<CalculatorVersionDocument>('CalculatorVersion', CalculatorVersionSchema);
