import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

export interface MeasurementRevisionDocument {
  key: string;
  revision: number;
  status: 'draft' | 'verified' | 'retired';
  displayName: string;
  kind: 'biomarker' | 'demographic' | 'lifestyle' | 'derived';
  canonicalUnit?: string;
  definition: Record<string, unknown>;
  definitionHash: string;
  sources: unknown[];
  migrationProvenance?: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewHash?: string;
  verifiedAt?: Date;
  retiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type JsonRecord = Record<string, unknown>;

const PROTECTED_MEASUREMENT_STATUSES = ['verified', 'retired'] as const;
const IMMUTABLE_MEASUREMENT_FIELDS = [
  'key',
  'revision',
  'displayName',
  'kind',
  'canonicalUnit',
  'definition',
  'definitionHash',
  'sources',
  'migrationProvenance',
  'createdBy',
  'reviewedBy',
  'reviewHash',
  'verifiedAt',
  'createdAt',
] as const;
const IMMUTABILITY_MESSAGE =
  'Verified and retired measurement revisions are immutable; create a new draft revision.';

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
      .sort()
      .map((key) => [key, normalizedComparable(value[key])]),
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizedComparable(left)) === JSON.stringify(normalizedComparable(right));
}

function validRetiredAt(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** Pure invariant used by document middleware and focused persistence tests. */
export function measurementRevisionMutationIssue(
  original: JsonRecord,
  next: JsonRecord,
): string | undefined {
  if (!PROTECTED_MEASUREMENT_STATUSES.includes(original.status as never)) return undefined;
  if (IMMUTABLE_MEASUREMENT_FIELDS.some((field) => !sameValue(original[field], next[field])))
    return IMMUTABILITY_MESSAGE;

  if (original.status === 'verified' && next.status === 'retired') {
    return validRetiredAt(next.retiredAt) ? undefined : IMMUTABILITY_MESSAGE;
  }
  if (original.status !== next.status || !sameValue(original.retiredAt, next.retiredAt))
    return IMMUTABILITY_MESSAGE;
  return undefined;
}

function updateEntries(update: JsonRecord): {
  readonly paths: readonly {
    readonly operator: string;
    readonly path: string;
    readonly value: unknown;
  }[];
  readonly supported: boolean;
} {
  const operatorKeys = Object.keys(update).filter((key) => key.startsWith('$'));
  if (operatorKeys.length === 0) {
    return {
      supported: true,
      paths: Object.entries(update).map(([path, value]) => ({ operator: '$set', path, value })),
    };
  }
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

function isMiddlewareMetadataEntry(entry: {
  readonly operator: string;
  readonly path: string;
}): boolean {
  return (
    entry.operator === '$setOnInsert' ||
    (entry.operator === '$set' && entry.path === 'updatedAt') ||
    (['$set', '$inc'].includes(entry.operator) && entry.path === '__v')
  );
}

function exactRetirementUpdate(update: JsonRecord): boolean {
  const entries = updateEntries(update);
  if (!entries.supported) return false;
  const effective = entries.paths.filter((entry) => !isMiddlewareMetadataEntry(entry));
  if (
    effective.some(
      ({ operator, path }) => operator !== '$set' || !['status', 'retiredAt'].includes(path),
    )
  )
    return false;
  const status = effective.find(({ path }) => path === 'status');
  const retiredAt = effective.find(({ path }) => path === 'retiredAt');
  return status?.value === 'retired' && retiredAt !== undefined && validRetiredAt(retiredAt.value);
}

/** Pure query-update invariant; replacement mode compares the complete envelope. */
export function measurementRevisionUpdateIssue(
  original: JsonRecord,
  update: JsonRecord,
  replacement = false,
): string | undefined {
  if (!PROTECTED_MEASUREMENT_STATUSES.includes(original.status as never)) return undefined;
  if (replacement) {
    return measurementRevisionMutationIssue(original, { ...update, _id: original._id });
  }
  const entries = updateEntries(update);
  if (!entries.supported) return IMMUTABILITY_MESSAGE;
  const effective = entries.paths.filter((entry) => !isMiddlewareMetadataEntry(entry));
  if (effective.length === 0) return undefined;
  if (original.status === 'verified' && exactRetirementUpdate(update)) return undefined;
  return IMMUTABILITY_MESSAGE;
}

const MeasurementRevisionSchema = new Schema<MeasurementRevisionDocument>(
  {
    key: { type: String, required: true, trim: true },
    revision: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['draft', 'verified', 'retired'],
      required: true,
      default: 'draft',
    },
    displayName: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['biomarker', 'demographic', 'lifestyle', 'derived'],
      required: true,
    },
    canonicalUnit: { type: String },
    definition: { type: Schema.Types.Mixed, required: true },
    definitionHash: { type: String, required: true },
    sources: { type: Schema.Types.Mixed, required: true, default: [] },
    migrationProvenance: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    reviewHash: { type: String },
    verifiedAt: { type: Date },
    retiredAt: { type: Date },
  },
  {
    collection: 'biomarkers',
    timestamps: true,
    optimisticConcurrency: true,
    // This collection has an explicit, guarded text-index migration below. Letting
    // Mongoose auto-create the alias-aware text index can race the legacy index.
    autoIndex: false,
    // Migration provenance is source evidence. Empty objects are meaningful JSON
    // values and must survive Mongoose serialization exactly (revision 2 exposed
    // the risk of the default minimize behavior removing them).
    minimize: false,
  },
);

MeasurementRevisionSchema.pre('save', async function protectImmutableMeasurementRevision() {
  if (this.isNew) return;
  const revisionModel = this.constructor as Model<MeasurementRevisionDocument>;
  const original = await revisionModel.collection.findOne({ _id: this._id });
  if (!original) return;
  const issue = measurementRevisionMutationIssue(
    original as unknown as JsonRecord,
    this.toObject({ depopulate: true, minimize: false }) as unknown as JsonRecord,
  );
  if (issue) throw new Error(issue);
});

type MeasurementMutationQuery = Query<unknown, MeasurementRevisionDocument>;

async function protectImmutableMeasurementRevisionQuery(
  this: MeasurementMutationQuery,
  replacement = false,
): Promise<void> {
  const rawUpdate = this.getUpdate();
  if (!isRecord(rawUpdate)) throw new Error(IMMUTABILITY_MESSAGE);
  const filter = this.getFilter();
  const revisionModel = this.model as Model<MeasurementRevisionDocument>;
  const session = this.getOptions().session;
  const protectedRecords = await revisionModel.collection
    .find(
      {
        $and: [filter, { status: { $in: [...PROTECTED_MEASUREMENT_STATUSES] } }],
      } as never,
      { ...(session ? { session } : {}) },
    )
    .toArray();
  for (const original of protectedRecords) {
    const issue = measurementRevisionUpdateIssue(
      original as unknown as JsonRecord,
      rawUpdate,
      replacement,
    );
    if (issue) throw new Error(issue);
  }

  const retirementIntent = replacement
    ? rawUpdate.status === 'retired' && validRetiredAt(rawUpdate.retiredAt)
    : exactRetirementUpdate(rawUpdate);
  this.setQuery({
    $and: [
      filter,
      retirementIntent
        ? { status: 'verified' }
        : { status: { $nin: [...PROTECTED_MEASUREMENT_STATUSES] } },
    ],
  });
}

for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'] as const) {
  MeasurementRevisionSchema.pre(
    operation,
    { document: false, query: true },
    async function measurementRevisionQueryGuard() {
      await protectImmutableMeasurementRevisionQuery.call(this, operation === 'replaceOne');
    },
  );
}

MeasurementRevisionSchema.index({ key: 1, revision: 1 }, { unique: true });
MeasurementRevisionSchema.index({ key: 1, status: 1 });
MeasurementRevisionSchema.index(
  { status: 1, key: 1, revision: -1 },
  { name: 'biomarker_public_latest_v1' },
);
MeasurementRevisionSchema.index(
  { status: 1, 'definition.domainKeys': 1, key: 1, revision: -1 },
  { name: 'biomarker_public_domain_v1' },
);
MeasurementRevisionSchema.index(
  { displayName: 'text', key: 'text', 'definition.aliases': 'text' },
  {
    name: 'biomarker_public_text_v1',
    weights: { displayName: 10, key: 8, 'definition.aliases': 6 },
    default_language: 'english',
    language_override: 'language',
  },
);

export type MeasurementRevisionModelDocument = HydratedDocument<MeasurementRevisionDocument>;
export const MeasurementRevisionModel: Model<MeasurementRevisionDocument> =
  (models.MeasurementRevision as Model<MeasurementRevisionDocument> | undefined) ??
  model<MeasurementRevisionDocument>('MeasurementRevision', MeasurementRevisionSchema);

const EXPECTED_TEXT_FIELDS = ['definition.aliases', 'displayName', 'key'] as const;
const LEGACY_TEXT_FIELDS = ['displayName', 'key'] as const;

export type MeasurementTextIndexDisposition =
  | { readonly kind: 'missing' }
  | { readonly kind: 'expected'; readonly name: string }
  | { readonly kind: 'legacy'; readonly name: string }
  | { readonly kind: 'unexpected'; readonly descriptions: readonly string[] };

export interface MeasurementIndexDescription {
  readonly name?: string;
  readonly key?: Readonly<Record<string, unknown>>;
  readonly weights?: Readonly<Record<string, unknown>>;
  readonly default_language?: unknown;
  readonly language_override?: unknown;
  readonly textIndexVersion?: unknown;
}

const EXPECTED_TEXT_INDEX_NAME = 'biomarker_public_text_v1';
const LEGACY_TEXT_INDEX_NAME = 'displayName_text_key_text';
const DOMAIN_INDEX_NAME = 'biomarker_public_domain_v1';
const EXPECTED_DOMAIN_INDEX_KEY: MeasurementIndexSpecification = {
  status: 1,
  'definition.domainKeys': 1,
  key: 1,
  revision: -1,
};
const LEGACY_DOMAIN_INDEX_KEY: MeasurementIndexSpecification = {
  status: 1,
  'definition.domainKeys': 1,
  displayName: 1,
  revision: -1,
};
const EXPECTED_TEXT_WEIGHTS: Readonly<Record<string, number>> = {
  displayName: 10,
  key: 8,
  'definition.aliases': 6,
};
const LEGACY_TEXT_WEIGHTS: Readonly<Record<string, number>> = { displayName: 1, key: 1 };

function sortedTextFields(index: MeasurementIndexDescription): readonly string[] {
  if (index.weights && Object.keys(index.weights).length > 0) {
    return Object.keys(index.weights).sort();
  }
  return Object.entries(index.key ?? {})
    .filter(([, value]) => value === 'text')
    .map(([field]) => field)
    .sort();
}

function sameFields(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((field, index) => field === right[index]);
}

function sameIndexKey(
  actual: Readonly<Record<string, unknown>> | undefined,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  if (!actual) return false;
  const actualEntries = Object.entries(actual);
  const expectedEntries = Object.entries(expected);
  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(
      ([field, direction], index) =>
        field === expectedEntries[index]?.[0] && direction === expectedEntries[index]?.[1],
    )
  );
}

export type MeasurementDomainIndexDisposition =
  | { readonly kind: 'missing' }
  | { readonly kind: 'expected'; readonly name: string }
  | { readonly kind: 'legacy'; readonly name: string }
  | { readonly kind: 'unexpected'; readonly name: string };

export function classifyMeasurementDomainIndex(
  indexes: readonly MeasurementIndexDescription[],
): MeasurementDomainIndexDisposition {
  const index = indexes.find((candidate) => candidate.name === DOMAIN_INDEX_NAME);
  if (!index) return { kind: 'missing' };
  if (sameIndexKey(index.key, EXPECTED_DOMAIN_INDEX_KEY))
    return { kind: 'expected', name: DOMAIN_INDEX_NAME };
  if (sameIndexKey(index.key, LEGACY_DOMAIN_INDEX_KEY))
    return { kind: 'legacy', name: DOMAIN_INDEX_NAME };
  return { kind: 'unexpected', name: DOMAIN_INDEX_NAME };
}

function sameWeights(
  actual: Readonly<Record<string, unknown>> | undefined,
  expected: Readonly<Record<string, number>>,
): boolean {
  if (!actual) return false;
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(
      ([field, weight], index) =>
        field === expectedEntries[index]?.[0] && weight === expectedEntries[index]?.[1],
    )
  );
}

function hasStandardTextOptions(index: MeasurementIndexDescription): boolean {
  return (
    index.default_language === 'english' &&
    index.language_override === 'language' &&
    index.textIndexVersion === 3
  );
}

/**
 * Classify the collection's single allowed text index without mutating it.
 * MongoDB reports text fields through `weights` (and `_fts` through `key`),
 * while unit-test/index-declaration shapes may report the fields in `key`.
 */
export function classifyMeasurementTextIndexes(
  indexes: readonly MeasurementIndexDescription[],
): MeasurementTextIndexDisposition {
  const textIndexes = indexes.filter((index) => {
    const fields = sortedTextFields(index);
    return fields.length > 0 || Object.values(index.key ?? {}).includes('text');
  });
  if (textIndexes.length === 0) return { kind: 'missing' };
  if (textIndexes.length !== 1) {
    return {
      kind: 'unexpected',
      descriptions: textIndexes.map(
        (index) => `${index.name ?? '<unnamed>'}:${sortedTextFields(index).join(',')}`,
      ),
    };
  }

  const index = textIndexes[0];
  if (!index) return { kind: 'missing' };
  const name = index.name ?? '<unnamed>';
  const fields = sortedTextFields(index);
  if (
    sameFields(fields, [...EXPECTED_TEXT_FIELDS]) &&
    name === EXPECTED_TEXT_INDEX_NAME &&
    sameWeights(index.weights, EXPECTED_TEXT_WEIGHTS) &&
    hasStandardTextOptions(index)
  )
    return { kind: 'expected', name };
  if (
    sameFields(fields, [...LEGACY_TEXT_FIELDS]) &&
    name === LEGACY_TEXT_INDEX_NAME &&
    sameWeights(index.weights, LEGACY_TEXT_WEIGHTS) &&
    hasStandardTextOptions(index)
  )
    return { kind: 'legacy', name };
  return { kind: 'unexpected', descriptions: [`${name}:${fields.join(',')}`] };
}

type MeasurementIndexSpecification = Record<string, 1 | -1 | 'text'>;
interface MeasurementCreateIndexOptions {
  readonly name: string;
  readonly unique?: boolean;
  readonly weights?: Readonly<Record<string, number>>;
  readonly default_language?: string;
  readonly language_override?: string;
}

const REQUIRED_NON_TEXT_INDEXES: readonly {
  readonly key: MeasurementIndexSpecification;
  readonly options: MeasurementCreateIndexOptions;
}[] = [
  { key: { key: 1, revision: 1 }, options: { name: 'key_1_revision_1', unique: true } },
  { key: { key: 1, status: 1 }, options: { name: 'key_1_status_1' } },
  {
    key: { status: 1, key: 1, revision: -1 },
    options: { name: 'biomarker_public_latest_v1' },
  },
  {
    key: { status: 1, 'definition.domainKeys': 1, key: 1, revision: -1 },
    options: { name: 'biomarker_public_domain_v1' },
  },
];

const EXPECTED_TEXT_INDEX: {
  readonly key: MeasurementIndexSpecification;
  readonly options: MeasurementCreateIndexOptions;
} = {
  key: { displayName: 'text', key: 'text', 'definition.aliases': 'text' },
  options: {
    name: 'biomarker_public_text_v1',
    weights: { displayName: 10, key: 8, 'definition.aliases': 6 },
    default_language: 'english',
    language_override: 'language',
  },
};

/**
 * Ensure P6 lookup indexes without broad `syncIndexes()` behavior. The only
 * index this function may drop is the exact pre-P6 displayName/key text index.
 * Any other competing text index is a deployment error requiring inspection.
 */
export async function ensureMeasurementRevisionIndexes(): Promise<void> {
  await MeasurementRevisionModel.createCollection();
  const collection = MeasurementRevisionModel.collection;
  const initialIndexes = (await collection.indexes()) as MeasurementIndexDescription[];
  const initial = classifyMeasurementTextIndexes(initialIndexes);
  if (initial.kind === 'unexpected') {
    throw new Error(
      `Unexpected biomarker text index; refusing automatic replacement: ${initial.descriptions.join('; ')}`,
    );
  }

  const domainIndex = classifyMeasurementDomainIndex(initialIndexes);
  if (domainIndex.kind === 'unexpected') {
    throw new Error(`Unexpected ${DOMAIN_INDEX_NAME} key; refusing automatic replacement.`);
  }
  if (domainIndex.kind === 'legacy') {
    await collection.dropIndex(domainIndex.name);
  }

  for (const index of REQUIRED_NON_TEXT_INDEXES) {
    await collection.createIndex(index.key, index.options);
  }

  if (initial.kind === 'expected') return;
  if (initial.kind === 'legacy') {
    if (initial.name === '<unnamed>') {
      throw new Error(
        'The known legacy biomarker text index has no name and cannot be replaced safely.',
      );
    }
    try {
      await collection.dropIndex(initial.name);
    } catch (error) {
      const code = (error as { readonly code?: number }).code;
      if (code !== 27) throw error;
      const concurrent = classifyMeasurementTextIndexes(
        (await collection.indexes()) as MeasurementIndexDescription[],
      );
      if (concurrent.kind === 'unexpected') {
        throw new Error(
          `Unexpected biomarker text index after concurrent migration: ${concurrent.descriptions.join('; ')}`,
        );
      }
      if (concurrent.kind === 'expected') return;
    }
  }

  await collection.createIndex(EXPECTED_TEXT_INDEX.key, EXPECTED_TEXT_INDEX.options);
}
