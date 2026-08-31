import type { NiroMeasurementDefinitionV1 } from './generated/measurement-definition.v1';

export const CORE_MEASUREMENT_SOURCE_PATH =
  'data/fixtures/config-samples/biomarker-dataset.json' as const;
export const CORE_SCORING_CONFIG_PATH =
  'data/fixtures/config-samples/niro-cws.config.json' as const;
export const CORE_SCORING_RESEARCH_PATH = 'docs/research/niro-risk-logic-extraction.md' as const;
export const CORE_MEASUREMENT_SEED_SCHEMA_VERSION = 'core-measurement-seed.v1' as const;

const REQUIRED_PUBLISH_BLOCKERS = [
  'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1',
  'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2',
  'P6-PER-VALUE-SOURCE-MAPPING-REQUIRED',
  'P6-UNIT-CONVERSION-REVIEW-REQUIRED',
  'P6-RANGE-INCLUSIVITY-REVIEW-REQUIRED',
  'P6-INPUT-BOUND-HARD-SOFT-REVIEW-REQUIRED',
  'P6-REFERENCE-RANGE-STRUCTURING-REQUIRED',
  'P6-MEDICAL-REVIEW-REQUIRED',
] as const;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface CoreMeasurementConfigInput {
  readonly path: string;
  readonly value: JsonObject;
}

export interface CoreMeasurementConfigUsage {
  readonly configPath: string;
  readonly calculatorSlug: string;
  readonly calculatorVersion: number | null;
  readonly parameterKey: string | null;
  readonly pointer: string;
  readonly measurementKey: string;
}

export interface CoreMeasurementValueTag {
  readonly pointer: string;
  readonly kind: 'number' | 'formula' | 'numeric-text';
  readonly value: number | string;
  readonly valueTagId: string;
  readonly candidateSourceIds: readonly string[];
  readonly mappingStatus: 'unresolved-per-value-authority';
}

export interface CoreMeasurementSeedRecord {
  readonly definition: NiroMeasurementDefinitionV1;
  readonly provenance: {
    readonly sourcePath: typeof CORE_MEASUREMENT_SOURCE_PATH;
    readonly sourcePointer: string;
    readonly legacyIndex: number;
    readonly legacyRecord: JsonObject;
    readonly legacyNiroScoring: JsonValue | null;
    readonly correctedScoringProvenance: {
      readonly path: typeof CORE_SCORING_CONFIG_PATH;
      readonly researchPath: typeof CORE_SCORING_RESEARCH_PATH;
      readonly calculatorSlug: 'niro-cws';
      readonly calculatorVersion: 2;
      readonly role: 'calculator-scoring-only-not-measurement-reference-range';
    };
    readonly revisionHistory: {
      readonly supersededRevisions: readonly [
        {
          readonly revision: 1;
          readonly disposition: 'audit-rejected-draft';
          readonly reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1';
          readonly issue: 'inferred-canonical-claims-and-unreviewed-unit-conversions';
        },
        {
          readonly revision: 2;
          readonly disposition: 'audit-rejected-draft';
          readonly reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2';
          readonly issue: 'empty-object-persistence-loss';
        },
      ];
      readonly note: string;
    };
    readonly configUsage: readonly CoreMeasurementConfigUsage[];
    readonly valueTags: readonly CoreMeasurementValueTag[];
    readonly conflictText: string | null;
    readonly needsClarificationNotes: readonly string[];
  };
}

export interface CoreMeasurementSeed {
  readonly schemaVersion: typeof CORE_MEASUREMENT_SEED_SCHEMA_VERSION;
  readonly generatedFrom: {
    readonly path: typeof CORE_MEASUREMENT_SOURCE_PATH;
    readonly sha256: string;
    readonly generatedAt: string | null;
  };
  readonly migrationPolicy: {
    readonly recordCount: 40;
    readonly originalSourceObjectCount: 117;
    readonly calculatorConfigCount: 5;
    readonly calculatorMeasurementReferenceCount: 45;
    readonly lifecycle: 'draft-only';
    readonly catalogExtensionImported: false;
    readonly note: string;
  };
  readonly scoringProvenance: {
    readonly staleLegacyNote: string;
    readonly correctedSource: {
      readonly path: typeof CORE_SCORING_CONFIG_PATH;
      readonly researchPath: typeof CORE_SCORING_RESEARCH_PATH;
      readonly calculatorSlug: 'niro-cws';
      readonly calculatorVersion: 2;
      readonly note: string;
    };
  };
  readonly records: readonly CoreMeasurementSeedRecord[];
}

export interface CoreMeasurementSeedFinding {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface CoreMeasurementSeedValidation {
  readonly valid: boolean;
  readonly findings: readonly CoreMeasurementSeedFinding[];
  readonly counts: {
    readonly records: number;
    readonly originalSources: number;
    readonly configReferences: number;
    readonly valueTags: number;
    readonly rawConversions: number;
    readonly canonicalConversions: number;
    readonly canonicalClaimLinks: number;
  };
}

function isObject(value: JsonValue | unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asFiniteNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function slug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (normalized || 'source').slice(0, 100).replace(/-+$/g, '');
}

function normalizeUnitCode(value: string): string {
  return value.normalize('NFC');
}

function unitDimension(code: string): NiroMeasurementDefinitionV1['canonicalUnit']['dimension'] {
  const normalized = code.normalize('NFC').toLowerCase();
  if (normalized === '%' || normalized === 'ratio') return 'dimensionless';
  if (normalized === 'mmhg') return 'pressure';
  if (normalized === 'fl') return 'volume';
  if (normalized === 'mm/hr' || normalized.includes('/min/')) return 'rate';
  if (normalized.includes('10⁹/l') || normalized.includes('cells/µl') || normalized === '/µl') {
    return 'count-concentration';
  }
  if (normalized === 'u/l') return 'enzyme-activity-concentration';
  if (/^(m|µ|n|p)?mol\//u.test(normalized)) return 'substance-concentration';
  if (normalized.includes('iu/') || normalized.includes('u/ml')) {
    return 'substance-concentration';
  }
  if (/^(g|mg|µg|ng|pg)\//u.test(normalized)) return 'mass-concentration';
  return 'dimensionless';
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function collectNeedsClarification(record: JsonObject): string[] {
  const notes: string[] = [];
  const reference = record.referenceExternal;
  if (isObject(reference) && reference.status === 'needs-clarification') {
    notes.push(asString(reference.note) ?? 'Legacy referenceExternal status needs clarification.');
  }
  const sources = Array.isArray(record.sources) ? record.sources : [];
  for (const source of sources) {
    if (!isObject(source) || source.type !== 'needs-clarification') continue;
    notes.push(asString(source.note) ?? 'Legacy source is marked needs-clarification.');
  }
  return uniqueStrings(notes);
}

function collectValueTags(
  recordKey: string,
  record: JsonObject,
  candidateSourceIds: readonly string[],
): CoreMeasurementValueTag[] {
  const tags: CoreMeasurementValueTag[] = [];
  const visit = (value: JsonValue, pointer: string, propertyName: string | undefined): void => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      tags.push({
        pointer,
        kind: 'number',
        value,
        valueTagId: `${recordKey}-legacy-value-${String(tags.length + 1).padStart(3, '0')}`,
        candidateSourceIds,
        mappingStatus: 'unresolved-per-value-authority',
      });
      return;
    }
    if (typeof value === 'string') {
      const formula = propertyName !== undefined && /(formula|expression)$/i.test(propertyName);
      if (formula || /\d/u.test(value)) {
        tags.push({
          pointer,
          kind: formula ? 'formula' : 'numeric-text',
          value,
          valueTagId: `${recordKey}-legacy-value-${String(tags.length + 1).padStart(3, '0')}`,
          candidateSourceIds,
          mappingStatus: 'unresolved-per-value-authority',
        });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pointer}/${index}`, String(index)));
      return;
    }
    if (isObject(value)) {
      for (const key of Object.keys(value).sort()) {
        visit(value[key]!, `${pointer}/${pointerSegment(key)}`, key);
      }
    }
  };
  visit(record, '', undefined);
  return tags;
}

function configIdentity(
  config: JsonObject,
  path: string,
): {
  calculatorSlug: string;
  calculatorVersion: number | null;
} {
  return {
    calculatorSlug: asString(config.calculatorSlug) ?? slug(path.replace(/\.config\.json$/i, '')),
    calculatorVersion: asFiniteNumber(config.version) ?? null,
  };
}

export function collectCoreMeasurementConfigUsage(
  inputs: readonly CoreMeasurementConfigInput[],
): CoreMeasurementConfigUsage[] {
  const usages: CoreMeasurementConfigUsage[] = [];
  for (const input of [...inputs].sort((a, b) => a.path.localeCompare(b.path))) {
    const identity = configIdentity(input.value, input.path);
    const visit = (value: JsonValue, pointer: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${pointer}/${index}`));
        return;
      }
      if (!isObject(value)) return;
      const measurementKey = asString(value.biomarkerKey);
      if (measurementKey) {
        usages.push({
          configPath: input.path,
          calculatorSlug: identity.calculatorSlug,
          calculatorVersion: identity.calculatorVersion,
          parameterKey: asString(value.key) ?? null,
          pointer,
          measurementKey,
        });
      }
      for (const key of Object.keys(value).sort()) {
        visit(value[key]!, `${pointer}/${pointerSegment(key)}`);
      }
    };
    visit(input.value, '');
  }
  return usages.sort(
    (a, b) => a.configPath.localeCompare(b.configPath) || a.pointer.localeCompare(b.pointer),
  );
}

function transformSources(
  recordKey: string,
  record: JsonObject,
): NiroMeasurementDefinitionV1['sources'] {
  const legacySources = Array.isArray(record.sources) ? record.sources : [];
  const transformed = legacySources.map((raw, index) => {
    const source = isObject(raw) ? raw : {};
    const legacyType = asString(source.type);
    const id = `${recordKey}-source-${String(index + 1).padStart(2, '0')}`;
    const url = asString(source.url);
    const ref = asString(source.ref);
    const note = asString(source.note);
    const title =
      asString(source.title) ??
      (legacyType === 'niro' && ref ? `Niro source: ${ref}` : undefined) ??
      (legacyType === 'needs-clarification'
        ? 'Legacy needs-clarification source note'
        : `Legacy source ${index + 1}`);
    return {
      id,
      type:
        legacyType === 'external'
          ? ('external' as const)
          : legacyType === 'niro'
            ? ('niro' as const)
            : ('internal' as const),
      ...(asString(source.org) ? { org: asString(source.org)! } : {}),
      title,
      ...(url ? { url } : {}),
      ...(!url
        ? {
            ref: ref ?? `${CORE_MEASUREMENT_SOURCE_PATH}#/biomarkers/${recordKey}/sources/${index}`,
          }
        : ref
          ? { ref }
          : {}),
      ...(asString(source.accessed) ? { accessed: asString(source.accessed)! } : {}),
      verification:
        legacyType === 'niro' ? ('source-provided' as const) : ('needs-verification' as const),
      ...(note ? { note } : {}),
    };
  });
  if (transformed.length === 0) {
    throw new Error(`Core measurement ${recordKey} has no legacy source objects.`);
  }
  return transformed as NiroMeasurementDefinitionV1['sources'];
}

function nonrestrictiveDraftBounds(): NiroMeasurementDefinitionV1['inputBounds'] {
  return {
    hard: {
      min: Number.MIN_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
      minInclusive: true,
      maxInclusive: true,
    },
    note: 'Schema-required non-restrictive engineering interval. Exact legacy validation values remain only in migration provenance until hard-versus-soft classification is reviewed.',
  };
}

function transformDefinition(record: JsonObject, recordIndex: number): NiroMeasurementDefinitionV1 {
  const key = asString(record.key);
  const displayName = asString(record.displayName);
  const domain = asString(record.domain);
  const unit = isObject(record.unit) ? record.unit : {};
  const canonicalCode = asString(unit.canonical);
  if (!key || !displayName || !domain || !canonicalCode) {
    throw new Error(
      `Legacy core record ${recordIndex} is missing key/displayName/domain/unit.canonical.`,
    );
  }

  const sources = transformSources(key, record);
  const canonicalUnit = {
    code: normalizeUnitCode(canonicalCode),
    dimension: unitDimension(canonicalCode),
    display: normalizeUnitCode(canonicalCode),
  };

  const reference = isObject(record.referenceExternal) ? record.referenceExternal : {};
  const conflictText = asString(reference.conflict);
  const needsClarification = collectNeedsClarification(record);
  const conflictIds = [
    ...(conflictText ? [`${key}-legacy-conflict`] : []),
    ...(needsClarification.length > 0 ? [`${key}-needs-clarification`] : []),
  ];
  const aliases = Array.isArray(record.altNames)
    ? uniqueStrings(record.altNames.filter((item): item is string => typeof item === 'string'))
    : [];
  const derived = isObject(record.derived) ? record.derived : undefined;
  const expression = derived
    ? (asString(derived.formula) ?? asString(derived.expression))
    : undefined;
  const dependsOn =
    derived && Array.isArray(derived.dependsOn)
      ? derived.dependsOn.filter((item): item is string => typeof item === 'string')
      : [];
  const isDerived = asString(record.inputType) === 'derived' || expression !== undefined;

  return {
    schemaVersion: 'measurement-definition.v1',
    key,
    version: 3,
    status: 'draft',
    displayName,
    ...(aliases.length > 0 ? { aliases } : {}),
    kind: isDerived
      ? 'derived-measurement'
      : key === 'systolic-bp'
        ? 'vital'
        : 'laboratory-biomarker',
    panels: [slug(domain)],
    domainKeys: [slug(domain)],
    valueType: 'number',
    canonicalUnit,
    acceptedUnits: [canonicalUnit],
    inputBounds: nonrestrictiveDraftBounds(),
    referenceRanges: [],
    ...(isDerived
      ? {
          derived: {
            expression: expression ?? '0',
            dependsOn: dependsOn as [string, ...string[]],
            semanticVersion: '1.0.0',
          },
        }
      : {}),
    description: {
      ...(asString(record.whatItMeasures)
        ? { whatItMeasures: asString(record.whatItMeasures)! }
        : {}),
      ...(asString(record.whyItMatters) ? { whyItMatters: asString(record.whyItMatters)! } : {}),
      limitations:
        'Reference ranges and legacy unit conversions remain in source-preserving migration provenance until claim mapping, dimensional compatibility, context, and boundary inclusivity are reviewed.',
    },
    sources,
    governance: {
      reviewStatus: 'unreviewed',
      reviewedAt: null,
      reviewerId: null,
      publishBlockers: [
        ...REQUIRED_PUBLISH_BLOCKERS,
        ...(needsClarification.length > 0 ? ['P6-LEGACY-NEEDS-CLARIFICATION'] : []),
        ...(conflictText ? ['P6-CONFLICT-RANGES-MUST-REMAIN-SEPARATE'] : []),
      ],
      ...(conflictIds.length > 0 ? { conflictIds } : {}),
      legacyRecordRefs: [`${CORE_MEASUREMENT_SOURCE_PATH}#/biomarkers/${recordIndex}`],
    },
  };
}

export function migrateCoreMeasurementSeed(
  legacyDataset: JsonObject,
  configInputs: readonly CoreMeasurementConfigInput[],
  sourceSha256: string,
): CoreMeasurementSeed {
  const biomarkers = Array.isArray(legacyDataset.biomarkers) ? legacyDataset.biomarkers : [];
  if (biomarkers.length !== 40 || biomarkers.some((record) => !isObject(record))) {
    throw new Error('The core dataset must contain exactly 40 object records in biomarkers[].');
  }
  if (configInputs.length !== 5)
    throw new Error('Exactly five calculator configuration inputs are required.');
  if (!/^[a-f0-9]{64}$/u.test(sourceSha256))
    throw new Error('sourceSha256 must be lowercase SHA-256 hex.');

  const usages = collectCoreMeasurementConfigUsage(configInputs);
  if (usages.length !== 45) {
    throw new Error(
      `Expected exactly 45 calculator biomarkerKey references; found ${usages.length}.`,
    );
  }
  const legend = isObject(legacyDataset.legend) ? legacyDataset.legend : {};
  const staleLegacyNote = asString(legend.niroScoringNote);
  if (!staleLegacyNote)
    throw new Error('The legacy global niroScoringNote is required for provenance.');

  const records = (biomarkers as JsonObject[])
    .map((legacyRecord, legacyIndex): CoreMeasurementSeedRecord => {
      const definition = transformDefinition(legacyRecord, legacyIndex);
      const sourceIds = definition.sources.map((source) => source.id);
      const reference = isObject(legacyRecord.referenceExternal)
        ? legacyRecord.referenceExternal
        : {};
      return {
        definition,
        provenance: {
          sourcePath: CORE_MEASUREMENT_SOURCE_PATH,
          sourcePointer: `/biomarkers/${legacyIndex}`,
          legacyIndex,
          legacyRecord: cloneJson(legacyRecord),
          legacyNiroScoring: cloneJson(legacyRecord.niroScoring ?? null),
          correctedScoringProvenance: {
            path: CORE_SCORING_CONFIG_PATH,
            researchPath: CORE_SCORING_RESEARCH_PATH,
            calculatorSlug: 'niro-cws',
            calculatorVersion: 2,
            role: 'calculator-scoring-only-not-measurement-reference-range',
          },
          revisionHistory: {
            supersededRevisions: [
              {
                revision: 1,
                disposition: 'audit-rejected-draft',
                reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1',
                issue: 'inferred-canonical-claims-and-unreviewed-unit-conversions',
              },
              {
                revision: 2,
                disposition: 'audit-rejected-draft',
                reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2',
                issue: 'empty-object-persistence-loss',
              },
            ],
            note: 'Revision 3 preserves the complete legacy JSON payload, including empty objects, while keeping unreviewed alternate-unit conversions and per-value authority links out of canonical fields. Audit-rejected draft revisions 1 and 2 remain immutable migration history. This correction does not change any legacy clinical value, formula, factor, conversion, or bound.',
          },
          configUsage: usages.filter((usage) => usage.measurementKey === definition.key),
          valueTags: collectValueTags(definition.key, legacyRecord, sourceIds),
          conflictText: asString(reference.conflict) ?? null,
          needsClarificationNotes: collectNeedsClarification(legacyRecord),
        },
      };
    })
    .sort((a, b) => a.definition.key.localeCompare(b.definition.key));

  return {
    schemaVersion: CORE_MEASUREMENT_SEED_SCHEMA_VERSION,
    generatedFrom: {
      path: CORE_MEASUREMENT_SOURCE_PATH,
      sha256: sourceSha256,
      generatedAt: asString(legacyDataset.generatedAt) ?? null,
    },
    migrationPolicy: {
      recordCount: 40,
      originalSourceObjectCount: 117,
      calculatorConfigCount: 5,
      calculatorMeasurementReferenceCount: 45,
      lifecycle: 'draft-only',
      catalogExtensionImported: false,
      note: 'Only the 40-record core fixture is migrated as corrected draft revision 3. Audit-rejected draft revisions 1 and 2 remain immutable history. Revision 3 requires lossless empty-object persistence and keeps legacy alternate units, conversion factors, and unresolved per-value authority links provenance-only pending review. The 79-record extension and 62-calculator research catalog remain quarantined.',
    },
    scoringProvenance: {
      staleLegacyNote,
      correctedSource: {
        path: CORE_SCORING_CONFIG_PATH,
        researchPath: CORE_SCORING_RESEARCH_PATH,
        calculatorSlug: 'niro-cws',
        calculatorVersion: 2,
        note: 'The v2 calculator config is the current scoring transcription. Scoring rules remain calculator-version data and are not copied into measurement reference ranges.',
      },
    },
    records,
  };
}

function findCanonicalSourceClaims(definition: NiroMeasurementDefinitionV1): Set<string> {
  return new Set(definition.sources.flatMap((source) => source.claimIds ?? []));
}

function walkStrings(
  value: unknown,
  visit: (value: string, path: string) => void,
  path = '',
): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${path}/${index}`));
    return;
  }
  if (!isObject(value)) return;
  for (const key of Object.keys(value).sort()) {
    walkStrings(value[key], visit, `${path}/${pointerSegment(key)}`);
  }
}

function validateDerivationDag(
  definitions: readonly NiroMeasurementDefinitionV1[],
  add: (code: string, path: string, message: string) => void,
): void {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  for (const definition of definitions) {
    if (!definition.derived) continue;
    for (const dependency of definition.derived.dependsOn) {
      if (!byKey.has(dependency)) {
        add(
          'SEED_DERIVATION_DEPENDENCY',
          `/records/${definition.key}/definition/derived`,
          `Unknown dependency ${dependency}.`,
        );
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) {
      add(
        'SEED_DERIVATION_CYCLE',
        `/records/${key}/definition/derived`,
        'Derived measurement dependency cycle detected.',
      );
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)?.derived?.dependsOn ?? []) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of byKey.keys()) visit(key);
}

export function validateCoreMeasurementSeed(
  seed: CoreMeasurementSeed,
  legacyDataset: JsonObject,
  configInputs: readonly CoreMeasurementConfigInput[],
): CoreMeasurementSeedValidation {
  const findings: CoreMeasurementSeedFinding[] = [];
  const add = (code: string, path: string, message: string): void => {
    findings.push({ code, path, message });
  };
  const legacyBiomarkers = Array.isArray(legacyDataset.biomarkers)
    ? legacyDataset.biomarkers.filter(isObject)
    : [];
  const expectedKeys = new Set(
    legacyBiomarkers.map((record) => asString(record.key)).filter(Boolean),
  );
  const usages = collectCoreMeasurementConfigUsage(configInputs);
  const definitions = seed.records.map((record) => record.definition);

  if (seed.schemaVersion !== CORE_MEASUREMENT_SEED_SCHEMA_VERSION) {
    add('SEED_SCHEMA_VERSION', '/schemaVersion', 'Unexpected seed schemaVersion.');
  }
  if (seed.records.length !== 40)
    add('SEED_RECORD_COUNT', '/records', 'Exactly 40 core records are required.');
  const keys = definitions.map((definition) => definition.key);
  if (new Set(keys).size !== keys.length)
    add('SEED_DUPLICATE_KEY', '/records', 'Measurement keys must be unique.');
  if (keys.some((key) => !expectedKeys.has(key)) || expectedKeys.size !== new Set(keys).size) {
    add(
      'SEED_QUARANTINE_SCOPE',
      '/records',
      'Seed keys must exactly equal the 40 core fixture keys.',
    );
  }
  if (seed.migrationPolicy.catalogExtensionImported !== false) {
    add(
      'SEED_QUARANTINE_FLAG',
      '/migrationPolicy/catalogExtensionImported',
      'Catalog extension import must remain false.',
    );
  }
  if (
    seed.scoringProvenance.correctedSource.path !== CORE_SCORING_CONFIG_PATH ||
    seed.scoringProvenance.correctedSource.researchPath !== CORE_SCORING_RESEARCH_PATH ||
    seed.scoringProvenance.correctedSource.calculatorVersion !== 2
  ) {
    add(
      'SEED_SCORING_PROVENANCE',
      '/scoringProvenance/correctedSource',
      'Shared corrected scoring provenance must identify config v2 and the scoring research extraction.',
    );
  }

  let sourceCount = 0;
  let referenceCount = 0;
  let valueTagCount = 0;
  let rawConversionCount = 0;
  let canonicalConversionCount = 0;
  let canonicalClaimLinkCount = 0;
  for (const [recordIndex, record] of seed.records.entries()) {
    const path = `/records/${recordIndex}`;
    const definition = record.definition;
    const rawSources = Array.isArray(record.provenance.legacyRecord.sources)
      ? record.provenance.legacyRecord.sources
      : [];
    sourceCount += rawSources.length;
    referenceCount += record.provenance.configUsage.length;
    valueTagCount += record.provenance.valueTags.length;

    const expectedLegacyRecord = legacyBiomarkers[record.provenance.legacyIndex];
    if (
      !expectedLegacyRecord ||
      stableJsonStringify(record.provenance.legacyRecord) !==
        stableJsonStringify(expectedLegacyRecord)
    ) {
      add(
        'SEED_LEGACY_RECORD_PRESERVATION',
        `${path}/provenance/legacyRecord`,
        'The complete legacy record must be preserved JSON-value-equivalently in migration provenance.',
      );
    }

    if (definition.status !== 'draft' || definition.governance.reviewStatus !== 'unreviewed') {
      add(
        'SEED_DRAFT_ONLY',
        `${path}/definition`,
        'Seed definitions must remain draft and unreviewed.',
      );
    }
    if (definition.version !== 3) {
      add(
        'SEED_CORRECTED_REVISION',
        `${path}/definition/version`,
        'The lossless corrected migration must use immutable draft revision 3.',
      );
    }
    const supersededRevisions = record.provenance.revisionHistory?.supersededRevisions;
    if (
      !supersededRevisions ||
      stableJsonStringify(supersededRevisions) !==
        stableJsonStringify([
          {
            revision: 1,
            disposition: 'audit-rejected-draft',
            reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1',
            issue: 'inferred-canonical-claims-and-unreviewed-unit-conversions',
          },
          {
            revision: 2,
            disposition: 'audit-rejected-draft',
            reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2',
            issue: 'empty-object-persistence-loss',
          },
        ])
    ) {
      add(
        'SEED_REVISION_HISTORY',
        `${path}/provenance/revisionHistory`,
        'Revision 3 must document immutable audit-rejected draft revisions 1 and 2.',
      );
    }
    if (definition.governance.reviewerId !== null || definition.governance.reviewedAt !== null) {
      add(
        'SEED_REVIEW_IDENTITY',
        `${path}/definition/governance`,
        'Draft seed must not fabricate review identity or time.',
      );
    }
    for (const blocker of REQUIRED_PUBLISH_BLOCKERS) {
      if (!definition.governance.publishBlockers.includes(blocker)) {
        add(
          'SEED_REQUIRED_BLOCKER',
          `${path}/definition/governance/publishBlockers`,
          `Missing ${blocker}.`,
        );
      }
    }
    if (definition.sources.length !== rawSources.length) {
      add(
        'SEED_SOURCE_PRESERVATION',
        `${path}/definition/sources`,
        'Canonical source count must match the preserved legacy source count.',
      );
    }
    if (record.provenance.sourcePath !== CORE_MEASUREMENT_SOURCE_PATH) {
      add('SEED_SOURCE_PATH', `${path}/provenance/sourcePath`, 'Unexpected source path.');
    }
    if (
      record.provenance.correctedScoringProvenance.path !== CORE_SCORING_CONFIG_PATH ||
      record.provenance.correctedScoringProvenance.researchPath !== CORE_SCORING_RESEARCH_PATH ||
      record.provenance.correctedScoringProvenance.calculatorVersion !== 2
    ) {
      add(
        'SEED_SCORING_PROVENANCE',
        `${path}/provenance/correctedScoringProvenance`,
        'Corrected scoring provenance must point to niro-cws.config v2 and its scoring research extraction.',
      );
    }

    const sourceIds = new Set(definition.sources.map((source) => source.id));
    if (sourceIds.size !== definition.sources.length) {
      add(
        'SEED_SOURCE_ID_UNIQUE',
        `${path}/definition/sources`,
        'Source IDs must be unique within a measurement.',
      );
    }
    const expectedTags = collectValueTags(definition.key, record.provenance.legacyRecord, [
      ...sourceIds,
    ]);
    if (stableJsonStringify(expectedTags) !== stableJsonStringify(record.provenance.valueTags)) {
      add(
        'SEED_VALUE_TAG_COVERAGE',
        `${path}/provenance/valueTags`,
        'Every legacy number/formula/numeric text value must have its deterministic unresolved source tag.',
      );
    }
    for (const tag of record.provenance.valueTags) {
      if (
        tag.candidateSourceIds.length === 0 ||
        tag.candidateSourceIds.some((id) => !sourceIds.has(id))
      ) {
        add(
          'SEED_VALUE_TAG_SOURCE',
          `${path}/provenance/valueTags/${tag.valueTagId}`,
          'Value-tag candidate source IDs must resolve.',
        );
      }
    }

    walkStrings(definition, (value, stringPath) => {
      if (value !== value.normalize('NFC')) {
        add(
          'SEED_UNICODE_NFC',
          `${path}/definition${stringPath}`,
          'Canonical definition strings must use Unicode NFC.',
        );
      }
    });

    const accepted = definition.acceptedUnits ?? [];
    const canonicalMatches = accepted.filter((unit) => unit.code === definition.canonicalUnit.code);
    if (
      accepted.length !== 1 ||
      canonicalMatches.length !== 1 ||
      accepted[0]?.dimension !== definition.canonicalUnit.dimension
    ) {
      add(
        'SEED_UNIT_IDENTITY',
        `${path}/definition/acceptedUnits`,
        'Draft acceptedUnits must contain only the canonical unit as its implicit identity route.',
      );
    }
    if ((definition.conversions?.length ?? 0) > 0) {
      add(
        'SEED_UNREVIEWED_CANONICAL_CONVERSION',
        `${path}/definition/conversions`,
        'Legacy alternate-unit conversions must remain provenance-only until dimensional and exact source review.',
      );
    }

    const legacyUnit = isObject(record.provenance.legacyRecord.unit)
      ? record.provenance.legacyRecord.unit
      : {};
    const legacyCanonical = asString(legacyUnit.canonical);
    const legacyConversions = Array.isArray(legacyUnit.conversions) ? legacyUnit.conversions : [];
    rawConversionCount += legacyConversions.length;
    for (const [conversionIndex, rawConversion] of legacyConversions.entries()) {
      const conversionPath = `${path}/provenance/legacyRecord/unit/conversions/${conversionIndex}`;
      if (!isObject(rawConversion)) {
        add(
          'SEED_LEGACY_CONVERSION_SHAPE',
          conversionPath,
          'Every preserved legacy conversion must remain an object.',
        );
        continue;
      }
      const fromUnit = asString(rawConversion.code);
      const factor = asFiniteNumber(rawConversion.toCanonical);
      if (!fromUnit || factor === undefined || factor <= 0) {
        add(
          'SEED_LEGACY_CONVERSION_FINITE',
          conversionPath,
          'A preserved legacy toCanonical factor must be finite and positive.',
        );
        continue;
      }
      if (
        !legacyCanonical ||
        normalizeUnitCode(legacyCanonical) !== definition.canonicalUnit.code ||
        normalizeUnitCode(fromUnit) === definition.canonicalUnit.code
      ) {
        add(
          'SEED_LEGACY_CONVERSION_DIRECTION',
          conversionPath,
          'A legacy alternate-unit factor must be explicitly directional to the preserved canonical unit.',
        );
      }
      for (const sample of [-1000, -1, 0, 1, 1000]) {
        const canonical = sample * factor;
        const inverse = canonical / factor;
        const tolerance = Math.max(1, Math.abs(sample)) * 1e-12;
        if (!Number.isFinite(canonical) || Math.abs(inverse - sample) > tolerance) {
          add(
            'SEED_LEGACY_CONVERSION_ROUND_TRIP',
            conversionPath,
            'Preserved legacy toCanonical factor failed deterministic inverse round-trip.',
          );
          break;
        }
      }
    }
    const sourceClaims = findCanonicalSourceClaims(definition);
    canonicalConversionCount += definition.conversions?.length ?? 0;
    canonicalClaimLinkCount += definition.sources.reduce(
      (count, source) => count + (source.claimIds?.length ?? 0),
      0,
    );
    canonicalClaimLinkCount += (definition.conversions ?? []).reduce(
      (count, conversion) => count + (conversion.sourceClaimIds?.length ?? 0),
      0,
    );
    canonicalClaimLinkCount += definition.referenceRanges.reduce(
      (count, range) => count + range.sourceClaimIds.length,
      0,
    );
    canonicalClaimLinkCount += definition.derived?.sourceClaimIds?.length ?? 0;
    for (const [conversionIndex, conversion] of (definition.conversions ?? []).entries()) {
      if ((conversion.sourceClaimIds?.length ?? 0) > 0) {
        add(
          'SEED_INFERRED_CLAIM_ATTRIBUTION',
          `${path}/definition/conversions/${conversionIndex}`,
          'Draft conversions must not infer canonical source-claim attribution from record-level sources.',
        );
      }
      for (const claimId of conversion.sourceClaimIds ?? []) {
        if (!sourceClaims.has(claimId))
          add(
            'SEED_CLAIM_RESOLUTION',
            `${path}/definition/conversions/${conversionIndex}`,
            `Unknown source claim ${claimId}.`,
          );
      }
    }
    for (const [rangeIndex, range] of definition.referenceRanges.entries()) {
      for (const claimId of range.sourceClaimIds) {
        if (!sourceClaims.has(claimId))
          add(
            'SEED_CLAIM_RESOLUTION',
            `${path}/definition/referenceRanges/${rangeIndex}`,
            `Unknown source claim ${claimId}.`,
          );
      }
    }
    if ((definition.derived?.sourceClaimIds?.length ?? 0) > 0) {
      add(
        'SEED_INFERRED_CLAIM_ATTRIBUTION',
        `${path}/definition/derived`,
        'Draft derived expressions must not infer canonical source-claim attribution from record-level sources.',
      );
    }
    for (const claimId of definition.derived?.sourceClaimIds ?? []) {
      if (!sourceClaims.has(claimId))
        add(
          'SEED_CLAIM_RESOLUTION',
          `${path}/definition/derived`,
          `Unknown source claim ${claimId}.`,
        );
    }
  }

  if (sourceCount !== 117)
    add(
      'SEED_SOURCE_COUNT',
      '/records',
      `Expected 117 preserved source objects; found ${sourceCount}.`,
    );
  if (referenceCount !== 45 || usages.length !== 45)
    add(
      'SEED_CONFIG_REFERENCE_COUNT',
      '/records',
      'Exactly 45 five-config biomarkerKey references must be preserved.',
    );
  if (valueTagCount !== 565)
    add('SEED_VALUE_TAG_COUNT', '/records', `Expected 565 value tags; found ${valueTagCount}.`);
  if (rawConversionCount !== 29)
    add(
      'SEED_RAW_CONVERSION_COUNT',
      '/records',
      `Expected 29 provenance-only raw conversions; found ${rawConversionCount}.`,
    );
  if (canonicalConversionCount !== 0)
    add(
      'SEED_CANONICAL_CONVERSION_COUNT',
      '/records',
      `Expected zero unreviewed canonical conversions; found ${canonicalConversionCount}.`,
    );
  if (canonicalClaimLinkCount !== 0)
    add(
      'SEED_CANONICAL_CLAIM_LINK_COUNT',
      '/records',
      `Expected zero unresolved canonical claim links; found ${canonicalClaimLinkCount}.`,
    );
  const usageKeys = new Set(
    seed.records.flatMap((record) =>
      record.provenance.configUsage.map((usage) => usage.measurementKey),
    ),
  );
  if ([...usageKeys].some((key) => !expectedKeys.has(key)))
    add(
      'SEED_CONFIG_REFERENCE_RESOLUTION',
      '/records',
      'Every config measurement reference must resolve to a core key.',
    );
  validateDerivationDag(definitions, add);
  const eag = definitions.find((definition) => definition.key === 'eag');
  if (!eag?.derived || !eag.derived.dependsOn.includes('hba1c')) {
    add(
      'SEED_EAG_DERIVATION',
      '/records/eag',
      'eAG must remain a derived measurement depending on hba1c.',
    );
  }

  return {
    valid: findings.length === 0,
    findings,
    counts: {
      records: seed.records.length,
      originalSources: sourceCount,
      configReferences: referenceCount,
      valueTags: valueTagCount,
      rawConversions: rawConversionCount,
      canonicalConversions: canonicalConversionCount,
      canonicalClaimLinks: canonicalClaimLinkCount,
    },
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function stableJsonStringify(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}
