export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function jsonRecord(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

export function jsonArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function jsonRecordArray(value: unknown): readonly JsonRecord[] {
  return jsonArray(value).filter(isJsonRecord);
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function setJsonField(value: JsonRecord, key: string, next: unknown): JsonRecord {
  if (next === undefined) {
    const output = { ...value };
    delete output[key];
    return output;
  }
  return { ...value, [key]: next };
}

export function replaceArrayItem(
  value: readonly unknown[],
  index: number,
  next: unknown,
): readonly unknown[] {
  return value.map((item, itemIndex) => (itemIndex === index ? next : item));
}

export function removeArrayItem(value: readonly unknown[], index: number): readonly unknown[] {
  return value.filter((_item, itemIndex) => itemIndex !== index);
}

export function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function approvedUnitChoices(definition: JsonRecord, canonical: string): readonly JsonRecord[] {
  const acceptedCodes = new Set(
    jsonRecordArray(definition.acceptedUnits)
      .map((unit) => nonEmptyString(unit.code))
      .filter((code): code is string => Boolean(code)),
  );
  return jsonRecordArray(definition.conversions)
    .filter((conversion) => conversion.kind === 'affine')
    .filter((conversion) => nonEmptyString(conversion.toUnit) === canonical)
    .flatMap((conversion) => {
      const code = nonEmptyString(conversion.fromUnit);
      const factor = finiteNumber(conversion.factor);
      const offset = finiteNumber(conversion.offset);
      if (
        !code ||
        code === canonical ||
        !acceptedCodes.has(code) ||
        factor === undefined ||
        factor <= 0
      )
        return [];
      return [{ code, factor, offset: offset ?? 0 }];
    });
}

function safeBounds(definition: JsonRecord): JsonRecord | undefined {
  const bounds = jsonRecord(definition.inputBounds);
  const hard = jsonRecord(bounds.hard);
  const soft = jsonRecord(bounds.soft);
  let validation: JsonRecord = {};
  const hardMin = finiteNumber(hard.min);
  const hardMax = finiteNumber(hard.max);
  const softMin = finiteNumber(soft.min);
  const softMax = finiteNumber(soft.max);

  // Calculator v1 bounds are inclusive. An exclusive library bound cannot be
  // represented faithfully, so it is intentionally not copied.
  if (hardMin !== undefined && hard.minInclusive !== false)
    validation = setJsonField(validation, 'min', hardMin);
  if (hardMax !== undefined && hard.maxInclusive !== false)
    validation = setJsonField(validation, 'max', hardMax);
  if (softMin !== undefined && soft.minInclusive !== false)
    validation = setJsonField(validation, 'softMin', softMin);
  if (softMax !== undefined && soft.maxInclusive !== false)
    validation = setJsonField(validation, 'softMax', softMax);
  if (bounds.integerOnly === true) validation = setJsonField(validation, 'integer', true);
  return Object.keys(validation).length ? validation : undefined;
}

/**
 * Copies only reviewed canonical authoring hints from a measurement envelope.
 * Reference ranges, scoring rules and migration provenance are deliberately
 * unreachable from this function.
 */
export function prefillParameterFromBiomarker(
  parameter: JsonRecord,
  biomarker: JsonRecord,
): JsonRecord {
  const definition = jsonRecord(biomarker.definition);
  const key = nonEmptyString(biomarker.key) ?? nonEmptyString(definition.key);
  const displayName =
    nonEmptyString(biomarker.displayName) ?? nonEmptyString(definition.displayName);
  const canonicalUnit =
    nonEmptyString(jsonRecord(definition.canonicalUnit).code) ??
    nonEmptyString(biomarker.canonicalUnit);
  const descriptions = jsonRecord(definition.description);
  const helpText = [
    nonEmptyString(descriptions.whatItMeasures),
    nonEmptyString(descriptions.whyItMatters),
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, all) => all.indexOf(item) === index)
    .join(' ');

  let output = { ...parameter };
  if (key) {
    output = setJsonField(output, 'biomarkerKey', key);
    if (!nonEmptyString(output.key)) output = setJsonField(output, 'key', key);
  }
  if (displayName) output = setJsonField(output, 'label', displayName);
  if (canonicalUnit) {
    const existingUnit = jsonRecord(output.unit);
    const allowed = approvedUnitChoices(definition, canonicalUnit);
    output = setJsonField(output, 'unit', {
      ...existingUnit,
      canonical: canonicalUnit,
      ...(allowed.length ? { allowed } : { allowed: undefined }),
    });
    const nextUnit = jsonRecord(output.unit);
    if (nextUnit.allowed === undefined) {
      const cleanUnit = { ...nextUnit };
      delete cleanUnit.allowed;
      output = setJsonField(output, 'unit', cleanUnit);
    }
  }
  const bounds = safeBounds(definition);
  if (bounds)
    output = setJsonField(output, 'validation', { ...jsonRecord(output.validation), ...bounds });
  if (helpText) output = setJsonField(output, 'helpText', helpText);
  return output;
}

export interface DomainWeightSummary {
  readonly total: number;
  readonly percent: number;
  readonly exact: boolean;
}

export function summarizeDomainWeights(domains: readonly JsonRecord[]): DomainWeightSummary {
  const total = domains.reduce((sum, domain) => sum + (finiteNumber(domain.weight) ?? 0), 0);
  return { total, percent: total * 100, exact: total === 1 };
}

export interface DomainAssignmentSummary {
  readonly unassigned: readonly string[];
  readonly multiplyAssigned: readonly string[];
}

export function summarizeDomainAssignments(
  parameters: readonly JsonRecord[],
  domains: readonly JsonRecord[],
): DomainAssignmentSummary {
  const counts = new Map<string, number>();
  for (const domain of domains) {
    for (const key of jsonArray(domain.parameterKeys)) {
      if (typeof key === 'string') counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const keys = parameters
    .map((parameter) => nonEmptyString(parameter.key))
    .filter((key): key is string => Boolean(key));
  return {
    unassigned: keys.filter((key) => !counts.has(key)),
    multiplyAssigned: keys.filter((key) => (counts.get(key) ?? 0) > 1),
  };
}

export interface CategoryCoverageSummary {
  readonly gaps: readonly string[];
  readonly overlaps: readonly string[];
  readonly complete: boolean;
}

export type BandEdges = 'min-inclusive' | 'explicit';

export function normalizeBandEdges(value: unknown): BandEdges {
  return value === 'explicit' ? 'explicit' : 'min-inclusive';
}

/** Resolve the effective P0A boundary semantics, including a true per-bound override. */
export function bandBoundaryInclusive(
  band: JsonRecord,
  side: 'min' | 'max',
  bandEdges: unknown,
): boolean {
  if (band[`${side}Exclusive`] === true) return false;
  if (band[`${side}Inclusive`] === true) return true;
  return normalizeBandEdges(bandEdges) === 'min-inclusive' && side === 'min';
}

type NormalizedBand = {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly minInclusive: boolean;
  readonly maxInclusive: boolean;
};

export function summarizeCategoryCoverage(
  scale: JsonRecord,
  bands: readonly JsonRecord[],
  bandEdges: unknown = 'min-inclusive',
): CategoryCoverageSummary {
  const scaleMin = finiteNumber(scale.min);
  const scaleMax = finiteNumber(scale.max);
  if (scaleMin === undefined || scaleMax === undefined || scaleMin > scaleMax)
    return { gaps: ['A finite valid scale is required.'], overlaps: [], complete: false };
  const normalized: NormalizedBand[] = bands
    .flatMap((band, index) => {
      const authoredMin = finiteNumber(band.min);
      const authoredMax = finiteNumber(band.max);
      const min = authoredMin ?? scaleMin;
      const max = authoredMax ?? scaleMax;
      if (min > max) return [];
      return [
        {
          label: nonEmptyString(band.label) ?? `Band ${index + 1}`,
          min,
          max,
          minInclusive:
            authoredMin === undefined ? true : bandBoundaryInclusive(band, 'min', bandEdges),
          maxInclusive:
            authoredMax === undefined ? true : bandBoundaryInclusive(band, 'max', bandEdges),
        },
      ];
    })
    .sort((left, right) => left.min - right.min || left.max - right.max);
  const gaps: string[] = [];
  const overlaps: string[] = [];
  if (!normalized.length)
    return { gaps: ['No category bands are defined.'], overlaps, complete: false };
  const first = normalized[0];
  const last = normalized.at(-1);
  if (first && (first.min > scaleMin || (first.min === scaleMin && !first.minInclusive)))
    gaps.push(`Scale start ${scaleMin} is not covered.`);
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (!previous || !current) continue;
    if (current.min > previous.max) gaps.push(`${previous.label} to ${current.label} has a gap.`);
    else if (current.min < previous.max)
      overlaps.push(`${previous.label} and ${current.label} overlap.`);
    else if (!previous.maxInclusive && !current.minInclusive)
      gaps.push(`${previous.label} to ${current.label} excludes ${current.min}.`);
    else if (previous.maxInclusive && current.minInclusive)
      overlaps.push(`${previous.label} and ${current.label} both include ${current.min}.`);
  }
  if (last && (last.max < scaleMax || (last.max === scaleMax && !last.maxInclusive)))
    gaps.push(`Scale end ${scaleMax} is not covered.`);
  return { gaps, overlaps, complete: gaps.length === 0 && overlaps.length === 0 };
}

export function parseJsonEditor(text: string): {
  readonly value?: unknown;
  readonly error?: string;
} {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}
