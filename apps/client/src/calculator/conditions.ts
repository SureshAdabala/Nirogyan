import type { PublicCondition, PublicScalar } from './types';

export type ConditionTruth = true | false | 'unknown';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function combineAll(values: readonly ConditionTruth[]): ConditionTruth {
  if (values.some((value) => value === false)) return false;
  return values.some((value) => value === 'unknown') ? 'unknown' : true;
}

function combineAny(values: readonly ConditionTruth[]): ConditionTruth {
  if (values.some((value) => value === true)) return true;
  return values.some((value) => value === 'unknown') ? 'unknown' : false;
}

function evaluatePredicate(
  predicate: Record<string, unknown>,
  values: Readonly<Record<string, PublicScalar>>,
): ConditionTruth {
  // Aggregate and formula values are unavailable at the browser visibility
  // stage. Preserve a tri-state result so `not` cannot accidentally reveal a
  // clinically gated field when its source is unavailable.
  if ('aggregate' in predicate || 'formula' in predicate) return 'unknown';
  if (typeof predicate.param !== 'string' || typeof predicate.op !== 'string') return 'unknown';

  const actual = values[predicate.param];
  const missing = actual === undefined;
  if (predicate.op === 'exists') return !missing;
  if (predicate.op === 'missing') return missing;
  if (missing) return false;

  const expected = predicate.value;
  if (predicate.op === 'in' || predicate.op === 'not-in') {
    if (!Array.isArray(expected)) return 'unknown';
    const found = expected.some((candidate) => Object.is(actual, candidate));
    return predicate.op === 'in' ? found : !found;
  }
  if (predicate.op === 'eq') return Object.is(actual, expected);
  if (predicate.op === 'ne') return !Object.is(actual, expected);
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  if (predicate.op === 'gt') return actual > expected;
  if (predicate.op === 'gte') return actual >= expected;
  if (predicate.op === 'lt') return actual < expected;
  if (predicate.op === 'lte') return actual <= expected;
  return 'unknown';
}

export function evaluateCondition(
  condition: PublicCondition | unknown,
  values: Readonly<Record<string, PublicScalar>>,
): ConditionTruth {
  if (!isRecord(condition)) return 'unknown';
  if (condition.unavailable === true) return 'unknown';
  if ('all' in condition) {
    if (!Array.isArray(condition.all) || condition.all.length === 0) return 'unknown';
    return combineAll(condition.all.map((item) => evaluateCondition(item, values)));
  }
  if ('any' in condition) {
    if (!Array.isArray(condition.any) || condition.any.length === 0) return 'unknown';
    return combineAny(condition.any.map((item) => evaluateCondition(item, values)));
  }
  if ('not' in condition) {
    const result = evaluateCondition(condition.not, values);
    return result === 'unknown' ? 'unknown' : !result;
  }
  return evaluatePredicate(condition, values);
}

export function isConditionVisible(
  condition: PublicCondition | undefined,
  values: Readonly<Record<string, PublicScalar>>,
): boolean {
  return condition === undefined || evaluateCondition(condition, values) === true;
}

export function valuesForVisibility(
  values: Readonly<Record<string, PublicScalar>>,
  skipped: Readonly<Record<string, boolean>>,
): Readonly<Record<string, PublicScalar>> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => skipped[key] !== true));
}
