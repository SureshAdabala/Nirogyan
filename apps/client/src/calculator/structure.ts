import { isConditionVisible, valuesForVisibility } from './conditions';
import { toCanonicalUnit } from './units';
import type {
  PublicCalculatorConfig,
  PublicCalculatorStep,
  PublicParameterConfig,
  RendererState,
} from './types';

export interface ParameterGroup {
  readonly key: string;
  readonly parameters: readonly PublicParameterConfig[];
}

function compareParameters(left: PublicParameterConfig, right: PublicParameterConfig): number {
  return left.order - right.order || left.key.localeCompare(right.key, 'en');
}

export function groupsForStep(
  config: PublicCalculatorConfig,
  step: PublicCalculatorStep,
): readonly ParameterGroup[] {
  return step.parameterGroups.map((group) => ({
    key: group,
    parameters: config.parameters
      .filter((parameter) => parameter.inputType !== 'derived' && parameter.group === group)
      .sort(compareParameters),
  }));
}

export function orderedRenderableParameters(
  config: PublicCalculatorConfig,
): readonly PublicParameterConfig[] {
  const seen = new Set<string>();
  return config.uiConfig.steps.flatMap((step) =>
    groupsForStep(config, step).flatMap((group) =>
      group.parameters.filter((parameter) => {
        if (seen.has(parameter.key)) return false;
        seen.add(parameter.key);
        return true;
      }),
    ),
  );
}

export function visibleParameterKeys(
  config: PublicCalculatorConfig,
  state: RendererState,
): ReadonlySet<string> {
  const enteredValues = valuesForVisibility(state.values, state.skipped);
  // The authoritative engine evaluates applicability after unit
  // normalization. Mirror that ordering so a condition threshold has the
  // same meaning regardless of the unit currently displayed in the browser.
  const values = { ...enteredValues };
  for (const parameter of config.parameters) {
    const entered = enteredValues[parameter.key];
    if (parameter.inputType !== 'number' || typeof entered !== 'number') continue;
    const canonical = toCanonicalUnit(entered, state.units[parameter.key], parameter.unit);
    if (canonical === undefined) delete values[parameter.key];
    else values[parameter.key] = canonical;
  }
  return new Set(
    orderedRenderableParameters(config)
      .filter((parameter) => isConditionVisible(parameter.visibility, values))
      .map((parameter) => parameter.key),
  );
}

export function parameterStepIndex(
  config: PublicCalculatorConfig,
  parameterKey: string,
): number | undefined {
  const parameter = config.parameters.find((candidate) => candidate.key === parameterKey);
  if (!parameter || parameter.inputType === 'derived') return undefined;
  const index = config.uiConfig.steps.findIndex((step) =>
    step.parameterGroups.includes(parameter.group),
  );
  return index < 0 ? undefined : index;
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return spaced.length ? `${spaced[0]?.toUpperCase() ?? ''}${spaced.slice(1)}` : key;
}
