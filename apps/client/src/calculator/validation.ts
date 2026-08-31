import { toCanonicalUnit, unitChoice } from './units';
import type {
  PublicMissingPolicy,
  PublicParameterConfig,
  PublicScalar,
  RendererState,
} from './types';

export interface FieldValidationResult {
  readonly error?: string;
  readonly warning?: string;
}

const SKIPPABLE_POLICIES = new Set<PublicMissingPolicy>([
  'default-option',
  'impute-rule',
  'exclude-from-max',
  'exclude-from-group',
  'zero-points',
  'not-applicable',
]);

export function canSkipParameter(parameter: PublicParameterConfig): boolean {
  return (
    parameter.inputType !== 'derived' &&
    parameter.validation?.required !== true &&
    parameter.missingPolicy !== undefined &&
    SKIPPABLE_POLICIES.has(parameter.missingPolicy)
  );
}

function isMissing(value: PublicScalar | undefined): boolean {
  return value === undefined || value === '';
}

function required(parameter: PublicParameterConfig): boolean {
  return parameter.validation?.required === true || parameter.missingPolicy === 'block';
}

export function validateParameter(
  parameter: PublicParameterConfig,
  value: PublicScalar | undefined,
  selectedUnit: string | undefined,
  skipped: boolean,
): FieldValidationResult {
  if (parameter.inputType === 'derived') return {};
  if (skipped) {
    return canSkipParameter(parameter) ? {} : { error: `${parameter.label} cannot be skipped.` };
  }
  if (isMissing(value)) {
    return required(parameter) ? { error: `${parameter.label} is required.` } : {};
  }

  if (parameter.inputType === 'boolean') {
    return typeof value === 'boolean' ? {} : { error: `Choose Yes or No for ${parameter.label}.` };
  }

  if (parameter.inputType === 'select') {
    const configured = parameter.options?.some((option) => Object.is(option.value, value)) ?? false;
    return configured ? {} : { error: `Choose a valid option for ${parameter.label}.` };
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: `Enter a finite number for ${parameter.label}.` };
  }
  if (parameter.unit && !unitChoice(parameter.unit, selectedUnit)) {
    return { error: `Choose a valid unit for ${parameter.label}.` };
  }
  const canonical = toCanonicalUnit(value, selectedUnit, parameter.unit);
  if (canonical === undefined) {
    return { error: `Enter a valid value and unit for ${parameter.label}.` };
  }

  const validation = parameter.validation;
  const unitLabel = parameter.unit ? ` ${parameter.unit.canonical}` : '';
  if (validation?.min !== undefined && canonical < validation.min) {
    return { error: `${parameter.label} must be at least ${validation.min}${unitLabel}.` };
  }
  if (validation?.max !== undefined && canonical > validation.max) {
    return { error: `${parameter.label} must be at most ${validation.max}${unitLabel}.` };
  }
  if (validation?.integer === true && !Number.isInteger(canonical)) {
    return { error: `${parameter.label} must resolve to a whole number.` };
  }

  if (validation?.softMin !== undefined && canonical < validation.softMin) {
    return { warning: `${parameter.label} is unusually low. Double-check the value and unit.` };
  }
  if (validation?.softMax !== undefined && canonical > validation.softMax) {
    return { warning: `${parameter.label} is unusually high. Double-check the value and unit.` };
  }
  return {};
}

export function validateParameterSet(
  parameters: readonly PublicParameterConfig[],
  state: RendererState,
): {
  readonly errors: Readonly<Record<string, string>>;
  readonly warnings: Readonly<Record<string, string>>;
} {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  for (const parameter of parameters) {
    const result = validateParameter(
      parameter,
      state.values[parameter.key],
      state.units[parameter.key],
      state.skipped[parameter.key] === true,
    );
    if (result.error) errors[parameter.key] = result.error;
    if (result.warning) warnings[parameter.key] = result.warning;
  }
  return { errors, warnings };
}
