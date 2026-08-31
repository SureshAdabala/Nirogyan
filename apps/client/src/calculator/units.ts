import type { PublicUnitChoice, PublicUnitConfig } from './types';

export interface NormalizedUnitChoice {
  readonly code: string;
  readonly factor: number;
  readonly offset: number;
}

function validChoice(choice: NormalizedUnitChoice): boolean {
  return (
    choice.code.length > 0 &&
    Number.isFinite(choice.factor) &&
    choice.factor > 0 &&
    Number.isFinite(choice.offset)
  );
}

function normalizeChoice(choice: PublicUnitChoice): NormalizedUnitChoice {
  return { code: choice.code, factor: choice.factor, offset: choice.offset ?? 0 };
}

export function availableUnits(
  unit: PublicUnitConfig | undefined,
): readonly NormalizedUnitChoice[] {
  if (!unit) return [];
  const identity: NormalizedUnitChoice = { code: unit.canonical, factor: 1, offset: 0 };
  const seen = new Set([unit.canonical]);
  const choices = [identity];
  for (const configured of unit.allowed ?? []) {
    const choice = normalizeChoice(configured);
    if (seen.has(choice.code) || !validChoice(choice)) continue;
    seen.add(choice.code);
    choices.push(choice);
  }
  return validChoice(identity) ? choices : [];
}

export function unitChoice(
  unit: PublicUnitConfig | undefined,
  code: string | undefined,
): NormalizedUnitChoice | undefined {
  if (!unit) return undefined;
  const selected = code ?? unit.canonical;
  return availableUnits(unit).find((choice) => choice.code === selected);
}

/** Apply the locked v1 direction: canonical = entered * factor + offset. */
export function toCanonicalUnit(
  enteredValue: number,
  enteredUnit: string | undefined,
  unit: PublicUnitConfig | undefined,
): number | undefined {
  if (!Number.isFinite(enteredValue)) return undefined;
  if (!unit) return enteredValue;
  const choice = unitChoice(unit, enteredUnit);
  if (!choice) return undefined;
  const canonical = enteredValue * choice.factor + choice.offset;
  return Number.isFinite(canonical) ? canonical : undefined;
}

export function fromCanonicalUnit(
  canonicalValue: number,
  displayUnit: string | undefined,
  unit: PublicUnitConfig | undefined,
): number | undefined {
  if (!Number.isFinite(canonicalValue)) return undefined;
  if (!unit) return canonicalValue;
  const choice = unitChoice(unit, displayUnit);
  if (!choice) return undefined;
  const entered = (canonicalValue - choice.offset) / choice.factor;
  return Number.isFinite(entered) ? entered : undefined;
}

/**
 * Preserve the physical quantity when a user changes display units. No
 * rounding is performed; formatting is a presentation-only responsibility.
 */
export function switchEnteredUnit(
  enteredValue: number | undefined,
  fromUnit: string | undefined,
  toUnit: string,
  unit: PublicUnitConfig | undefined,
): number | undefined {
  if (enteredValue === undefined) return undefined;
  const canonical = toCanonicalUnit(enteredValue, fromUnit, unit);
  return canonical === undefined ? undefined : fromCanonicalUnit(canonical, toUnit, unit);
}

export function displayBound(
  canonicalBound: number | undefined,
  displayUnit: string | undefined,
  unit: PublicUnitConfig | undefined,
): number | undefined {
  return canonicalBound === undefined
    ? undefined
    : fromCanonicalUnit(canonicalBound, displayUnit, unit);
}
