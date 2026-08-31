import { createInitialRendererState } from './reducer';
import { orderedRenderableParameters } from './structure';
import type {
  PublicCalculatorConfig,
  PublicParameterConfig,
  PublicScalar,
  RendererState,
} from './types';
import { canSkipParameter, validateParameter } from './validation';
import { unitChoice } from './units';

export interface StorageLike {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

interface StoredProgress {
  readonly schemaVersion: 1;
  readonly calculatorSlug: string;
  readonly calculatorVersion: number;
  readonly values: Readonly<Record<string, PublicScalar>>;
  readonly units: Readonly<Record<string, string>>;
  readonly skipped: Readonly<Record<string, boolean>>;
  readonly currentStep: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function progressStorageKey(config: PublicCalculatorConfig): string {
  return `niro:calculator-progress:v1:${encodeURIComponent(config.calculatorSlug)}@${config.version}`;
}

function validRestoredValue(
  parameter: PublicParameterConfig,
  value: unknown,
): value is PublicScalar {
  if (parameter.inputType === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (parameter.inputType === 'boolean') return typeof value === 'boolean';
  if (parameter.inputType === 'select') {
    return parameter.options?.some((option) => Object.is(option.value, value)) ?? false;
  }
  return false;
}

function decodeProgress(config: PublicCalculatorConfig, value: unknown): RendererState | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.schemaVersion !== 1 ||
    value.calculatorSlug !== config.calculatorSlug ||
    value.calculatorVersion !== config.version ||
    !isRecord(value.values) ||
    !isRecord(value.units) ||
    !isRecord(value.skipped) ||
    typeof value.currentStep !== 'number' ||
    !Number.isInteger(value.currentStep)
  ) {
    return undefined;
  }

  const initial = createInitialRendererState(config);
  const values: Record<string, PublicScalar> = {};
  const units = { ...initial.units };
  const skipped: Record<string, boolean> = {};
  for (const parameter of orderedRenderableParameters(config)) {
    const restoredValue = value.values[parameter.key];
    if (validRestoredValue(parameter, restoredValue)) values[parameter.key] = restoredValue;

    const restoredUnit = value.units[parameter.key];
    if (
      parameter.inputType === 'number' &&
      parameter.unit &&
      typeof restoredUnit === 'string' &&
      unitChoice(parameter.unit, restoredUnit)
    ) {
      units[parameter.key] = restoredUnit;
    }
    if (value.skipped[parameter.key] === true && canSkipParameter(parameter)) {
      skipped[parameter.key] = true;
    }
  }

  // Treat persisted browser data as untrusted. Keep soft-warning values, but
  // discard any restored answer that no longer passes the published hard
  // validation contract for this exact version and selected unit.
  for (const parameter of orderedRenderableParameters(config)) {
    if (values[parameter.key] === undefined || skipped[parameter.key] === true) continue;
    const finding = validateParameter(
      parameter,
      values[parameter.key],
      units[parameter.key],
      false,
    );
    if (finding.error) delete values[parameter.key];
  }

  const lastStep = Math.max(0, config.uiConfig.steps.length - 1);
  return {
    values,
    units,
    skipped,
    errors: {},
    currentStep: Math.min(Math.max(0, value.currentStep), lastStep),
  };
}

export function restoreProgress(
  storage: StorageLike,
  config: PublicCalculatorConfig,
): RendererState | undefined {
  const key = progressStorageKey(config);
  try {
    const source = storage.getItem(key);
    if (source === null) return undefined;
    const decoded = decodeProgress(config, JSON.parse(source));
    if (!decoded) storage.removeItem(key);
    return decoded;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be disabled. The renderer remains fully usable in memory.
    }
    return undefined;
  }
}

export function saveProgress(
  storage: StorageLike,
  config: PublicCalculatorConfig,
  state: RendererState,
): boolean {
  const initial = createInitialRendererState(config);
  const initialUnitKeys = Object.keys(initial.units);
  const unitsAreInitial =
    Object.keys(state.units).length === initialUnitKeys.length &&
    initialUnitKeys.every((key) => state.units[key] === initial.units[key]);
  if (
    Object.keys(state.values).length === 0 &&
    !Object.values(state.skipped).some((skipped) => skipped) &&
    state.currentStep === 0 &&
    unitsAreInitial
  ) {
    return clearProgress(storage, config);
  }
  const progress: StoredProgress = {
    schemaVersion: 1,
    calculatorSlug: config.calculatorSlug,
    calculatorVersion: config.version,
    values: state.values,
    units: state.units,
    skipped: state.skipped,
    currentStep: state.currentStep,
  };
  try {
    storage.setItem(progressStorageKey(config), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage: StorageLike, config: PublicCalculatorConfig): boolean {
  try {
    storage.removeItem(progressStorageKey(config));
    return true;
  } catch {
    return false;
  }
}
