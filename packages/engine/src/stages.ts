import type { CoverageMatrixEntry, CoverageSummary, DomainResult, ParameterResult } from './types';

/**
 * P2 stage helpers are deliberately data-only. They do not read clocks, I/O,
 * environment variables, or mutable configuration state. Keeping coverage and
 * maximum-point calculations here prevents the public orchestrator from
 * accidentally treating a partial score as a complete one.
 */

export interface AggregationResult {
  readonly value?: number;
  readonly possiblePoints: number;
  readonly memberKeys: readonly string[];
  readonly empty: boolean;
}

export interface SourceGapMatrixEntry {
  readonly path: string;
  readonly key: string;
  readonly from?: number;
  readonly to?: number;
  readonly documented: boolean;
  readonly clarificationRefs: readonly string[];
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function refs(value: JsonObject): readonly string[] {
  return asArray(value.clarificationRefs).filter(
    (item): item is string => typeof item === 'string',
  );
}

interface GapInterval {
  readonly min?: number;
  readonly max?: number;
  readonly minInclusive: boolean;
  readonly maxInclusive: boolean;
  readonly band: JsonObject;
}

function toInterval(band: JsonObject, explicit: boolean): GapInterval {
  return {
    min: asNumber(band.min),
    max: asNumber(band.max),
    minInclusive: band.minExclusive === true ? false : band.minInclusive === true || !explicit,
    maxInclusive: band.maxExclusive === true ? false : band.maxInclusive === true,
    band,
  };
}

function hasGap(left: GapInterval, right: GapInterval): boolean {
  if (left.max === undefined || right.min === undefined) return false;
  return (
    left.max < right.min || (left.max === right.min && !left.maxInclusive && !right.minInclusive)
  );
}

function collectGaps(
  bands: readonly unknown[],
  explicit: boolean,
  path: string,
  key: string,
  inheritedDocumented = false,
  inheritedRefs: readonly string[] = [],
): SourceGapMatrixEntry[] {
  const intervals = bands
    .map(asObject)
    .map((band) => toInterval(band, explicit))
    .map((value, index) => ({ value, index }))
    .sort(
      (left, right) =>
        (left.value.min ?? Number.NEGATIVE_INFINITY) -
        (right.value.min ?? Number.NEGATIVE_INFINITY),
    );
  const gaps: SourceGapMatrixEntry[] = [];
  for (let index = 1; index < intervals.length; index += 1) {
    const left = intervals[index - 1]?.value;
    const right = intervals[index]?.value;
    if (!left || !right || !hasGap(left, right)) continue;
    const clarificationRefs = [...new Set([...inheritedRefs, ...refs(right.band)])];
    gaps.push({
      path: `${path}[${intervals[index]?.index ?? index}]`,
      key,
      from: left.max,
      to: right.min,
      documented:
        inheritedDocumented || right.band.asWritten === true || clarificationRefs.length > 0,
      clarificationRefs,
    });
  }
  return gaps;
}

/** Return every explicit or undocumented interval gap in a v1 config. */
export function buildSourceGapMatrix(config: unknown): readonly SourceGapMatrixEntry[] {
  const calculator = asObject(config);
  const matrix: SourceGapMatrixEntry[] = [];
  asArray(calculator.scoringRules).forEach((rawRule, ruleIndex) => {
    const rule = asObject(rawRule);
    const key = typeof rule.parameterKey === 'string' ? rule.parameterKey : `rule-${ruleIndex}`;
    asArray(rule.contexts).forEach((rawContext, contextIndex) => {
      const context = asObject(rawContext);
      matrix.push(
        ...collectGaps(
          asArray(context.bands),
          rule.bandEdges === 'explicit',
          `scoringRules[${ruleIndex}].contexts[${contextIndex}].bands`,
          key,
          rule.asWritten === true || context.asWritten === true,
          [...refs(rule), ...refs(context)],
        ),
      );
    });
  });
  asArray(calculator.adjustmentRules).forEach((rawRule, ruleIndex) => {
    const rule = asObject(rawRule);
    const key = typeof rule.key === 'string' ? rule.key : `adjustment-${ruleIndex}`;
    matrix.push(
      ...collectGaps(
        asArray(rule.bands),
        rule.bandEdges === 'explicit',
        `adjustmentRules[${ruleIndex}].bands`,
        key,
        rule.asWritten === true,
        refs(rule),
      ),
    );
  });
  asArray(calculator.floorRules).forEach((rawRule, ruleIndex) => {
    const rule = asObject(rawRule);
    const key = typeof rule.key === 'string' ? rule.key : `floor-${ruleIndex}`;
    matrix.push(
      ...collectGaps(
        asArray(rule.tiers),
        false,
        `floorRules[${ruleIndex}].tiers`,
        key,
        rule.asWritten === true,
        refs(rule),
      ),
    );
  });
  asArray(calculator.imputationRules).forEach((rawRule, ruleIndex) => {
    const rule = asObject(rawRule);
    const action = asObject(rule.action);
    const byBand = asObject(action.setPointsByBand);
    const key = typeof rule.key === 'string' ? rule.key : `imputation-${ruleIndex}`;
    matrix.push(
      ...collectGaps(
        asArray(byBand.bands),
        false,
        `imputationRules[${ruleIndex}].action.setPointsByBand.bands`,
        key,
        rule.asWritten === true,
        refs(rule),
      ),
    );
  });
  const categories = asObject(calculator.resultCategories);
  matrix.push(
    ...collectGaps(
      asArray(categories.bands),
      categories.bandEdges === 'explicit',
      'resultCategories.bands',
      'resultCategories',
    ),
  );
  return matrix;
}

export function aggregatePoints(
  aggregate: string | undefined,
  members: readonly { key: string; points?: number; possiblePoints?: number }[],
): AggregationResult {
  const scored = members.filter((member) => member.points !== undefined);
  const possible = members.reduce((total, member) => total + (member.possiblePoints ?? 0), 0);
  const values = scored.map((member) => member.points as number);
  if (values.length === 0)
    return {
      possiblePoints: possible,
      memberKeys: members.map((member) => member.key),
      empty: true,
    };
  const value =
    aggregate === 'max'
      ? Math.max(...values)
      : aggregate === 'min'
        ? Math.min(...values)
        : aggregate === 'mean'
          ? values.reduce((total, item) => total + item, 0) / values.length
          : values.reduce((total, item) => total + item, 0);
  const possibleValue =
    aggregate === 'max'
      ? Math.max(...members.map((member) => member.possiblePoints ?? 0))
      : aggregate === 'min'
        ? Math.min(...members.map((member) => member.possiblePoints ?? 0))
        : aggregate === 'mean'
          ? members.length
            ? possible / members.length
            : 0
          : possible;
  return {
    value,
    possiblePoints: possibleValue,
    memberKeys: members.map((member) => member.key),
    empty: false,
  };
}

export function buildCoverageSummary(
  parameters: readonly ParameterResult[],
  domains: readonly DomainResult[],
  sourceGapKeys: ReadonlySet<string> = new Set(),
  sourceGapReferences: ReadonlyMap<string, readonly string[]> = new Map(),
  aggregates: readonly {
    readonly key: string;
    readonly earnedPoints?: number;
    readonly possiblePoints: number;
    readonly scored: boolean;
    readonly missing: boolean;
  }[] = [],
): CoverageSummary {
  const entries: CoverageMatrixEntry[] = parameters.map((parameter) => {
    const applicable = parameter.applicable !== false;
    const scored = applicable && parameter.points !== undefined;
    const possiblePoints = applicable ? (parameter.possiblePoints ?? 0) : 0;
    const earnedPoints = scored ? (parameter.points as number) : 0;
    return {
      key: parameter.key,
      kind: 'parameter',
      applicable,
      scored,
      missing: parameter.missing,
      earnedPoints,
      possiblePoints,
      coverage: possiblePoints > 0 ? Math.max(0, earnedPoints / possiblePoints) : scored ? 1 : 0,
      sourceGap: sourceGapKeys.has(parameter.key),
      clarificationRefs: sourceGapReferences.get(parameter.key) ?? [],
    };
  });
  domains.forEach((domain) => {
    entries.push({
      key: domain.key,
      kind: 'domain',
      applicable: domain.applicableCount > 0,
      scored: domain.status === 'scored',
      missing: domain.missingCount > 0,
      earnedPoints: domain.earnedPoints,
      possiblePoints: domain.possiblePoints,
      coverage: domain.coverage,
      sourceGap: false,
      clarificationRefs: [],
    });
  });
  aggregates.forEach((aggregate) => {
    entries.push({
      key: aggregate.key,
      kind: 'aggregate',
      applicable: aggregate.possiblePoints > 0,
      scored: aggregate.scored,
      missing: aggregate.missing,
      earnedPoints: aggregate.earnedPoints ?? 0,
      possiblePoints: aggregate.possiblePoints,
      coverage: aggregate.scored ? 1 : 0,
      sourceGap: false,
      clarificationRefs: [],
    });
  });
  const applicableParameters = parameters.filter(
    (parameter) => parameter.applicable !== false && parameter.possiblePoints !== undefined,
  );
  const scoredParameters = applicableParameters.filter(
    (parameter) => parameter.points !== undefined,
  );
  const possiblePoints = applicableParameters.reduce(
    (total, parameter) => total + Math.max(0, parameter.possiblePoints ?? 0),
    0,
  );
  const earnedPoints = scoredParameters.reduce(
    (total, parameter) => total + (parameter.points ?? 0),
    0,
  );
  const totalDomainWeight = domains.reduce((total, domain) => total + domain.weight, 0);
  const scoredDomainWeight = domains
    .filter((domain) => domain.status === 'scored')
    .reduce((total, domain) => total + domain.weight, 0);
  return {
    entries,
    scoredParameterCount: scoredParameters.length,
    applicableScoredParameterCount: applicableParameters.length,
    possibleParameterCount: applicableParameters.filter(
      (parameter) => (parameter.possiblePoints ?? 0) > 0,
    ).length,
    earnedPoints,
    possiblePoints,
    parameterCoverage: applicableParameters.length
      ? scoredParameters.length / applicableParameters.length
      : 0,
    possibleWeightCoverage: totalDomainWeight ? scoredDomainWeight / totalDomainWeight : 0,
    domainCoverage: domains.length ? scoredDomainWeight / (totalDomainWeight || 1) : 0,
  };
}
