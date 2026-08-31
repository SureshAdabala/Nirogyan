import type { PublicCalculatorConfig, PublicScalar, RendererState } from './types';

export type RendererAction =
  | { readonly type: 'set-value'; readonly key: string; readonly value: PublicScalar | undefined }
  | {
      readonly type: 'set-unit-and-value';
      readonly key: string;
      readonly unit: string;
      readonly value: number | undefined;
    }
  | { readonly type: 'set-skipped'; readonly key: string; readonly skipped: boolean }
  | { readonly type: 'set-current-step'; readonly currentStep: number }
  | { readonly type: 'replace-errors'; readonly errors: Readonly<Record<string, string>> }
  | {
      readonly type: 'replace-errors-for-keys';
      readonly keys: readonly string[];
      readonly errors: Readonly<Record<string, string>>;
    }
  | { readonly type: 'restore'; readonly state: RendererState }
  | { readonly type: 'reset'; readonly state: RendererState };

function withoutKey<T>(source: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...source };
  delete next[key];
  return next;
}

function setOptionalValue(
  source: Readonly<Record<string, PublicScalar>>,
  key: string,
  value: PublicScalar | undefined,
): Record<string, PublicScalar> {
  return value === undefined ? withoutKey(source, key) : { ...source, [key]: value };
}

export function createInitialRendererState(config: PublicCalculatorConfig): RendererState {
  return {
    values: {},
    units: Object.fromEntries(
      config.parameters.flatMap((parameter) =>
        parameter.inputType === 'number' && parameter.unit
          ? [[parameter.key, parameter.unit.canonical] as const]
          : [],
      ),
    ),
    skipped: {},
    errors: {},
    currentStep: 0,
  };
}

export function rendererReducer(state: RendererState, action: RendererAction): RendererState {
  if (action.type === 'set-value') {
    return {
      ...state,
      values: setOptionalValue(state.values, action.key, action.value),
      errors: withoutKey(state.errors, action.key),
    };
  }
  if (action.type === 'set-unit-and-value') {
    return {
      ...state,
      units: { ...state.units, [action.key]: action.unit },
      values: setOptionalValue(state.values, action.key, action.value),
      errors: withoutKey(state.errors, action.key),
    };
  }
  if (action.type === 'set-skipped') {
    return {
      ...state,
      skipped: action.skipped
        ? { ...state.skipped, [action.key]: true }
        : withoutKey(state.skipped, action.key),
      errors: withoutKey(state.errors, action.key),
    };
  }
  if (action.type === 'set-current-step') {
    return { ...state, currentStep: action.currentStep };
  }
  if (action.type === 'replace-errors') return { ...state, errors: { ...action.errors } };
  if (action.type === 'replace-errors-for-keys') {
    const errors = { ...state.errors };
    for (const key of action.keys) delete errors[key];
    Object.assign(errors, action.errors);
    return { ...state, errors };
  }
  return action.state;
}
