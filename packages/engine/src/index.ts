import { evaluateExpression } from './expression';
import { aggregatePoints, buildCoverageSummary } from './stages';
export * from './types';
export * from './stages';

export const ENGINE_PACKAGE_VERSION = '0.1.0' as const;
export const ENGINE_SEMANTIC_VERSION = '1.0.0' as const;
export const ENGINE_IMPLEMENTATION_STATUS = 'deterministic-v1' as const;

type RecordValue = Record<string, unknown>;

function object(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}
function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function camelCase(key: string): string {
  return key.replace(/[-_](.)/g, (_match, character: string) => character.toUpperCase());
}
function scalar(value: unknown): string | number | boolean | null | undefined {
  return value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : undefined;
}
function getValue(map: Readonly<Record<string, unknown>>, key: string): unknown {
  return map[key] ?? map[camelCase(key)];
}
function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}
function engineError(
  code: import('./types').EngineError['code'],
  path: string,
  message: string,
): import('./types').EngineError {
  return { code, path, message };
}

function validateNumeric(
  parameter: RecordValue,
  value: number,
  path: string,
  errors: import('./types').EngineError[],
  warnings: string[],
  canonical?: string,
): { value: number; unit?: string } {
  const validation = object(parameter.validation);
  const min = number(validation.min);
  const max = number(validation.max);
  const softMin = number(validation.softMin);
  const softMax = number(validation.softMax);
  if (min !== undefined && value < min)
    errors.push(engineError('INVALID_INPUT', path, `Value must be at least ${min}.`));
  if (max !== undefined && value > max)
    errors.push(engineError('INVALID_INPUT', path, `Value must be at most ${max}.`));
  if (validation.integer === true && !Number.isInteger(value))
    errors.push(engineError('INVALID_INPUT', path, 'Value must be an integer.'));
  if (softMin !== undefined && value < softMin)
    warnings.push(
      `${path}: Value is below the review range of ${softMin}${canonical ? ` ${canonical}` : ''}.`,
    );
  if (softMax !== undefined && value > softMax)
    warnings.push(
      `${path}: Value is above the review range of ${softMax}${canonical ? ` ${canonical}` : ''}.`,
    );
  return canonical ? { value, unit: canonical } : { value };
}

function normalizeNumber(
  parameter: RecordValue,
  raw: unknown,
  path: string,
  errors: import('./types').EngineError[],
  warnings: string[],
): { value?: number; unit?: string } {
  const unit = object(parameter.unit);
  let entered: unknown = raw;
  let enteredUnit: string | undefined;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const measurement = raw as RecordValue;
    entered = measurement.value;
    enteredUnit = string(measurement.unit);
  }
  const value = number(entered);
  if (value === undefined) {
    errors.push(
      engineError(
        'UNIT_VALUE_INVALID',
        path,
        'Numeric input must be a finite number or a { value, unit } object.',
      ),
    );
    return {};
  }
  const canonical = string(unit.canonical);
  if (!canonical) return validateNumeric(parameter, value, path, errors, warnings);
  if (!enteredUnit || enteredUnit === canonical)
    return validateNumeric(parameter, value, path, errors, warnings, canonical);
  const allowed = array(unit.allowed)
    .map(object)
    .find((choice) => string(choice.code) === enteredUnit);
  if (!allowed) {
    errors.push(
      engineError(
        'UNIT_NOT_ALLOWED',
        path,
        `Unit "${enteredUnit}" is not allowed; expected ${canonical}.`,
      ),
    );
    return {};
  }
  const factor = number(allowed.factor);
  const offset = number(allowed.offset) ?? 0;
  if (factor === undefined || factor <= 0) {
    errors.push(
      engineError(
        'UNIT_NOT_ALLOWED',
        `${path}.unit`,
        'Unit conversion factor must be positive and finite.',
      ),
    );
    return {};
  }
  return validateNumeric(parameter, value * factor + offset, path, errors, warnings, canonical);
}

function conditionMatches(
  condition: unknown,
  values: Readonly<Record<string, unknown>>,
  aggregates: Readonly<Record<string, unknown>>,
  formulas: Readonly<Record<string, unknown>>,
): boolean {
  if (condition === null || condition === undefined) return true;
  const value = object(condition);
  if (Array.isArray(value.all))
    return value.all.every((item) => conditionMatches(item, values, aggregates, formulas));
  if (Array.isArray(value.any))
    return value.any.some((item) => conditionMatches(item, values, aggregates, formulas));
  if ('not' in value) return !conditionMatches(value.not, values, aggregates, formulas);
  const sourceKey = string(value.param) ?? string(value.aggregate) ?? string(value.formula) ?? '';
  const source =
    value.param !== undefined
      ? getValue(values, sourceKey)
      : value.aggregate !== undefined
        ? getValue(aggregates, sourceKey)
        : getValue(formulas, sourceKey);
  const op = string(value.op);
  if (op === 'exists') return !isMissing(source);
  if (op === 'missing') return isMissing(source);
  const expected = value.value;
  // The semantic contract treats a missing value as unknown for ordinary
  // comparisons. In particular, `ne` must not turn an absent boolean into
  // an implicit false. Only exists/missing inspect absence directly.
  if (isMissing(source)) return false;
  if (op === 'in' || op === 'not-in') {
    const candidates = Array.isArray(expected) ? expected : [expected];
    const found = candidates.some((candidate) => Object.is(source, candidate));
    return op === 'in' ? found : !found;
  }
  if (op === 'eq') return Object.is(source, expected);
  if (op === 'ne') return !Object.is(source, expected);
  if (typeof source !== 'number' || typeof expected !== 'number') return false;
  if (op === 'gt') return source > expected;
  if (op === 'gte') return source >= expected;
  if (op === 'lt') return source < expected;
  if (op === 'lte') return source <= expected;
  return false;
}

function conditionUsesAggregate(condition: unknown): boolean {
  const value = object(condition);
  if (value.aggregate !== undefined) return true;
  return (
    array(value.all).some(conditionUsesAggregate) ||
    array(value.any).some(conditionUsesAggregate) ||
    (value.not !== undefined && conditionUsesAggregate(value.not))
  );
}

function bandMatches(band: RecordValue, value: number, defaultEdges: string): boolean {
  const min = number(band.min);
  const max = number(band.max);
  const minInclusive =
    band.minExclusive === true
      ? false
      : band.minInclusive === true ||
        (band.minInclusive !== false && defaultEdges === 'min-inclusive');
  const maxInclusive = band.maxExclusive === true ? false : band.maxInclusive === true;
  if (min !== undefined && (minInclusive ? value < min : value <= min)) return false;
  if (max !== undefined && (maxInclusive ? value > max : value >= max)) return false;
  return true;
}

function clarificationRefs(value: RecordValue): readonly string[] {
  return array(value.clarificationRefs)
    .map(string)
    .filter((item): item is string => Boolean(item));
}

function sourceGapMetadata(
  rule: RecordValue,
  context?: RecordValue,
  band?: RecordValue,
): { readonly sourceGap: boolean; readonly clarificationRefs: readonly string[] } {
  const refs = [
    ...clarificationRefs(rule),
    ...clarificationRefs(context ?? {}),
    ...clarificationRefs(band ?? {}),
  ];
  return {
    sourceGap:
      rule.asWritten === true ||
      context?.asWritten === true ||
      band?.asWritten === true ||
      refs.length > 0,
    clarificationRefs: [...new Set(refs)],
  };
}

function maximumBandPoints(bands: readonly unknown[]): number | undefined {
  const points = bands
    .map(object)
    .map((band) => number(band.points))
    .filter((item): item is number => item !== undefined);
  return points.length ? Math.max(...points) : undefined;
}

function maximumOptionPoints(options: readonly unknown[]): number | undefined {
  const points = options
    .map(object)
    .map((option) => number(option.points))
    .filter((item): item is number => item !== undefined);
  return points.length ? Math.max(...points) : undefined;
}

function lookupResolver(config: RecordValue): (table: string, input: unknown) => unknown {
  const tables = new Map<string, RecordValue>();
  for (const raw of array(config.lookupTables)) {
    const table = object(raw);
    const key = string(table.key);
    if (key) tables.set(key, table);
  }
  return (key, input) => {
    const table = tables.get(key);
    if (!table) throw new Error(`Lookup table "${key}" does not exist.`);
    const entries = [
      ...array(table.entries).map(object),
      ...array(table.map).map((raw) => {
        const legacy = object(raw);
        return {
          input: legacy.points,
          output: legacy.riskPct,
          ...(legacy.orBelow === true ? { orBelow: true } : {}),
          ...(legacy.orAbove === true ? { orAbove: true } : {}),
        };
      }),
    ];
    const exact = entries.find((entry) => Object.is(entry.input, input));
    if (exact) return scalar(exact.output);
    const numericInput = number(input);
    if (numericInput !== undefined) {
      const sorted = entries
        .filter((entry) => number(entry.input) !== undefined)
        .sort((a, b) => (number(a.input) ?? 0) - (number(b.input) ?? 0));
      const closestLower = sorted
        .filter((entry) => numericInput >= (number(entry.input) ?? Number.POSITIVE_INFINITY))
        .at(-1);
      if (closestLower && closestLower.orAbove === true) return scalar(closestLower.output);
      const closestUpper = sorted.find(
        (entry) => numericInput <= (number(entry.input) ?? Number.NEGATIVE_INFINITY),
      );
      if (closestUpper && closestUpper.orBelow === true) return scalar(closestUpper.output);
    }
    throw new Error(`No lookup entry for ${String(input)} in "${key}".`);
  };
}

function deriveOrder(parameters: readonly RecordValue[]): {
  order: readonly RecordValue[];
  cycle: readonly string[];
} {
  const byKey = new Map(parameters.map((parameter) => [string(parameter.key) ?? '', parameter]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: RecordValue[] = [];
  const cycle: string[] = [];
  const visit = (key: string): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      cycle.push(key);
      return;
    }
    visiting.add(key);
    const parameter = byKey.get(key);
    for (const dependency of array(object(parameter?.derived).dependsOn)) {
      const dependencyKey = string(dependency);
      if (dependencyKey && byKey.has(dependencyKey)) visit(dependencyKey);
    }
    visiting.delete(key);
    visited.add(key);
    if (parameter) order.push(parameter);
  };
  for (const parameter of parameters) {
    const key = string(parameter.key);
    if (key) visit(key);
  }
  return { order, cycle };
}

function formulaOrder(formulas: readonly RecordValue[]): {
  order: readonly RecordValue[];
  cycle: readonly string[];
} {
  const byKey = new Map<string, RecordValue>();
  for (const formula of formulas) {
    const key = string(formula.key);
    if (key) byKey.set(key, formula);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: RecordValue[] = [];
  const cycle: string[] = [];
  const visit = (key: string): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      cycle.push(key);
      return;
    }
    visiting.add(key);
    const formula = byKey.get(key);
    const symbols = (string(formula?.expression) ?? '').match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
    for (const symbol of symbols) {
      const dependency = byKey.has(symbol)
        ? symbol
        : [...byKey.keys()].find((candidate) => camelCase(candidate) === symbol);
      if (dependency) visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
    if (formula) order.push(formula);
  };
  for (const key of byKey.keys()) visit(key);
  return { order, cycle };
}

export function executeCalculator(
  config: unknown,
  inputs: Readonly<Record<string, unknown>>,
  options: import('./types').EngineOptions = {},
): import('./types').EngineResult {
  const calculator = object(config);
  const slug = string(calculator.calculatorSlug) ?? 'unknown';
  const version = number(calculator.version) ?? 0;
  const errors: import('./types').EngineError[] = [];
  const warnings: string[] = [];
  const trace: import('./types').TraceStep[] = [];
  const parameterResults: import('./types').ParameterResult[] = [];
  const values: Record<string, unknown> = {};
  const parameterDefinitions = array(calculator.parameters).map(object);
  const knownKeys = new Set(
    parameterDefinitions
      .map((parameter) => string(parameter.key))
      .filter((key): key is string => Boolean(key)),
  );
  if (options.rejectUnknownInputs !== false)
    for (const key of Object.keys(inputs))
      if (!knownKeys.has(key) && !knownKeys.has(camelCase(key)))
        errors.push(
          engineError(
            'UNKNOWN_PARAMETER',
            `inputs.${key}`,
            `Input parameter "${key}" is not defined.`,
          ),
        );
  const missingPolicies = new Map<string, string>();
  for (const parameter of parameterDefinitions) {
    const key = string(parameter.key);
    if (key)
      missingPolicies.set(
        key,
        string(parameter.missingPolicy) ??
          (object(parameter.validation).required === true ? 'block' : 'exclude-from-group'),
      );
  }
  for (const parameter of parameterDefinitions) {
    const key = string(parameter.key);
    if (!key || parameter.inputType === 'derived') continue;
    const raw = getValue(inputs, key);
    const path = `inputs.${key}`;
    if (isMissing(raw)) {
      const policy = missingPolicies.get(key) ?? 'block';
      if (policy === 'default-option' && parameter.defaultOption !== undefined) {
        values[key] = parameter.defaultOption;
        parameterResults.push({
          key,
          input: undefined,
          value: scalar(parameter.defaultOption),
          missing: true,
          applicable: true,
          status: 'scored',
        });
        trace.push({
          kind: 'normalization',
          key,
          value: parameter.defaultOption,
          detail: { policy },
        });
      } else {
        parameterResults.push({
          key,
          input: raw,
          missing: true,
          applicable: true,
          status: policy === 'block' ? 'blocked' : 'excluded',
        });
        if (policy === 'block')
          errors.push(engineError('MISSING_REQUIRED_INPUT', path, 'A required input is missing.'));
        trace.push({ kind: 'input', key, detail: { missing: true, policy } });
      }
      continue;
    }
    if (parameter.inputType === 'number') {
      const normalized = normalizeNumber(parameter, raw, path, errors, warnings);
      if (normalized.value === undefined) continue;
      values[key] = normalized.value;
      parameterResults.push({
        key,
        input: raw,
        value: normalized.value,
        canonicalUnit: normalized.unit,
        missing: false,
        applicable: true,
        status: 'scored',
      });
      trace.push({
        kind: 'normalization',
        key,
        value: normalized.value,
        detail: { unit: normalized.unit },
      });
    } else if (parameter.inputType === 'boolean') {
      if (typeof raw !== 'boolean')
        errors.push(engineError('INVALID_INPUT', path, 'Boolean input must be true or false.'));
      else {
        values[key] = raw;
        parameterResults.push({
          key,
          input: raw,
          value: raw,
          missing: false,
          applicable: true,
          status: 'scored',
        });
      }
    } else if (parameter.inputType === 'select') {
      const allowed = array(parameter.options)
        .map(object)
        .map((option) => option.value);
      if (!allowed.some((candidate) => Object.is(candidate, raw)))
        errors.push(
          engineError(
            'INVALID_INPUT',
            path,
            'Selected value is not one of the configured options.',
          ),
        );
      else {
        values[key] = raw;
        parameterResults.push({
          key,
          input: raw,
          value: scalar(raw),
          missing: false,
          applicable: true,
          status: 'scored',
        });
      }
    } else values[key] = raw;
  }
  // Visibility is re-evaluated by the authoritative server after normalization.
  // A stale value for a non-applicable field is ignored, not treated as an
  // unknown input and never allowed to influence scoring.
  for (const parameter of parameterDefinitions) {
    const key = string(parameter.key);
    if (!key || parameter.visibility === undefined) continue;
    if (conditionMatches(parameter.visibility, values, {}, {})) continue;
    delete values[key];
    const result = parameterResults.find((item) => item.key === key);
    if (result) {
      parameterResults[parameterResults.indexOf(result)] = {
        ...result,
        value: undefined,
        points: undefined,
        possiblePoints: undefined,
        applicable: false,
        missing: false,
        status: 'excluded',
      };
    } else {
      parameterResults.push({
        key,
        input: getValue(inputs, key),
        applicable: false,
        missing: false,
        status: 'excluded',
      });
    }
    trace.push({ kind: 'input', key, detail: { applicable: false, ignored: true } });
  }
  const derived = deriveOrder(parameterDefinitions);
  if (derived.cycle.length)
    errors.push(
      engineError(
        'DERIVATION_ERROR',
        'parameters',
        `Derived parameter cycle detected at ${derived.cycle.join(', ')}.`,
      ),
    );
  for (const parameter of derived.order) {
    const key = string(parameter.key);
    const definition = object(parameter.derived);
    if (!key || parameter.inputType !== 'derived') continue;
    const dependencies = array(definition.dependsOn)
      .map(string)
      .filter((dependency): dependency is string => Boolean(dependency));
    if (dependencies.some((dependency) => isMissing(getValue(values, dependency)))) {
      const policy = missingPolicies.get(key) ?? 'block';
      if (policy === 'block')
        errors.push(
          engineError(
            'BLOCKED_BY_POLICY',
            `parameters.${key}`,
            'A required derived value cannot be computed from the available dependencies.',
          ),
        );
      parameterResults.push({
        key,
        input: undefined,
        missing: true,
        applicable: true,
        status: policy === 'block' ? 'blocked' : 'excluded',
      });
      trace.push({
        kind: 'derived',
        key,
        detail: { missing: true, policy, dependsOn: dependencies },
      });
      continue;
    }
    try {
      const result = evaluateExpression(string(definition.formula) ?? '', {
        values,
        lookup: lookupResolver(calculator),
      });
      const numeric = number(result);
      if (numeric === undefined) throw new Error('Derived formula must return a finite number.');
      values[key] = numeric;
      parameterResults.push({
        key,
        input: undefined,
        value: numeric,
        canonicalUnit: string(object(parameter.unit).canonical),
        missing: false,
        applicable: true,
        status: 'scored',
      });
      trace.push({ kind: 'derived', key, value: numeric, detail: { dependsOn: dependencies } });
    } catch (cause) {
      errors.push(
        engineError(
          'DERIVATION_ERROR',
          `parameters.${key}`,
          cause instanceof Error ? cause.message : String(cause),
        ),
      );
    }
  }
  const points: number[] = [];
  const scoreByParameter = new Map<string, number>();
  const possibleByParameter = new Map<string, number>();
  const sourceGapKeys = new Set<string>();
  const sourceGapReferences = new Map<string, readonly string[]>();
  const scoringRules = array(calculator.scoringRules).map(object);
  const imputationRules = array(calculator.imputationRules).map(object);
  for (const rule of scoringRules) {
    const key = string(rule.parameterKey);
    if (!key) continue;
    const value = getValue(values, key);
    let score: number | undefined;
    let possiblePoints: number | undefined;
    let imputed = false;
    let selectedContext: RecordValue | undefined;
    let selectedBand: RecordValue | undefined;
    let selectedOption: RecordValue | undefined;
    if (isMissing(value)) {
      let imputationResolutionFailed = false;
      const policy = missingPolicies.get(key) ?? 'block';
      const targetImputations = imputationRules.filter(
        (candidate) => string(candidate.parameterKey) === key,
      );
      const matchingImputations = imputationRules.filter(
        (candidate) =>
          string(candidate.parameterKey) === key &&
          conditionMatches(candidate.when, values, {}, {}),
      );
      if (matchingImputations.length > 1) {
        imputationResolutionFailed = true;
        errors.push(
          engineError(
            'BLOCKED_BY_POLICY',
            `imputationRules.${key}`,
            'More than one imputation rule applies to a missing parameter.',
          ),
        );
      }
      const imputation = matchingImputations.length === 1 ? matchingImputations[0] : undefined;
      const action = object(imputation?.action);
      if (imputation && number(action.setPoints) !== undefined) {
        score = number(action.setPoints);
        possiblePoints = Math.max(0, score ?? 0);
        imputed = true;
      } else if (imputation && object(action.setPointsByBand).bandParam) {
        const actionByBand = object(action.setPointsByBand);
        const bandParam = string(actionByBand.bandParam);
        const bandValue = bandParam ? number(getValue(values, bandParam)) : undefined;
        const bands = array(actionByBand.bands).map(object);
        const matchingBands = bands.filter(
          (candidate) =>
            bandValue !== undefined && bandMatches(candidate, bandValue, 'min-inclusive'),
        );
        selectedBand = matchingBands.length === 1 ? matchingBands[0] : undefined;
        score = number(selectedBand?.points);
        possiblePoints = maximumBandPoints(bands);
        if (score !== undefined) imputed = true;
        if (matchingBands.length > 1) imputationResolutionFailed = true;
        if (matchingBands.length > 1)
          errors.push(
            engineError(
              'BLOCKED_BY_POLICY',
              `imputationRules.${key}`,
              'More than one imputation band matches the available dependency value.',
            ),
          );
        else if (bandValue === undefined || score === undefined) {
          imputationResolutionFailed = true;
          errors.push(
            engineError(
              'BLOCKED_BY_POLICY',
              `imputationRules.${key}`,
              'The imputation band cannot be selected from the available dependencies.',
            ),
          );
        }
      }
      if (score === undefined && policy === 'block')
        errors.push(
          engineError(
            'MISSING_REQUIRED_INPUT',
            `inputs.${key}`,
            'Scoring cannot proceed because this parameter is missing.',
          ),
        );
      else if (score === undefined && policy === 'zero-points') {
        score = 0;
        possiblePoints =
          possiblePoints ??
          (Array.isArray(rule.optionPoints)
            ? maximumOptionPoints(rule.optionPoints)
            : maximumBandPoints(array(array(rule.contexts).map(object)[0]?.bands)));
      } else if (score === undefined && policy === 'impute-rule' && !imputationResolutionFailed) {
        const fallback =
          string(imputation?.fallbackPolicy) ??
          (targetImputations.length === 1
            ? string(targetImputations[0]?.fallbackPolicy)
            : undefined);
        if (fallback === 'zero-points') {
          score = 0;
          possiblePoints = 0;
        } else if (
          !imputationRules.some(
            (candidate) =>
              string(candidate.parameterKey) === key && conditionUsesAggregate(candidate.when),
          )
        ) {
          errors.push(
            engineError(
              'BLOCKED_BY_POLICY',
              fallback === 'block' ? `inputs.${key}` : `imputationRules.${key}`,
              fallback === 'block'
                ? 'No applicable imputation rule supplied the required missing contribution.'
                : 'No applicable imputation rule or required fallback policy supplied the missing contribution.',
            ),
          );
        }
      }
    } else if (Array.isArray(rule.optionPoints)) {
      const option = array(rule.optionPoints)
        .map(object)
        .find((candidate) => Object.is(candidate.value, value));
      score = number(option?.points);
      selectedOption = option;
      possiblePoints = maximumOptionPoints(rule.optionPoints);
      if (score === undefined)
        errors.push(
          engineError(
            'NO_SCORING_RULE',
            `scoringRules.${key}`,
            `No option score matches value ${String(value)}.`,
          ),
        );
    } else {
      const contexts = array(rule.contexts).map(object);
      const explicitMatches = contexts.filter(
        (candidate) =>
          candidate.when !== null &&
          candidate.when !== undefined &&
          conditionMatches(candidate.when, values, {}, {}),
      );
      if (explicitMatches.length > 1) {
        errors.push(
          engineError(
            'NO_SCORING_CONTEXT',
            `scoringRules.${key}.contexts`,
            'More than one scoring context matches the supplied inputs.',
          ),
        );
        continue;
      }
      const context = explicitMatches[0] ?? contexts.find((candidate) => candidate.when === null);
      if (!context) {
        errors.push(
          engineError(
            'NO_SCORING_CONTEXT',
            `scoringRules.${key}.contexts`,
            'No scoring context matches the supplied inputs.',
          ),
        );
        continue;
      }
      selectedContext = context;
      const resultCategories = object(calculator.resultCategories);
      const edgeMode =
        string(rule.bandEdges) ?? string(resultCategories.bandEdges) ?? 'min-inclusive';
      const band = array(context?.bands)
        .map(object)
        .find((candidate) => bandMatches(candidate, number(value) ?? Number.NaN, edgeMode));
      selectedBand = band;
      score = number(band?.points);
      possiblePoints = maximumBandPoints(array(context?.bands));
      if (score === undefined) {
        const gap = sourceGapMetadata(rule, context);
        if (gap.sourceGap) {
          sourceGapKeys.add(key);
          sourceGapReferences.set(key, gap.clarificationRefs);
        }
        errors.push(
          engineError(
            'NO_SCORING_BAND',
            `scoringRules.${key}`,
            gap.sourceGap
              ? `No score band matches value ${String(value)} in an explicitly documented source gap (${gap.clarificationRefs.join(', ') || 'as-written'}).`
              : `No score band matches value ${String(value)}.`,
          ),
        );
      }
    }
    if (score !== undefined) {
      scoreByParameter.set(key, score);
      if (possiblePoints !== undefined) possibleByParameter.set(key, Math.max(0, possiblePoints));
      points.push(score);
      trace.push({
        kind: 'score',
        key,
        value: score,
        detail: {
          input: value,
          possiblePoints,
          imputed,
          selectedContext: selectedContext
            ? (string(selectedContext.when) ?? 'default')
            : undefined,
          selectedBandOrOption: selectedBand ?? selectedOption,
        },
      });
      const result = parameterResults.find((item) => item.key === key);
      if (result)
        parameterResults[parameterResults.indexOf(result)] = {
          ...result,
          points: score,
          possiblePoints,
          imputed,
          applicable: result.applicable !== false,
          status: 'scored',
        };
    }
  }
  // Complete the possible-point side of the coverage matrix even when a
  // contribution is missing or falls into a documented source gap. Possible
  // points describe the authored opportunity, never an inferred clinical
  // value, and are therefore safe to report separately from earned points.
  for (const rule of scoringRules) {
    const key = string(rule.parameterKey);
    if (!key) continue;
    const result = parameterResults.find((item) => item.key === key);
    if (!result || result.applicable === false || result.possiblePoints !== undefined) continue;
    const policy = missingPolicies.get(key);
    if (
      policy === 'exclude-from-max' ||
      policy === 'not-applicable' ||
      policy === 'exclude-from-group'
    )
      continue;
    let possible: number | undefined;
    if (Array.isArray(rule.optionPoints)) possible = maximumOptionPoints(rule.optionPoints);
    else {
      const contexts = array(rule.contexts).map(object);
      const matching = contexts.filter(
        (candidate) =>
          candidate.when !== null &&
          candidate.when !== undefined &&
          conditionMatches(candidate.when, values, {}, {}),
      );
      const context =
        matching.length === 1 ? matching[0] : contexts.find((item) => item.when === null);
      possible = maximumBandPoints(array((context ?? {}).bands));
    }
    if (possible !== undefined) {
      parameterResults[parameterResults.indexOf(result)] = {
        ...result,
        possiblePoints: Math.max(0, possible),
      };
      possibleByParameter.set(key, Math.max(0, possible));
    }
  }
  const aggregates: Record<string, unknown> = {};
  const aggregatePossibleByKey = new Map<string, number>();
  const aggregateMemberKeys = new Map<string, readonly string[]>();
  for (const group of array(calculator.parameterGroupsAggregation).map(object)) {
    const key = string(group.key);
    if (!key) continue;
    const memberKeys = array(group.parameterKeys)
      .map(string)
      .filter((item): item is string => Boolean(item));
    const aggregate = string(group.aggregate);
    const result = aggregatePoints(
      aggregate,
      memberKeys.map((memberKey) => ({
        key: memberKey,
        points: scoreByParameter.get(memberKey),
        possiblePoints: possibleByParameter.get(memberKey),
      })),
    );
    aggregateMemberKeys.set(key, result.memberKeys);
    if (result.value !== undefined) aggregates[key] = result.value;
    if (!result.empty) aggregatePossibleByKey.set(key, result.possiblePoints);
    else {
      const emptyPolicy = string(group.emptyPolicy);
      if (emptyPolicy === undefined)
        errors.push(
          engineError(
            'AGGREGATE_EMPTY',
            `parameterGroupsAggregation.${key}`,
            'An empty aggregate requires an explicit emptyPolicy.',
          ),
        );
      else if (emptyPolicy === 'zero') {
        aggregates[key] = 0;
        aggregatePossibleByKey.set(key, 0);
      } else if (emptyPolicy === 'block')
        errors.push(
          engineError(
            'DOMAIN_UNSCORABLE',
            `parameterGroupsAggregation.${key}`,
            'An empty aggregate blocks scoring under its configured emptyPolicy.',
          ),
        );
    }
    trace.push({
      kind: 'aggregate',
      key,
      value: result.value,
      detail: { aggregate, possiblePoints: result.possiblePoints, empty: result.empty },
    });
  }
  // Aggregate-dependent imputations run after their prerequisite groups are
  // available. This dependency order avoids treating an aggregate that has
  // not been computed yet as a false condition.
  const aggregateImputationKeys = [
    ...new Set(
      imputationRules
        .filter((rule) => conditionUsesAggregate(rule.when))
        .map((rule) => string(rule.parameterKey))
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  for (const key of aggregateImputationKeys) {
    if (scoreByParameter.has(key) || !isMissing(getValue(values, key))) continue;
    const candidates = imputationRules.filter(
      (rule) => string(rule.parameterKey) === key && conditionUsesAggregate(rule.when),
    );
    const matching = candidates.filter((rule) =>
      conditionMatches(rule.when, values, aggregates, {}),
    );
    if (matching.length > 1) {
      errors.push(
        engineError(
          'BLOCKED_BY_POLICY',
          `imputationRules.${key}`,
          'More than one aggregate-dependent imputation rule applies to the missing parameter.',
        ),
      );
      continue;
    }
    const rule = matching[0];
    if (!rule) {
      const fallback = candidates.length === 1 ? string(candidates[0]?.fallbackPolicy) : undefined;
      if (fallback === 'zero-points') {
        scoreByParameter.set(key, 0);
        possibleByParameter.set(key, 0);
        points.push(0);
        const result = parameterResults.find((item) => item.key === key);
        if (result)
          parameterResults[parameterResults.indexOf(result)] = {
            ...result,
            points: 0,
            possiblePoints: 0,
            status: 'scored',
          };
        trace.push({
          kind: 'score',
          key,
          value: 0,
          detail: { fallback: 'zero-points', aggregateDependencies: true, possiblePoints: 0 },
        });
      } else if (fallback === 'block') {
        errors.push(
          engineError(
            'BLOCKED_BY_POLICY',
            `inputs.${key}`,
            'No aggregate-dependent imputation rule supplied the required missing contribution.',
          ),
        );
      } else {
        errors.push(
          engineError(
            'BLOCKED_BY_POLICY',
            `imputationRules.${key}`,
            'No aggregate-dependent imputation rule applied and no reachable fallback supplied a contribution.',
          ),
        );
      }
      continue;
    }
    const action = object(rule.action);
    let imputedScore: number | undefined = number(action.setPoints);
    let imputedPossible = imputedScore === undefined ? undefined : Math.max(0, imputedScore);
    if (imputedScore === undefined && object(action.setPointsByBand).bandParam) {
      const bandAction = object(action.setPointsByBand);
      const bandParam = string(bandAction.bandParam);
      const bandValue = bandParam ? number(getValue(values, bandParam)) : undefined;
      const bands = array(bandAction.bands).map(object);
      const matchingBands = bands.filter(
        (candidate) =>
          bandValue !== undefined && bandMatches(candidate, bandValue, 'min-inclusive'),
      );
      if (matchingBands.length > 1) {
        errors.push(
          engineError(
            'BLOCKED_BY_POLICY',
            `imputationRules.${key}`,
            'More than one aggregate-dependent imputation band matches the dependency value.',
          ),
        );
        continue;
      }
      imputedScore = number(matchingBands[0]?.points);
      imputedPossible = maximumBandPoints(bands);
    }
    if (imputedScore === undefined) {
      errors.push(
        engineError(
          'BLOCKED_BY_POLICY',
          `imputationRules.${key}`,
          'An aggregate-dependent imputation did not produce a point value.',
        ),
      );
      continue;
    }
    scoreByParameter.set(key, imputedScore);
    if (imputedPossible !== undefined) possibleByParameter.set(key, imputedPossible);
    points.push(imputedScore);
    const result = parameterResults.find((item) => item.key === key);
    if (result)
      parameterResults[parameterResults.indexOf(result)] = {
        ...result,
        points: imputedScore,
        possiblePoints: imputedPossible,
        imputed: true,
        status: 'scored',
      };
    trace.push({
      kind: 'score',
      key,
      value: imputedScore,
      detail: { imputed: true, aggregateDependencies: true, possiblePoints: imputedPossible },
    });
  }
  const domainResults: import('./types').DomainResult[] = [];
  for (const domain of array(calculator.domains).map(object)) {
    const key = string(domain.key);
    if (!key) continue;
    const keys = array(domain.parameterKeys)
      .map(string)
      .filter((item): item is string => Boolean(item));
    const aggregateKeys = array(domain.aggregateKeys)
      .map(string)
      .filter((item): item is string => Boolean(item));
    const consumedByAggregate = new Set(
      aggregateKeys.flatMap((aggregateKey) => aggregateMemberKeys.get(aggregateKey) ?? []),
    );
    const directKeys = keys.filter((item) => !consumedByAggregate.has(item));
    const directValues = directKeys
      .map((item) => scoreByParameter.get(item))
      .filter((item): item is number => item !== undefined);
    const aggregateValues = aggregateKeys
      .map((item) => number(getValue(aggregates, item)))
      .filter((item): item is number => item !== undefined);
    const valuesForDomain = [...directValues, ...aggregateValues];
    const possiblePoints =
      directKeys.reduce((total, item) => total + (possibleByParameter.get(item) ?? 0), 0) +
      aggregateKeys.reduce((total, item) => total + (aggregatePossibleByKey.get(item) ?? 0), 0);
    const weight = number(domain.weight) ?? 0;
    const domainPoints = valuesForDomain.length ? valuesForDomain.reduce((a, b) => a + b, 0) : 0;
    const applicableCount =
      directKeys.filter(
        (item) => parameterResults.find((result) => result.key === item)?.applicable !== false,
      ).length + aggregateValues.length;
    const scoredCount = valuesForDomain.length;
    const missingCount = Math.max(0, applicableCount - scoredCount);
    const domainScore = possiblePoints > 0 ? (domainPoints / possiblePoints) * 100 : undefined;
    domainResults.push({
      key,
      points: domainPoints,
      weight,
      parameterKeys: [...directKeys, ...aggregateKeys],
      scoredCount,
      missingCount,
      applicableCount,
      possiblePoints,
      earnedPoints: domainPoints,
      score: domainScore,
      coverage: applicableCount ? scoredCount / applicableCount : 0,
      status: valuesForDomain.length ? 'scored' : possiblePoints > 0 ? 'empty' : 'blocked',
    });
  }
  const domainPolicy = object(calculator.domainAggregationPolicy);
  const missingDomainPolicy = string(domainPolicy.missingDomainPolicy);
  const zeroDenominatorPolicy = string(domainPolicy.zeroDenominator) ?? 'unscored';
  const emptyDomains = domainResults.filter((domain) => domain.status === 'empty');
  const blockedDomains = domainResults.filter((domain) => domain.status === 'blocked');
  if (
    blockedDomains.length &&
    (zeroDenominatorPolicy === 'block' || zeroDenominatorPolicy === 'no-score')
  )
    errors.push(
      engineError(
        'DOMAIN_UNSCORABLE',
        'domainAggregationPolicy.zeroDenominator',
        'A domain has no possible points under the configured zero-denominator policy.',
      ),
    );
  if (emptyDomains.length && domainResults.length > 1 && !missingDomainPolicy) {
    errors.push(
      engineError(
        'DOMAIN_UNSCORABLE',
        'domainAggregationPolicy.missingDomainPolicy',
        'A multi-domain calculator must declare a missing-domain policy.',
      ),
    );
  }
  if (
    (emptyDomains.length || blockedDomains.length) &&
    (missingDomainPolicy === 'block' || missingDomainPolicy === 'no-score')
  ) {
    errors.push(
      engineError(
        'DOMAIN_UNSCORABLE',
        'domains',
        'One or more domains are not scorable under the configured missing-domain policy.',
      ),
    );
  }
  const scoredDomainWeight = domainResults
    .filter((domain) => domain.status === 'scored')
    .reduce((total, domain) => total + domain.weight, 0);
  if (domainResults.length > 0 && scoredDomainWeight === 0)
    errors.push(
      engineError(
        'DOMAIN_UNSCORABLE',
        'domains',
        'No domain has a scorable contribution for this assessment.',
      ),
    );
  const domainEnvironment = Object.fromEntries(
    domainResults.map((domain) => [
      domain.key,
      {
        value: domain.score ?? domain.points,
        weight:
          missingDomainPolicy === 'exclude-and-renormalize' &&
          domain.status === 'scored' &&
          scoredDomainWeight > 0
            ? domain.weight / scoredDomainWeight
            : domain.weight,
      },
    ]),
  );
  const adjustments: number[] = [];
  for (const rule of array(calculator.adjustmentRules).map(object)) {
    let adjustment: number | undefined;
    const bandParam = string(rule.bandParam);
    const optionParam = string(rule.optionParam);
    if (bandParam) {
      const value = number(getValue(values, bandParam));
      const edgeMode = string(rule.bandEdges) ?? 'min-inclusive';
      const band = array(rule.bands)
        .map(object)
        .find((candidate) => value !== undefined && bandMatches(candidate, value, edgeMode));
      adjustment = number(band?.points);
    } else if (optionParam) {
      const value = getValue(values, optionParam);
      const option = array(rule.optionPoints)
        .map(object)
        .find((candidate) => Object.is(candidate.value, value));
      adjustment = number(option?.points);
    }
    if (adjustment !== undefined) {
      adjustments.push(adjustment);
      trace.push({ kind: 'adjustment', key: string(rule.key) ?? 'adjustment', value: adjustment });
    }
  }
  let floorPenalty = 0;
  for (const rule of array(calculator.floorRules).map(object)) {
    if (!conditionMatches(rule.appliesWhen, values, aggregates, {})) continue;
    const tiers = array(rule.tiers).map(object);
    for (const tier of tiers) {
      const bandParam = string(tier.bandParam);
      const value = bandParam ? number(getValue(values, bandParam)) : undefined;
      const edgeMode =
        tier.minExclusive === true || tier.maxExclusive === true ? 'explicit' : 'min-inclusive';
      if (value === undefined || !bandMatches(tier, value, edgeMode)) continue;
      const tierFloor = number(tier.floorPct);
      if (tierFloor !== undefined) {
        floorPenalty = Math.max(floorPenalty, tierFloor);
        trace.push({
          kind: 'floor',
          key: string(rule.key) ?? 'floor',
          value: tierFloor,
          detail: { bandParam },
        });
      }
    }
  }
  const orderedFormulas = formulaOrder(array(calculator.formulas).map(object));
  if (orderedFormulas.cycle.length)
    errors.push(
      engineError(
        'EXPRESSION_ERROR',
        'formulas',
        `Formula dependency cycle detected at ${orderedFormulas.cycle.join(', ')}.`,
      ),
    );
  // Per-domain formulas run with a domain-local points/maxPoints scope. Their
  // values are retained on the domain snapshot and never leak into another
  // domain's namespace.
  for (let domainIndex = 0; domainIndex < domainResults.length; domainIndex += 1) {
    const domain = domainResults[domainIndex];
    if (!domain) continue;
    const directKeys = domain.parameterKeys.filter((key) => !aggregateMemberKeys.has(key));
    const localPoints = directKeys
      .map((key) => scoreByParameter.get(key))
      .filter((value): value is number => value !== undefined);
    const localEnvironment: Record<string, unknown> = {
      ...values,
      ...aggregates,
      points: localPoints,
      maxPoints: domain.possiblePoints,
      domains: domainEnvironment,
    };
    const localFormulas: Record<string, import('./types').Scalar> = {};
    for (const formula of orderedFormulas.order) {
      if (string(formula.scope) !== 'per-domain') continue;
      const key = string(formula.key);
      const expression = string(formula.expression);
      if (!key || !expression) continue;
      try {
        const value = scalar(
          evaluateExpression(expression, {
            values: localEnvironment,
            lookup: lookupResolver(calculator),
          }),
        );
        if (value === undefined) throw new Error('Per-domain formula must return a scalar value.');
        localFormulas[key] = value;
        localEnvironment[key] = value;
        localEnvironment[camelCase(key)] = value;
        trace.push({ kind: 'formula', key: `${domain.key}.${key}`, value });
      } catch (cause) {
        errors.push(
          engineError(
            'FORMULA_DOMAIN_ERROR',
            `domains.${domain.key}.formulas.${key}`,
            cause instanceof Error ? cause.message : String(cause),
          ),
        );
      }
    }
    if (Object.keys(localFormulas).length)
      domainResults[domainIndex] = { ...domain, formulas: localFormulas };
  }
  const formulaValues: Record<string, import('./types').Scalar> = {};
  const aggregateKeysInDomains = new Set(
    domainResults.flatMap((domain) =>
      domain.parameterKeys.filter((key) => aggregateMemberKeys.has(key)),
    ),
  );
  const consumedParameterKeys = new Set(
    [...aggregateKeysInDomains].flatMap(
      (aggregateKey) => aggregateMemberKeys.get(aggregateKey) ?? [],
    ),
  );
  const directFormulaPoints = [...scoreByParameter.entries()]
    .filter(([key]) => !consumedParameterKeys.has(key))
    .map(([, value]) => value);
  // Aggregates are exposed by their declared runtime symbol and are added by
  // the authored formula when required. Keeping them out of `points` prevents
  // the component members and the aggregate from being counted twice.
  const formulaPoints = directFormulaPoints;
  const formulaPossiblePoints =
    [...scoreByParameter.keys()]
      .filter((key) => !consumedParameterKeys.has(key))
      .reduce((total, key) => total + (possibleByParameter.get(key) ?? 0), 0) +
    [...aggregateKeysInDomains].reduce(
      (total, key) => total + (aggregatePossibleByKey.get(key) ?? 0),
      0,
    );
  const formulaEnvironment: Record<string, unknown> = {
    ...values,
    points: formulaPoints,
    adjustments,
    floorPenalty,
    domains: domainEnvironment,
    maxPoints: formulaPossiblePoints,
    ...aggregates,
  };
  for (const formula of orderedFormulas.order) {
    if (string(formula.scope) === 'per-domain') continue;
    const key = string(formula.key);
    const expression = string(formula.expression);
    if (!key || !expression) continue;
    try {
      const result = evaluateExpression(expression, {
        values: formulaEnvironment,
        lookup: lookupResolver(calculator),
      });
      const value = scalar(result);
      if (value === undefined) throw new Error('Formula must return a scalar value.');
      formulaValues[key] = value;
      formulaEnvironment[key] = value;
      formulaEnvironment[camelCase(key)] = value;
      trace.push({ kind: 'formula', key, value });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const code: import('./types').EngineError['code'] = /Lookup table|No lookup entry/i.test(
        message,
      )
        ? 'LOOKUP_MISS'
        : /Division by zero|domain|finite number|finite result|overflow/i.test(message)
          ? 'FORMULA_DOMAIN_ERROR'
          : 'EXPRESSION_ERROR';
      errors.push(engineError(code, `formulas.${key}`, message));
    }
  }
  const finalValue =
    number(formulaValues['final-score']) ?? number(formulaValues[camelCase('final-score')]);
  let resultScore = finalValue;
  let category: import('./types').EngineResult['category'];
  if (finalValue !== undefined) {
    const resultCategories = object(calculator.resultCategories);
    const scale = object(resultCategories.scale);
    const scaleMin = number(scale.min);
    const scaleMax = number(scale.max);
    const outsideScale =
      (scaleMin !== undefined && finalValue < scaleMin) ||
      (scaleMax !== undefined && finalValue > scaleMax);
    if (outsideScale && scale.clamp === true) {
      resultScore = Math.min(scaleMax ?? finalValue, Math.max(scaleMin ?? finalValue, finalValue));
      trace.push({
        kind: 'result',
        key: 'scale-clamp',
        value: resultScore,
        detail: { assertedValue: finalValue, min: scaleMin, max: scaleMax },
      });
    } else if (outsideScale) {
      errors.push(
        engineError(
          'SCALE_ASSERTION_FAILED',
          'resultCategories.scale',
          `Score ${finalValue} is outside the declared result scale.`,
        ),
      );
    }
    const bands = array(resultCategories.bands).map(object);
    let categoryIndex = bands.findIndex((band) =>
      bandMatches(
        band,
        resultScore ?? finalValue,
        string(resultCategories.bandEdges) ?? 'min-inclusive',
      ),
    );
    if (categoryIndex < 0)
      errors.push(
        engineError(
          'NO_BAND_MATCH',
          'resultCategories.bands',
          `No result category matches score ${finalValue}.`,
        ),
      );
    for (const override of array(resultCategories.overrides).map(object)) {
      if (!conditionMatches(override.when, values, aggregates, formulaValues)) continue;
      const targetIndex = bands.findIndex(
        (band) => string(band.label) === string(override.minCategory),
      );
      if (targetIndex >= 0 && categoryIndex >= 0)
        categoryIndex = Math.max(categoryIndex, targetIndex);
    }
    const selected = bands[categoryIndex];
    if (selected)
      category = {
        label: string(selected.label) ?? 'Uncategorized',
        color: string(selected.color),
        message: string(selected.message),
        recommendation: string(selected.recommendation),
      };
    trace.push({
      kind: 'result',
      key: 'final-score',
      value: resultScore,
      detail: { category: category?.label },
    });
  }
  const aggregateCoverage = [...aggregateMemberKeys.keys()].map((key) => ({
    key,
    earnedPoints: number(aggregates[key]),
    possiblePoints: aggregatePossibleByKey.get(key) ?? 0,
    scored: aggregates[key] !== undefined,
    missing: aggregates[key] === undefined,
  }));
  const coverage = buildCoverageSummary(
    parameterResults,
    domainResults,
    sourceGapKeys,
    sourceGapReferences,
    aggregateCoverage,
  );
  const harmful = parameterResults
    .filter((parameter) => (parameter.points ?? 0) > 0)
    .sort((left, right) => {
      const difference = (right.points ?? 0) - (left.points ?? 0);
      return difference || left.key.localeCompare(right.key);
    });
  const protective = parameterResults
    .filter((parameter) => (parameter.points ?? 0) < 0)
    .sort((left, right) => {
      const difference = (left.points ?? 0) - (right.points ?? 0);
      return difference || left.key.localeCompare(right.key);
    });
  return {
    ok: errors.length === 0,
    calculatorSlug: slug,
    version,
    score: errors.length === 0 ? resultScore : undefined,
    category,
    parameters: parameterResults,
    domains: domainResults,
    coverage,
    contributors: { harmful, protective },
    formulas: formulaValues,
    errors,
    warnings,
    trace:
      options.includeTrace === false
        ? []
        : trace.map((step, index) => ({ ...step, sequence: index + 1, stage: step.kind })),
  };
}

export const calculate = executeCalculator;
