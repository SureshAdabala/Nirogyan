import { stableJsonStringify, validateMeasurementDefinitionStructure } from '@niro/contracts';
import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

const VERIFIED_SOURCE_STATES = new Set(['fetch-verified', 'source-provided']);

export const DERIVED_VERIFICATION_UNSUPPORTED_V1 = 'DERIVED_VERIFICATION_UNSUPPORTED_V1';

export interface MeasurementSemanticEligibilityIssue {
  readonly code: 'MEASUREMENT_SEMANTIC_INVALID' | typeof DERIVED_VERIFICATION_UNSUPPORTED_V1;
  readonly message: string;
}

/*
 * This is deliberately a closed registry. A code/dimension pair becomes
 * publishable only after it is added here through the reviewed measurement
 * contract. Unknown pairs fail closed; no dimension is guessed from spelling.
 */
const CONTROLLED_UNIT_DIMENSIONS: Readonly<Record<string, string>> = Object.freeze({
  '%': 'dimensionless',
  ratio: 'dimensionless',
  '×10⁹/L': 'count-concentration',
  fL: 'volume',
  'g/dL': 'mass-concentration',
  'IU/mL': 'substance-concentration',
  'mg/dL': 'mass-concentration',
  'mg/L': 'mass-concentration',
  'mIU/L': 'substance-concentration',
  'mL/min/1.73m²': 'rate',
  'mm/hr': 'rate',
  mmHg: 'pressure',
  'ng/dL': 'mass-concentration',
  'ng/mL': 'mass-concentration',
  'pg/mL': 'mass-concentration',
  'U/L': 'enzyme-activity-concentration',
  'µg/dL': 'mass-concentration',
  'µIU/mL': 'substance-concentration',
  cm: 'length',
  ft: 'length',
  in: 'length',
  kg: 'mass',
  st: 'mass',
  lb: 'mass',
});

const COMPOSITE_ADAPTERS: Readonly<
  Record<
    string,
    {
      readonly toUnit: string;
      readonly dimension: string;
      readonly from: readonly { readonly field: string; readonly unit: string }[];
    }
  >
> = Object.freeze({
  'feet-inches-to-centimetres': {
    toUnit: 'cm',
    dimension: 'length',
    from: [
      { field: 'feet', unit: 'ft' },
      { field: 'inches', unit: 'in' },
    ],
  },
  'stone-pounds-to-kilograms': {
    toUnit: 'kg',
    dimension: 'mass',
    from: [
      { field: 'stone', unit: 'st' },
      { field: 'pounds', unit: 'lb' },
    ],
  },
});

const CANONICAL_KINDS_BY_ENVELOPE_KIND: Readonly<Record<string, ReadonlySet<string>>> = {
  biomarker: new Set(['laboratory-biomarker', 'vital']),
  demographic: new Set(['anthropometric', 'context']),
  lifestyle: new Set(['questionnaire-response', 'context']),
  derived: new Set(['derived-measurement']),
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function owns(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function measurementIntervalIssue(value: unknown, label: string): string | undefined {
  if (!isRecord(value)) return `${label} must be an interval object.`;
  const hasMin = owns(value, 'min');
  const hasMax = owns(value, 'max');
  const hasMinInclusive = owns(value, 'minInclusive');
  const hasMaxInclusive = owns(value, 'maxInclusive');
  if (!hasMin && !hasMax) return `${label} must declare at least one finite bound.`;
  if (hasMin && typeof value.minInclusive !== 'boolean')
    return `${label} must explicitly declare boolean minInclusive when min is present.`;
  if (hasMax && typeof value.maxInclusive !== 'boolean')
    return `${label} must explicitly declare boolean maxInclusive when max is present.`;
  if (!hasMin && hasMinInclusive)
    return `${label} cannot declare minInclusive without a min bound.`;
  if (!hasMax && hasMaxInclusive)
    return `${label} cannot declare maxInclusive without a max bound.`;
  if (hasMin && (typeof value.min !== 'number' || !Number.isFinite(value.min)))
    return `${label} min must be a finite number.`;
  if (hasMax && (typeof value.max !== 'number' || !Number.isFinite(value.max)))
    return `${label} max must be a finite number.`;
  if (hasMin && hasMax) {
    const min = value.min as number;
    const max = value.max as number;
    if (min > max) return `${label} min cannot exceed max.`;
    if (min === max && (value.minInclusive !== true || value.maxInclusive !== true))
      return `${label} cannot be an empty interval at an exclusive equal boundary.`;
  }
  return undefined;
}

function measurementIntervalContainmentIssue(
  hard: JsonRecord,
  soft: JsonRecord,
): string | undefined {
  const hardHasMin = owns(hard, 'min');
  const hardHasMax = owns(hard, 'max');
  const softHasMin = owns(soft, 'min');
  const softHasMax = owns(soft, 'max');
  if (hardHasMin && !softHasMin) return 'Soft input bounds cannot extend below hard input bounds.';
  if (hardHasMax && !softHasMax) return 'Soft input bounds cannot extend above hard input bounds.';
  if (hardHasMin && softHasMin) {
    const hardMin = hard.min as number;
    const softMin = soft.min as number;
    if (
      softMin < hardMin ||
      (softMin === hardMin && soft.minInclusive === true && hard.minInclusive === false)
    )
      return 'Soft input bounds cannot extend below hard input bounds.';
  }
  if (hardHasMax && softHasMax) {
    const hardMax = hard.max as number;
    const softMax = soft.max as number;
    if (
      softMax > hardMax ||
      (softMax === hardMax && soft.maxInclusive === true && hard.maxInclusive === false)
    )
      return 'Soft input bounds cannot extend above hard input bounds.';
  }
  return undefined;
}

function semanticIssue(message: string): MeasurementSemanticEligibilityIssue {
  return { code: 'MEASUREMENT_SEMANTIC_INVALID', message };
}

/**
 * Publish eligibility for the non-derived v1 measurement subset. This is the
 * single semantic gate used both before trusted approval and on every public
 * read. Derived execution/graph verification is intentionally not implemented
 * in v1, so derived records always fail closed with a stable code.
 */
export function nonDerivedMeasurementSemanticEligibilityIssue(
  definition: JsonRecord,
  sources: readonly unknown[],
): MeasurementSemanticEligibilityIssue | undefined {
  if (definition.kind === 'derived-measurement') {
    return {
      code: DERIVED_VERIFICATION_UNSUPPORTED_V1,
      message: 'Derived measurement verification is unsupported by semantic contract v1.',
    };
  }
  if (definition.derived !== undefined) {
    return semanticIssue('Only derived-measurement records may declare derivation metadata.');
  }

  const sourceIds = new Set<string>();
  const sourceClaims = new Set<string>();
  for (const source of sources) {
    if (!isRecord(source)) continue;
    if (typeof source.id === 'string') {
      if (sourceIds.has(source.id))
        return semanticIssue(`Source identifier ${source.id} is duplicated.`);
      sourceIds.add(source.id);
    }
    if (!Array.isArray(source.claimIds)) continue;
    for (const claimId of source.claimIds) {
      if (typeof claimId !== 'string') continue;
      if (sourceClaims.has(claimId))
        return semanticIssue(`Source claim identifier ${claimId} is duplicated.`);
      sourceClaims.add(claimId);
    }
  }
  const linkedClaimsIssue = (value: unknown, label: string): string | undefined => {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some((item) => typeof item !== 'string')
    )
      return `${label} must link at least one source claim.`;
    const unresolved = value.find((item) => !sourceClaims.has(item as string));
    return unresolved === undefined
      ? undefined
      : `${label} references unresolved claim ${unresolved}.`;
  };

  const canonicalUnit = isRecord(definition.canonicalUnit) ? definition.canonicalUnit : undefined;
  const canonicalCode = typeof canonicalUnit?.code === 'string' ? canonicalUnit.code : undefined;
  const canonicalDimension =
    typeof canonicalUnit?.dimension === 'string' ? canonicalUnit.dimension : undefined;
  if (!canonicalCode || !canonicalDimension)
    return semanticIssue('Canonical unit identity is incomplete.');
  if (canonicalCode !== canonicalCode.normalize('NFC'))
    return semanticIssue('Canonical unit code must be Unicode NFC normalized.');
  if (CONTROLLED_UNIT_DIMENSIONS[canonicalCode] !== canonicalDimension)
    return semanticIssue(
      `Canonical unit ${canonicalCode} is not registered with dimension ${canonicalDimension}.`,
    );

  if (!Array.isArray(definition.acceptedUnits) || definition.acceptedUnits.length === 0)
    return semanticIssue('acceptedUnits must include the canonical unit.');
  const acceptedUnits = new Map<string, string>();
  for (const [index, unit] of definition.acceptedUnits.entries()) {
    if (!isRecord(unit) || typeof unit.code !== 'string' || typeof unit.dimension !== 'string')
      return semanticIssue(`Accepted unit ${index} is incomplete.`);
    if (unit.code !== unit.code.normalize('NFC'))
      return semanticIssue(`Accepted unit ${index} code must be Unicode NFC normalized.`);
    if (acceptedUnits.has(unit.code))
      return semanticIssue(`Accepted unit ${unit.code} is duplicated.`);
    if (CONTROLLED_UNIT_DIMENSIONS[unit.code] !== unit.dimension)
      return semanticIssue(
        `Accepted unit ${unit.code} is not registered with dimension ${unit.dimension}.`,
      );
    if (unit.dimension !== canonicalDimension)
      return semanticIssue(
        `Accepted unit ${unit.code} is not dimensionally compatible with ${canonicalCode}.`,
      );
    acceptedUnits.set(unit.code, unit.dimension);
  }
  if (!acceptedUnits.has(canonicalCode))
    return semanticIssue(
      `acceptedUnits must contain canonical unit ${canonicalCode} exactly once.`,
    );

  const inputBounds = isRecord(definition.inputBounds) ? definition.inputBounds : undefined;
  if (!inputBounds) return semanticIssue('inputBounds are required.');
  const hardBoundsIssue = measurementIntervalIssue(inputBounds.hard, 'Hard input bounds');
  if (hardBoundsIssue) return semanticIssue(hardBoundsIssue);
  if (inputBounds.soft !== undefined) {
    const softBoundsIssue = measurementIntervalIssue(inputBounds.soft, 'Soft input bounds');
    if (softBoundsIssue) return semanticIssue(softBoundsIssue);
    const containmentIssue = measurementIntervalContainmentIssue(
      inputBounds.hard as JsonRecord,
      inputBounds.soft as JsonRecord,
    );
    if (containmentIssue) return semanticIssue(containmentIssue);
  }

  const scalarRoutes = new Map<string, number>();
  const compositeAdapters = new Set<string>();
  if (definition.conversions !== undefined && !Array.isArray(definition.conversions))
    return semanticIssue('conversions must be an array.');
  for (const [index, conversion] of (definition.conversions ?? []).entries()) {
    if (!isRecord(conversion)) return semanticIssue(`Conversion ${index} must be an object.`);
    if (conversion.kind === 'affine') {
      if (
        typeof conversion.factor !== 'number' ||
        !Number.isFinite(conversion.factor) ||
        conversion.factor <= 0
      )
        return semanticIssue(`Conversion ${index} factor must be positive and finite.`);
      if (typeof conversion.offset !== 'number' || !Number.isFinite(conversion.offset))
        return semanticIssue(`Conversion ${index} offset must be finite.`);
      if (
        typeof conversion.fromUnit !== 'string' ||
        typeof conversion.toUnit !== 'string' ||
        conversion.fromUnit.length === 0 ||
        conversion.toUnit.length === 0
      )
        return semanticIssue(`Conversion ${index} must declare fromUnit and toUnit.`);
      if (conversion.toUnit !== canonicalCode)
        return semanticIssue(
          `Conversion ${index} must target the canonical unit ${canonicalCode}.`,
        );
      if (!acceptedUnits.has(conversion.fromUnit))
        return semanticIssue(`Conversion ${index} fromUnit must be declared in acceptedUnits.`);
      const routeCount = (scalarRoutes.get(conversion.fromUnit) ?? 0) + 1;
      scalarRoutes.set(conversion.fromUnit, routeCount);
      if (routeCount > 1)
        return semanticIssue(`Conversion ${index} duplicates fromUnit ${conversion.fromUnit}.`);
      if (
        conversion.fromUnit === canonicalCode &&
        (conversion.factor !== 1 || conversion.offset !== 0)
      )
        return semanticIssue(`Canonical conversion ${index} must be the identity route.`);
      const claimIssue = linkedClaimsIssue(conversion.sourceClaimIds, `Conversion ${index}`);
      if (claimIssue) return semanticIssue(claimIssue);
      continue;
    }
    if (conversion.kind === 'composite') {
      const adapter =
        typeof conversion.adapter === 'string' ? COMPOSITE_ADAPTERS[conversion.adapter] : undefined;
      if (!adapter)
        return semanticIssue(`Conversion ${index} uses an unsupported composite adapter.`);
      if (compositeAdapters.has(conversion.adapter as string))
        return semanticIssue(`Conversion ${index} duplicates adapter ${conversion.adapter}.`);
      compositeAdapters.add(conversion.adapter as string);
      if (canonicalCode !== adapter.toUnit || canonicalDimension !== adapter.dimension)
        return semanticIssue(
          `Composite conversion ${index} does not match the adapter output unit and dimension.`,
        );
      if (conversion.toUnit !== adapter.toUnit)
        return semanticIssue(
          `Conversion ${index} must target the canonical unit ${canonicalCode}.`,
        );
      if (!Array.isArray(conversion.from) || conversion.from.length !== adapter.from.length)
        return semanticIssue(`Composite conversion ${index} has invalid component fields.`);
      for (const [componentIndex, expected] of adapter.from.entries()) {
        const actual = conversion.from[componentIndex];
        if (!isRecord(actual) || actual.field !== expected.field || actual.unit !== expected.unit)
          return semanticIssue(`Composite conversion ${index} has invalid component fields.`);
        if (CONTROLLED_UNIT_DIMENSIONS[expected.unit] !== adapter.dimension)
          return semanticIssue(`Composite conversion ${index} has an unregistered component unit.`);
      }
      const claimIssue = linkedClaimsIssue(conversion.sourceClaimIds, `Conversion ${index}`);
      if (claimIssue) return semanticIssue(claimIssue);
      continue;
    }
    return semanticIssue(`Conversion ${index} has an unsupported kind.`);
  }
  for (const acceptedCode of acceptedUnits.keys()) {
    if (acceptedCode === canonicalCode) continue;
    if (scalarRoutes.get(acceptedCode) !== 1)
      return semanticIssue(
        `Accepted noncanonical unit ${acceptedCode} must have exactly one conversion to ${canonicalCode}.`,
      );
  }

  const governance = isRecord(definition.governance) ? definition.governance : undefined;
  const declaredConflictIds = new Set(
    Array.isArray(governance?.conflictIds)
      ? governance.conflictIds.filter((item): item is string => typeof item === 'string')
      : [],
  );
  const conflictGroupCounts = new Map<string, number>();
  const rangeIds = new Set<string>();
  if (definition.referenceRanges !== undefined && !Array.isArray(definition.referenceRanges))
    return semanticIssue('referenceRanges must be an array.');
  for (const [index, range] of (definition.referenceRanges ?? []).entries()) {
    if (!isRecord(range)) return semanticIssue(`Reference range ${index} must be an object.`);
    if (typeof range.id !== 'string' || rangeIds.has(range.id))
      return semanticIssue(`Reference range ${index} must have a unique id.`);
    rangeIds.add(range.id);
    if (typeof range.unit !== 'string' || !acceptedUnits.has(range.unit))
      return semanticIssue(`Reference range ${index} unit must be canonical or accepted.`);
    const intervalIssue = measurementIntervalIssue(
      range.interval,
      `Reference range ${index} interval`,
    );
    if (intervalIssue) return semanticIssue(intervalIssue);
    if (isRecord(range.context)) {
      const ageMin = range.context.ageMinYears;
      const ageMax = range.context.ageMaxYears;
      if (ageMin !== undefined && (typeof ageMin !== 'number' || !Number.isFinite(ageMin)))
        return semanticIssue(`Reference range ${index} ageMinYears must be finite.`);
      if (ageMax !== undefined && (typeof ageMax !== 'number' || !Number.isFinite(ageMax)))
        return semanticIssue(`Reference range ${index} ageMaxYears must be finite.`);
      if (typeof ageMin === 'number' && typeof ageMax === 'number' && ageMin > ageMax)
        return semanticIssue(`Reference range ${index} ageMinYears cannot exceed ageMaxYears.`);
    }
    if (range.conflictGroup !== undefined) {
      if (typeof range.conflictGroup !== 'string' || !declaredConflictIds.has(range.conflictGroup))
        return semanticIssue(
          `Reference range ${index} conflictGroup must be declared in governance.conflictIds.`,
        );
      conflictGroupCounts.set(
        range.conflictGroup,
        (conflictGroupCounts.get(range.conflictGroup) ?? 0) + 1,
      );
    }
    const claimIssue = linkedClaimsIssue(range.sourceClaimIds, `Reference range ${index}`);
    if (claimIssue) return semanticIssue(claimIssue);
  }
  for (const conflictId of declaredConflictIds) {
    const count = conflictGroupCounts.get(conflictId) ?? 0;
    if (count < 2)
      return semanticIssue(
        `Conflict group ${conflictId} must identify at least two reference ranges.`,
      );
  }
  return undefined;
}

/** Compatibility helper for existing internal callers that need only text. */
export function measurementDefinitionIssue(
  definition: JsonRecord,
  sources: readonly unknown[],
): string | undefined {
  return nonDerivedMeasurementSemanticEligibilityIssue(definition, sources)?.message;
}

function identifierString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value) && typeof value !== 'object') return undefined;
  const rendered = String(value);
  return /^[a-f0-9]{24}$/iu.test(rendered) ? rendered : undefined;
}

function isoInstant(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function futureIsoInstant(value: unknown, now: Date): boolean {
  if (value === undefined || value === null) return true;
  const instant = isoInstant(value);
  return instant !== undefined && new Date(instant).getTime() > now.getTime();
}

/**
 * Approved medical evidence may carry an explicit review deadline. Once either
 * the definition review or a displayed reference range expires, the complete
 * revision becomes ineligible for public use until a new review is recorded.
 */
export function measurementEvidenceExpiryIssue(
  definition: JsonRecord,
  now = new Date(),
): string | undefined {
  const governance = isRecord(definition.governance) ? definition.governance : undefined;
  if (!futureIsoInstant(governance?.reviewExpiresAt, now))
    return 'The measurement medical review is expired or has an invalid review expiry.';
  if (!Array.isArray(definition.referenceRanges)) return undefined;
  for (const [index, range] of definition.referenceRanges.entries()) {
    if (isRecord(range) && !futureIsoInstant(range.reviewExpiresAt, now))
      return `Reference range ${index} is expired or has an invalid review expiry.`;
  }
  return undefined;
}

export function stableMeasurementHash(value: unknown): string {
  return createHash('sha256').update(stableJsonStringify(value)).digest('hex');
}

export function stableMeasurementEqual(left: unknown, right: unknown): boolean {
  return stableJsonStringify(left) === stableJsonStringify(right);
}

export function measurementReviewHash(input: {
  readonly definitionHash: string;
  readonly sources: readonly unknown[];
  readonly reviewerId: string;
  readonly reviewedAt: string;
}): string {
  return stableMeasurementHash({
    definitionHash: input.definitionHash,
    sourceHash: stableMeasurementHash(input.sources),
    reviewerId: input.reviewerId,
    reviewedAt: input.reviewedAt,
  });
}

export function canonicalMeasurementKindMatchesEnvelope(
  envelopeKind: unknown,
  canonicalKind: unknown,
): boolean {
  return (
    typeof envelopeKind === 'string' &&
    typeof canonicalKind === 'string' &&
    (CANONICAL_KINDS_BY_ENVELOPE_KIND[envelopeKind]?.has(canonicalKind) ?? false)
  );
}

/**
 * Verify the persistence envelope still identifies the exact canonical
 * definition it wraps. Array order is significant; object-key order is not.
 */
export function measurementEnvelopeConsistencyIssue(value: JsonRecord): string | undefined {
  const definition = isRecord(value.definition) ? value.definition : undefined;
  if (!definition) return 'The canonical measurement definition is missing.';
  if (definition.key !== value.key) return 'Canonical key does not match the persistence key.';
  if (definition.version !== value.revision)
    return 'Canonical version does not match the persistence revision.';
  if (definition.displayName !== value.displayName)
    return 'Canonical displayName does not match the persistence displayName.';
  const canonicalUnit = isRecord(definition.canonicalUnit)
    ? definition.canonicalUnit.code
    : undefined;
  if (typeof canonicalUnit !== 'string' || canonicalUnit !== value.canonicalUnit)
    return 'Canonical unit does not match the persistence canonicalUnit.';
  if (!canonicalMeasurementKindMatchesEnvelope(value.kind, definition.kind))
    return 'Canonical kind does not match the explicit persistence kind mapping.';
  if (!Array.isArray(value.sources) || !Array.isArray(definition.sources))
    return 'Canonical and persistence sources must both be arrays.';
  if (!stableMeasurementEqual(value.sources, definition.sources))
    return 'Canonical sources diverge from the persistence source snapshot.';
  return undefined;
}

/**
 * Final defense at the HTTP boundary. MongoDB predicates narrow candidates,
 * while this check binds schema, identity, sources, reviewer, time, and hashes.
 */
export function isApprovedMeasurementEnvelope(value: JsonRecord, now = new Date()): boolean {
  if (
    value.status !== 'verified' ||
    value.kind === 'derived' ||
    measurementEnvelopeConsistencyIssue(value)
  )
    return false;
  const definition = isRecord(value.definition) ? value.definition : undefined;
  if (!definition || !validateMeasurementDefinitionStructure(definition).valid) return false;
  if (definition.kind === 'derived-measurement') return false;
  const governance = isRecord(definition.governance) ? definition.governance : undefined;
  if (
    definition.status !== 'approved' ||
    governance?.reviewStatus !== 'approved' ||
    !Array.isArray(governance.publishBlockers) ||
    governance.publishBlockers.length !== 0 ||
    typeof governance.reviewerId !== 'string' ||
    governance.reviewerId.length === 0
  )
    return false;
  if (measurementEvidenceExpiryIssue(definition, now)) return false;
  const reviewedAt = isoInstant(governance.reviewedAt);
  const verifiedAt = isoInstant(value.verifiedAt);
  const reviewedBy = identifierString(value.reviewedBy);
  if (
    !reviewedAt ||
    !verifiedAt ||
    reviewedAt !== verifiedAt ||
    !reviewedBy ||
    reviewedBy !== governance.reviewerId
  )
    return false;
  if (!Array.isArray(definition.sources)) return false;
  if (
    definition.sources.some(
      (source) =>
        !isRecord(source) || !VERIFIED_SOURCE_STATES.has(String(source.verification ?? '')),
    )
  )
    return false;
  if (nonDerivedMeasurementSemanticEligibilityIssue(definition, definition.sources)) return false;
  const definitionHash = stableMeasurementHash(definition);
  if (value.definitionHash !== definitionHash) return false;
  return (
    value.reviewHash ===
    measurementReviewHash({
      definitionHash,
      sources: definition.sources,
      reviewerId: governance.reviewerId,
      reviewedAt,
    })
  );
}
