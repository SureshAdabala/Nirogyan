import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { calculate } from './index';

type JsonObject = Record<string, unknown>;

interface SourceFixture {
  readonly fileName: string;
  readonly config: JsonObject;
}

interface BandClassification {
  readonly outcome: 'unique' | 'gap' | 'overlap';
  readonly matches: readonly JsonObject[];
}

const fixtureDirectory = resolve(__dirname, '..', '..', '..', 'data', 'fixtures', 'config-samples');

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): readonly JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function freezeDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
  } else {
    for (const item of Object.values(value as JsonObject)) freezeDeep(item);
  }
  return Object.freeze(value);
}

const sourceFixtures: readonly SourceFixture[] = readdirSync(fixtureDirectory)
  .filter((fileName) => fileName.endsWith('.config.json'))
  .sort()
  .map((fileName) => ({
    fileName,
    config: freezeDeep(
      JSON.parse(readFileSync(resolve(fixtureDirectory, fileName), 'utf8')),
    ) as JsonObject,
  }));

function parameters(config: JsonObject): readonly JsonObject[] {
  return objects(config.parameters);
}

function scoringRules(config: JsonObject): readonly JsonObject[] {
  return objects(config.scoringRules);
}

function parameter(config: JsonObject, key: string): JsonObject {
  const found = parameters(config).find((candidate) => text(candidate.key) === key);
  if (!found) throw new Error(`Fixture does not define parameter ${key}.`);
  return found;
}

function decimalPlaces(value: number): number {
  const rendered = value.toString().toLowerCase();
  if (rendered.includes('e-')) {
    const [coefficient = '', exponent = '0'] = rendered.split('e-');
    return Number(exponent) + (coefficient.split('.')[1]?.length ?? 0);
  }
  return rendered.split('.')[1]?.length ?? 0;
}

function epsilon(values: readonly number[]): number {
  const precision = Math.max(0, ...values.map(decimalPlaces));
  return 10 ** -Math.min(8, precision + 2);
}

function rounded(value: number): number {
  return Number(value.toFixed(10));
}

/** Test oracle for the frozen engine edge contract; it is not a clinical rule. */
function bandMatches(band: JsonObject, value: number, defaultEdges: string): boolean {
  const min = finiteNumber(band.min);
  const max = finiteNumber(band.max);
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

function classifyBands(
  bands: readonly JsonObject[],
  value: number,
  defaultEdges: string,
): BandClassification {
  const matches = bands.filter((band) => bandMatches(band, value, defaultEdges));
  return {
    outcome: matches.length === 0 ? 'gap' : matches.length === 1 ? 'unique' : 'overlap',
    matches,
  };
}

function boundaryCandidates(
  bands: readonly JsonObject[],
  bounds: JsonObject = {},
  includeOutsideBounds = false,
): readonly number[] {
  const min = finiteNumber(bounds.min);
  const max = finiteNumber(bounds.max);
  const edges = bands.flatMap((band) =>
    [finiteNumber(band.min), finiteNumber(band.max)].filter(
      (candidate): candidate is number => candidate !== undefined,
    ),
  );
  const anchors = [
    ...edges,
    ...(min === undefined ? [] : [min]),
    ...(max === undefined ? [] : [max]),
  ];
  const step = epsilon(anchors);
  const candidates = new Set<number>();
  const withinBounds = (value: number): boolean =>
    (includeOutsideBounds || min === undefined || value >= min) &&
    (includeOutsideBounds || max === undefined || value <= max);
  for (const edge of anchors) {
    for (const candidate of [edge - step, edge, edge + step]) {
      if (withinBounds(candidate)) candidates.add(rounded(candidate));
    }
  }
  const sorted = [...new Set(anchors)].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    const left = sorted[index - 1];
    const right = sorted[index];
    if (left !== undefined && right !== undefined && right > left) {
      const midpoint = rounded((left + right) / 2);
      if (withinBounds(midpoint)) candidates.add(midpoint);
    }
  }
  return [...candidates].sort((left, right) => left - right);
}

function conditionParameterKeys(condition: unknown, keys = new Set<string>()): Set<string> {
  const node = object(condition);
  const key = text(node.param);
  if (key) keys.add(key);
  for (const child of [...objects(node.all), ...objects(node.any)]) {
    conditionParameterKeys(child, keys);
  }
  if (node.not !== undefined) conditionParameterKeys(node.not, keys);
  return keys;
}

/** Test oracle for context selection, including the frozen missing-is-unknown rule. */
function conditionMatches(condition: unknown, values: Readonly<JsonObject>): boolean {
  if (condition === null || condition === undefined) return true;
  const node = object(condition);
  if (Array.isArray(node.all)) return node.all.every((child) => conditionMatches(child, values));
  if (Array.isArray(node.any)) return node.any.some((child) => conditionMatches(child, values));
  if (node.not !== undefined) return !conditionMatches(node.not, values);
  const key = text(node.param);
  const source = key ? values[key] : undefined;
  const op = text(node.op);
  if (op === 'exists') return !isMissing(source);
  if (op === 'missing') return isMissing(source);
  if (isMissing(source)) return false;
  if (op === 'in' || op === 'not-in') {
    const candidates = Array.isArray(node.value) ? node.value : [node.value];
    const found = candidates.some((candidate) => Object.is(source, candidate));
    return op === 'in' ? found : !found;
  }
  if (op === 'eq') return Object.is(source, node.value);
  if (op === 'ne') return !Object.is(source, node.value);
  if (typeof source !== 'number' || typeof node.value !== 'number') return false;
  if (op === 'gt') return source > node.value;
  if (op === 'gte') return source >= node.value;
  if (op === 'lt') return source < node.value;
  if (op === 'lte') return source <= node.value;
  return false;
}

function possibleValues(
  definition: JsonObject,
  includeOptionalAbsence = false,
): readonly unknown[] {
  let values: readonly unknown[];
  if (definition.inputType === 'boolean') values = [false, true];
  else if (definition.inputType === 'select')
    values = objects(definition.options).map((item) => item.value);
  else {
    const validation = object(definition.validation);
    const min = finiteNumber(validation.min);
    const max = finiteNumber(validation.max);
    values = min !== undefined && max !== undefined ? [rounded((min + max) / 2)] : [0];
  }
  const required = object(definition.validation).required === true;
  return includeOptionalAbsence && !required ? [...values, undefined] : values;
}

function satisfyingInputs(config: JsonObject, condition: unknown): JsonObject {
  const node = object(condition);
  if (Array.isArray(node.all))
    return Object.assign({}, ...node.all.map((child) => satisfyingInputs(config, child)));
  if (Array.isArray(node.any)) return satisfyingInputs(config, node.any[0]);
  if (node.not !== undefined)
    throw new Error('Fixture matrix needs an explicit not-condition solver.');
  const key = text(node.param);
  if (!key) return {};
  const definition = parameter(config, key);
  const domain = possibleValues(definition);
  const op = text(node.op);
  if (op === 'missing') return {};
  if (op === 'exists') return { [key]: domain[0] };
  if (op === 'eq') return { [key]: node.value };
  if (op === 'ne') {
    const alternative = domain.find((candidate) => !Object.is(candidate, node.value));
    if (alternative === undefined) throw new Error(`No source-authored alternative for ${key}.`);
    return { [key]: alternative };
  }
  const expected = finiteNumber(node.value);
  if (expected === undefined) throw new Error(`Unsupported source condition for ${key}.`);
  const step = epsilon([expected]);
  if (op === 'gt') return { [key]: expected + step };
  if (op === 'gte') return { [key]: expected };
  if (op === 'lt') return { [key]: expected - step };
  if (op === 'lte') return { [key]: expected };
  throw new Error(`Unsupported source condition operator ${String(op)}.`);
}

function cartesianAssignments(
  definitions: readonly JsonObject[],
  index = 0,
  current: JsonObject = {},
): readonly JsonObject[] {
  const definition = definitions[index];
  if (!definition) return [{ ...current }];
  const key = text(definition.key);
  if (!key) return cartesianAssignments(definitions, index + 1, current);
  return possibleValues(definition, true).flatMap((value) => {
    const next = { ...current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return cartesianAssignments(definitions, index + 1, next);
  });
}

function valuesAfterVisibility(definitions: readonly JsonObject[], inputs: JsonObject): JsonObject {
  const values = { ...inputs };
  for (const definition of definitions) {
    const key = text(definition.key);
    if (
      key &&
      definition.visibility !== undefined &&
      !conditionMatches(definition.visibility, values)
    ) {
      delete values[key];
    }
  }
  return values;
}

function isolatedScoringConfig(config: JsonObject, rule: JsonObject): JsonObject {
  const key = text(rule.parameterKey);
  if (!key) throw new Error('Scoring rule is missing parameterKey.');
  const dependencyKeys = new Set<string>();
  for (const context of objects(rule.contexts))
    conditionParameterKeys(context.when, dependencyKeys);
  const sourceTarget = parameter(config, key);
  const target =
    sourceTarget.inputType === 'derived'
      ? { ...sourceTarget, inputType: 'number', derived: undefined }
      : sourceTarget;
  return {
    calculatorSlug: text(config.calculatorSlug),
    version: finiteNumber(config.version),
    parameters: [target, ...[...dependencyKeys].map((item) => parameter(config, item))],
    scoringRules: [rule],
    resultCategories: { bandEdges: object(config.resultCategories).bandEdges },
  };
}

function valueInsideBand(band: JsonObject, definition: JsonObject, defaultEdges: string): number {
  const validation = object(definition.validation);
  const bandMin = finiteNumber(band.min);
  const bandMax = finiteNumber(band.max);
  const validationMin = finiteNumber(validation.min);
  const validationMax = finiteNumber(validation.max);
  const numericEdges = [bandMin, bandMax, validationMin, validationMax].filter(
    (candidate): candidate is number => candidate !== undefined,
  );
  const step = epsilon(numericEdges);
  let low = Math.max(
    bandMin ?? Number.NEGATIVE_INFINITY,
    validationMin ?? Number.NEGATIVE_INFINITY,
  );
  let high = Math.min(
    bandMax ?? Number.POSITIVE_INFINITY,
    validationMax ?? Number.POSITIVE_INFINITY,
  );
  if (bandMin !== undefined && !bandMatches(band, bandMin, defaultEdges)) low = bandMin + step;
  if (bandMax !== undefined && !bandMatches(band, bandMax, defaultEdges)) high = bandMax - step;
  let candidate: number;
  if (Number.isFinite(low) && Number.isFinite(high)) candidate = (low + high) / 2;
  else if (Number.isFinite(low)) candidate = low + step;
  else if (Number.isFinite(high)) candidate = high - step;
  else candidate = 0;
  candidate = rounded(candidate);
  if (!bandMatches(band, candidate, defaultEdges)) {
    throw new Error(
      `Could not derive a source-valid representative for ${String(definition.key)}.`,
    );
  }
  return candidate;
}

function selectedContext(rule: JsonObject, values: JsonObject): JsonObject | undefined {
  const contexts = objects(rule.contexts);
  const explicit = contexts.filter(
    (context) =>
      context.when !== null && context.when !== undefined && conditionMatches(context.when, values),
  );
  if (explicit.length !== 1 && explicit.length > 0) return undefined;
  return explicit[0] ?? contexts.find((context) => context.when === null);
}

function baselineInputs(config: JsonObject, maximizePoints = false): JsonObject {
  const inputs: JsonObject = {};
  const rules = new Map(
    scoringRules(config)
      .map((rule) => [text(rule.parameterKey), rule] as const)
      .filter((entry): entry is readonly [string, JsonObject] => entry[0] !== undefined),
  );
  for (const definition of parameters(config)) {
    const key = text(definition.key);
    if (!key || definition.inputType === 'derived') continue;
    const rule = rules.get(key);
    if (definition.inputType === 'select') {
      const options = objects(definition.options);
      const authoredScores = objects(rule?.optionPoints);
      const selected =
        maximizePoints && authoredScores.length
          ? [...authoredScores].sort(
              (left, right) => (finiteNumber(right.points) ?? 0) - (finiteNumber(left.points) ?? 0),
            )[0]?.value
          : options[0]?.value;
      if (selected !== undefined) inputs[key] = selected;
    } else if (definition.inputType === 'boolean') {
      const authoredScores = objects(rule?.optionPoints);
      const selected =
        maximizePoints && authoredScores.length
          ? [...authoredScores].sort(
              (left, right) => (finiteNumber(right.points) ?? 0) - (finiteNumber(left.points) ?? 0),
            )[0]?.value
          : false;
      inputs[key] = typeof selected === 'boolean' ? selected : false;
    } else if (definition.inputType === 'number') {
      const validation = object(definition.validation);
      const min = finiteNumber(validation.min);
      const max = finiteNumber(validation.max);
      inputs[key] =
        min !== undefined && max !== undefined ? rounded((min + max) / 2) : (min ?? max ?? 0);
    }
  }
  const visibleValues = valuesAfterVisibility(parameters(config), inputs);
  for (const [key, rule] of rules) {
    if (Array.isArray(rule.optionPoints)) continue;
    const definition = parameter(config, key);
    if (definition.inputType !== 'number') continue;
    const context = selectedContext(rule, visibleValues);
    const bands = objects(context?.bands);
    if (!bands.length) continue;
    const ordered = maximizePoints
      ? [...bands].sort(
          (left, right) => (finiteNumber(right.points) ?? 0) - (finiteNumber(left.points) ?? 0),
        )
      : bands;
    const edges =
      text(rule.bandEdges) ?? text(object(config.resultCategories).bandEdges) ?? 'min-inclusive';
    inputs[key] = valueInsideBand(ordered[0] ?? {}, definition, edges);
  }
  return inputs;
}

function effectiveMissingPolicy(definition: JsonObject): string {
  return (
    text(definition.missingPolicy) ??
    (object(definition.validation).required === true ? 'block' : 'exclude-from-group')
  );
}

function derivedDependencies(definition: JsonObject): readonly string[] {
  const dependsOn = object(definition.derived).dependsOn;
  return Array.isArray(dependsOn)
    ? dependsOn.map(text).filter((item): item is string => item !== undefined)
    : [];
}

function withoutKeys(inputs: JsonObject, keys: readonly string[]): JsonObject {
  const result = { ...inputs };
  for (const key of keys) delete result[key];
  return result;
}

describe('P10 source-fixture boundary matrices', () => {
  it('loads exactly the five immutable draft fixtures', () => {
    expect(sourceFixtures).toHaveLength(5);
    for (const fixture of sourceFixtures) {
      expect(fixture.config.status, fixture.fileName).toBe('draft');
      expect(Object.isFrozen(fixture.config), fixture.fileName).toBe(true);
    }
  });

  it('probes every numeric scoring edge and preserves uncovered ranges as NO_SCORING_BAND', () => {
    let cases = 0;
    let gaps = 0;
    for (const fixture of sourceFixtures) {
      for (const rule of scoringRules(fixture.config)) {
        const key = text(rule.parameterKey);
        if (!key || Array.isArray(rule.optionPoints)) continue;
        const definition = parameter(fixture.config, key);
        const validation = object(definition.validation);
        const edges =
          text(rule.bandEdges) ??
          text(object(fixture.config.resultCategories).bandEdges) ??
          'min-inclusive';
        const probeConfig = isolatedScoringConfig(fixture.config, rule);
        for (const [contextIndex, context] of objects(rule.contexts).entries()) {
          const contextInputs = satisfyingInputs(fixture.config, context.when);
          const bands = objects(context.bands);
          for (const value of boundaryCandidates(bands, validation)) {
            cases += 1;
            const label = `${fixture.fileName}:${key}:context-${contextIndex}:${value}`;
            const classification = classifyBands(bands, value, edges);
            // Scoring overlaps would be an unresolved fixture blocker; never bless first-match output.
            expect(classification.outcome, label).not.toBe('overlap');
            const result = calculate(probeConfig, { ...contextInputs, [key]: value });
            const target = result.parameters.find((item) => item.key === key);
            if (classification.outcome === 'unique') {
              expect(target?.points, label).toBe(finiteNumber(classification.matches[0]?.points));
              expect(
                result.errors.some((error) => error.code === 'NO_SCORING_BAND'),
                label,
              ).toBe(false);
            } else {
              gaps += 1;
              expect(target?.points, label).toBeUndefined();
              expect(
                result.errors.some(
                  (error) =>
                    error.code === 'NO_SCORING_BAND' && error.path === `scoringRules.${key}`,
                ),
                label,
              ).toBe(true);
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
    expect(gaps).toBeGreaterThan(0);
  });

  it('probes every authored option score without synthesizing an option', () => {
    let cases = 0;
    for (const fixture of sourceFixtures) {
      for (const rule of scoringRules(fixture.config)) {
        const key = text(rule.parameterKey);
        if (!key || !Array.isArray(rule.optionPoints)) continue;
        const probeConfig = isolatedScoringConfig(fixture.config, rule);
        for (const option of objects(rule.optionPoints)) {
          cases += 1;
          const result = calculate(probeConfig, { [key]: option.value });
          expect(result.parameters.find((item) => item.key === key)?.points).toBe(option.points);
          expect(result.errors.some((error) => error.code === 'NO_SCORING_RULE')).toBe(false);
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
  });

  it('probes result-category seams and exposes source-authored holes as NO_BAND_MATCH', () => {
    let gaps = 0;
    for (const fixture of sourceFixtures) {
      const resultCategories = object(fixture.config.resultCategories);
      const bands = objects(resultCategories.bands);
      const scale = object(resultCategories.scale);
      const edges = text(resultCategories.bandEdges) ?? 'min-inclusive';
      const probeConfig: JsonObject = {
        calculatorSlug: text(fixture.config.calculatorSlug),
        version: finiteNumber(fixture.config.version),
        parameters: [{ key: 'probe', inputType: 'number', validation: {} }],
        formulas: [{ key: 'final-score', expression: 'probe' }],
        resultCategories,
      };
      for (const value of boundaryCandidates(bands, scale)) {
        const label = `${fixture.fileName}:result:${value}`;
        const classification = classifyBands(bands, value, edges);
        expect(classification.outcome, label).not.toBe('overlap');
        const result = calculate(probeConfig, { probe: value });
        if (classification.outcome === 'unique') {
          expect(result.category?.label, label).toBe(text(classification.matches[0]?.label));
        } else {
          gaps += 1;
          expect(result.category, label).toBeUndefined();
          expect(
            result.errors.some((error) => error.code === 'NO_BAND_MATCH'),
            label,
          ).toBe(true);
        }
      }
      const scaleMin = finiteNumber(scale.min);
      const scaleMax = finiteNumber(scale.max);
      const scaleStep = epsilon(
        [scaleMin, scaleMax].filter((candidate): candidate is number => candidate !== undefined),
      );
      for (const value of [
        scaleMin === undefined ? undefined : scaleMin - scaleStep,
        scaleMax === undefined ? undefined : scaleMax + scaleStep,
      ].filter((candidate): candidate is number => candidate !== undefined)) {
        const result = calculate(probeConfig, { probe: value });
        expect(
          result.errors.some((error) => error.code === 'SCALE_ASSERTION_FAILED'),
          `${fixture.fileName}:outside-scale:${value}`,
        ).toBe(true);
      }
    }
    expect(gaps).toBeGreaterThan(0);
  });

  it('probes adjustment and floor boundaries using only authored bands and conditions', () => {
    let adjustmentCases = 0;
    let floorCases = 0;
    for (const fixture of sourceFixtures) {
      for (const rule of objects(fixture.config.adjustmentRules)) {
        const key = text(rule.key);
        const bandParam = text(rule.bandParam);
        const bands = objects(rule.bands);
        if (!key || !bandParam || !bands.length) continue;
        const sourceDefinition = parameter(fixture.config, bandParam);
        const definition: JsonObject = {
          ...sourceDefinition,
          inputType: 'number',
          derived: undefined,
        };
        const edges = text(rule.bandEdges) ?? 'min-inclusive';
        const probeConfig: JsonObject = {
          calculatorSlug: text(fixture.config.calculatorSlug),
          version: finiteNumber(fixture.config.version),
          parameters: [definition],
          adjustmentRules: [rule],
        };
        for (const value of boundaryCandidates(bands, object(definition.validation))) {
          adjustmentCases += 1;
          const label = `${fixture.fileName}:adjustment:${key}:${value}`;
          const classification = classifyBands(bands, value, edges);
          expect(classification.outcome, label).toBe('unique');
          const result = calculate(probeConfig, { [bandParam]: value });
          const traces = result.trace.filter(
            (step) => step.kind === 'adjustment' && step.key === key,
          );
          expect(traces, label).toHaveLength(1);
          expect(traces[0]?.value, label).toBe(classification.matches[0]?.points);
        }
      }

      for (const rule of objects(fixture.config.floorRules)) {
        const ruleKey = text(rule.key);
        if (!ruleKey) continue;
        const tierGroups = new Map<string, JsonObject[]>();
        for (const tier of objects(rule.tiers)) {
          const bandParam = text(tier.bandParam);
          if (bandParam) tierGroups.set(bandParam, [...(tierGroups.get(bandParam) ?? []), tier]);
        }
        const conditionInputs = satisfyingInputs(fixture.config, rule.appliesWhen);
        const conditionKeys = [...conditionParameterKeys(rule.appliesWhen)];
        const probeDefinitions = [
          ...[...tierGroups.keys()].map((key) => parameter(fixture.config, key)),
          ...conditionKeys
            .filter((key) => !tierGroups.has(key))
            .map((key) => parameter(fixture.config, key)),
        ];
        const otherInputs = { ...conditionInputs };
        for (const [bandParam] of tierGroups) {
          const validation = object(parameter(fixture.config, bandParam).validation);
          otherInputs[bandParam] = finiteNumber(validation.min) ?? 0;
        }
        const probeConfig: JsonObject = {
          calculatorSlug: text(fixture.config.calculatorSlug),
          version: finiteNumber(fixture.config.version),
          parameters: probeDefinitions,
          floorRules: [rule],
        };
        for (const [bandParam, tiers] of tierGroups) {
          const definition = parameter(fixture.config, bandParam);
          for (const value of boundaryCandidates(tiers, object(definition.validation))) {
            floorCases += 1;
            const label = `${fixture.fileName}:floor:${ruleKey}:${bandParam}:${value}`;
            const matches = tiers.filter((tier) =>
              bandMatches(
                tier,
                value,
                tier.minExclusive === true || tier.maxExclusive === true
                  ? 'explicit'
                  : 'min-inclusive',
              ),
            );
            expect(matches.length, label).toBeLessThanOrEqual(1);
            const result = calculate(probeConfig, { ...otherInputs, [bandParam]: value });
            const traces = result.trace.filter(
              (step) =>
                step.kind === 'floor' &&
                step.key === ruleKey &&
                step.detail?.bandParam === bandParam,
            );
            if (matches.length === 1) {
              expect(traces, label).toHaveLength(1);
              expect(traces[0]?.value, label).toBe(matches[0]?.floorPct);
            } else expect(traces, label).toHaveLength(0);
          }
        }
      }
    }
    expect(adjustmentCases).toBeGreaterThan(0);
    expect(floorCases).toBeGreaterThan(0);
  });

  it('classifies imputation-band overlaps as unresolved diagnostics instead of approving a side', () => {
    let uniqueCases = 0;
    let diagnosticCases = 0;
    for (const fixture of sourceFixtures) {
      for (const imputation of objects(fixture.config.imputationRules)) {
        const targetKey = text(imputation.parameterKey);
        const action = object(imputation.action);
        const byBand = object(action.setPointsByBand);
        const bandParam = text(byBand.bandParam);
        const bands = objects(byBand.bands);
        if (!targetKey || !bandParam || !bands.length) continue;
        const sourceRule = scoringRules(fixture.config).find(
          (rule) => text(rule.parameterKey) === targetKey,
        );
        if (!sourceRule)
          throw new Error(`Imputation target ${targetKey} has no source scoring rule.`);
        const dependencyKeys = new Set([
          bandParam,
          ...conditionParameterKeys(imputation.when),
          ...objects(sourceRule.contexts).flatMap((context) => [
            ...conditionParameterKeys(context.when),
          ]),
        ]);
        dependencyKeys.delete(targetKey);
        const probeConfig: JsonObject = {
          calculatorSlug: text(fixture.config.calculatorSlug),
          version: finiteNumber(fixture.config.version),
          parameters: [
            parameter(fixture.config, targetKey),
            ...[...dependencyKeys].map((key) => parameter(fixture.config, key)),
          ],
          scoringRules: [sourceRule],
          imputationRules: [imputation],
        };
        const definition = parameter(fixture.config, bandParam);
        for (const value of boundaryCandidates(bands, object(definition.validation))) {
          const classification = classifyBands(bands, value, 'min-inclusive');
          const label = `${fixture.fileName}:imputation:${targetKey}:${bandParam}:${value}`;
          if (classification.outcome === 'overlap') {
            // This fixture-derived blocker must fail closed. The assertion deliberately does
            // not select either authored point as clinically correct.
            diagnosticCases += 1;
            expect(classification.matches.length, label).toBeGreaterThan(1);
            const result = calculate(probeConfig, {
              ...satisfyingInputs(fixture.config, imputation.when),
              [bandParam]: value,
            });
            const target = result.parameters.find((item) => item.key === targetKey);
            expect(target?.points, label).toBeUndefined();
            expect(target?.imputed, label).not.toBe(true);
            expect(
              result.errors.some((error) => error.code === 'BLOCKED_BY_POLICY'),
              label,
            ).toBe(true);
            continue;
          }
          const inputs = {
            ...satisfyingInputs(fixture.config, imputation.when),
            [bandParam]: value,
          };
          const result = calculate(probeConfig, inputs);
          const target = result.parameters.find((item) => item.key === targetKey);
          if (classification.outcome === 'unique') {
            uniqueCases += 1;
            expect(target?.imputed, label).toBe(true);
            expect(target?.points, label).toBe(classification.matches[0]?.points);
          } else {
            diagnosticCases += 1;
            expect(target?.points, label).toBeUndefined();
            expect(
              result.errors.some((error) => error.code === 'BLOCKED_BY_POLICY'),
              label,
            ).toBe(true);
          }
        }
      }
    }
    expect(uniqueCases).toBeGreaterThan(0);
    expect(diagnosticCases).toBeGreaterThan(0);
  });
});

describe('P10 source-fixture demographic matrix', () => {
  it('covers every authored context cross-product, including absent optional selectors', () => {
    let cases = 0;
    let noContextDiagnostics = 0;
    for (const fixture of sourceFixtures) {
      for (const rule of scoringRules(fixture.config)) {
        const key = text(rule.parameterKey);
        const contexts = objects(rule.contexts);
        const dependencyKeys = new Set<string>();
        for (const context of contexts) conditionParameterKeys(context.when, dependencyKeys);
        if (!key || dependencyKeys.size === 0) continue;
        const dependencyDefinitions = [...dependencyKeys].map((item) =>
          parameter(fixture.config, item),
        );
        const probeDefinitions = [parameter(fixture.config, key), ...dependencyDefinitions];
        const probeConfig = isolatedScoringConfig(fixture.config, rule);
        const edges =
          text(rule.bandEdges) ??
          text(object(fixture.config.resultCategories).bandEdges) ??
          'min-inclusive';
        for (const assignment of cartesianAssignments(dependencyDefinitions)) {
          cases += 1;
          const preValues = { ...assignment, [key]: 0 };
          const visibleValues = valuesAfterVisibility(probeDefinitions, preValues);
          const explicit = contexts.filter(
            (context) =>
              context.when !== null &&
              context.when !== undefined &&
              conditionMatches(context.when, visibleValues),
          );
          const context =
            explicit.length === 1
              ? explicit[0]
              : explicit.length === 0
                ? contexts.find((candidate) => candidate.when === null)
                : undefined;
          const representativeContext = context ?? contexts[0];
          const representativeBand = objects(representativeContext?.bands)[0];
          if (!representativeBand) throw new Error(`Context for ${key} has no source band.`);
          const value = valueInsideBand(representativeBand, parameter(fixture.config, key), edges);
          const result = calculate(probeConfig, { ...assignment, [key]: value });
          const label = `${fixture.fileName}:${key}:${JSON.stringify(assignment)}`;
          if (explicit.length > 1 || !context) {
            noContextDiagnostics += 1;
            expect(
              result.parameters.find((item) => item.key === key)?.points,
              label,
            ).toBeUndefined();
            expect(
              result.errors.some((error) => error.code === 'NO_SCORING_CONTEXT'),
              label,
            ).toBe(true);
          } else {
            const match = classifyBands(objects(context.bands), value, edges);
            expect(match.outcome, label).toBe('unique');
            expect(result.parameters.find((item) => item.key === key)?.points, label).toBe(
              match.matches[0]?.points,
            );
            expect(
              result.errors.some((error) => error.code === 'NO_SCORING_CONTEXT'),
              label,
            ).toBe(false);
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
    expect(noContextDiagnostics).toBeGreaterThan(0);
  });
});

describe('P10 source-fixture missing-data matrix', () => {
  it('runs full, one-missing, several-missing, required-only, and empty cases deterministically', () => {
    let cases = 0;
    for (const fixture of sourceFixtures) {
      const baseline = baselineInputs(fixture.config);
      const inputDefinitions = parameters(fixture.config).filter(
        (definition) => definition.inputType !== 'derived' && text(definition.key) !== undefined,
      );
      const optionalScored = inputDefinitions
        .filter((definition) => object(definition.validation).required !== true)
        .map((definition) => text(definition.key))
        .filter((key): key is string => key !== undefined)
        .filter((key) =>
          scoringRules(fixture.config).some((rule) => text(rule.parameterKey) === key),
        );
      const requiredKeys = inputDefinitions
        .filter((definition) => object(definition.validation).required === true)
        .map((definition) => text(definition.key))
        .filter((key): key is string => key !== undefined);
      const scenarios: readonly (readonly [string, JsonObject])[] = [
        ['full', baseline],
        ...inputDefinitions.map((definition) => {
          const key = text(definition.key) ?? '';
          return [`without-${key}`, withoutKeys(baseline, [key])] as const;
        }),
        ['several-missing', withoutKeys(baseline, optionalScored.slice(0, 3))],
        ['required-only', Object.fromEntries(requiredKeys.map((key) => [key, baseline[key]]))],
        ['empty', {}],
      ];
      for (const [scenario, inputs] of scenarios) {
        cases += 1;
        const first = calculate(fixture.config, inputs);
        const second = calculate(fixture.config, inputs);
        expect(second, `${fixture.fileName}:${scenario}`).toEqual(first);

        const omittedKeys = inputDefinitions
          .map((definition) => text(definition.key))
          .filter((key): key is string => key !== undefined && !(key in inputs));
        for (const definition of inputDefinitions) {
          const key = text(definition.key);
          if (!key || !omittedKeys.includes(key)) continue;
          const policy = effectiveMissingPolicy(definition);
          const target = first.parameters.find((item) => item.key === key);
          const hasMissingError = first.errors.some(
            (error) => error.code === 'MISSING_REQUIRED_INPUT' && error.path === `inputs.${key}`,
          );
          if (policy === 'block')
            expect(hasMissingError, `${fixture.fileName}:${scenario}:${key}`).toBe(true);
          else if (policy === 'default-option') {
            expect(target?.value, `${fixture.fileName}:${scenario}:${key}`).toBe(
              definition.defaultOption,
            );
            expect(hasMissingError, `${fixture.fileName}:${scenario}:${key}`).toBe(false);
          } else if (policy === 'zero-points') {
            expect(target?.points, `${fixture.fileName}:${scenario}:${key}`).toBe(0);
          } else if (policy === 'impute-rule') {
            const explicitOutcome =
              target?.imputed === true ||
              first.errors.some(
                (error) =>
                  error.code === 'BLOCKED_BY_POLICY' &&
                  (error.path === `inputs.${key}` || error.path === `imputationRules.${key}`),
              );
            expect(explicitOutcome, `${fixture.fileName}:${scenario}:${key}`).toBe(true);
          } else {
            expect(target?.points, `${fixture.fileName}:${scenario}:${key}`).toBeUndefined();
            expect(hasMissingError, `${fixture.fileName}:${scenario}:${key}`).toBe(false);
          }
        }

        for (const derived of parameters(fixture.config).filter(
          (definition) => definition.inputType === 'derived',
        )) {
          const key = text(derived.key);
          if (key && derivedDependencies(derived).some((dependency) => !(dependency in inputs))) {
            const policy = effectiveMissingPolicy(derived);
            const target = first.parameters.find((item) => item.key === key);
            if (policy === 'block') {
              expect(
                first.errors.some(
                  (error) =>
                    error.code === 'BLOCKED_BY_POLICY' && error.path === `parameters.${key}`,
                ),
                `${fixture.fileName}:${scenario}:${key}:blocked-derived-dependency`,
              ).toBe(true);
            } else {
              expect(target?.points, `${fixture.fileName}:${scenario}:${key}`).toBeUndefined();
              expect(target?.status, `${fixture.fileName}:${scenario}:${key}`).toBe('excluded');
              expect(
                first.errors.some(
                  (error) =>
                    error.code === 'DERIVATION_ERROR' && error.path === `parameters.${key}`,
                ),
                `${fixture.fileName}:${scenario}:${key}:missing-derived-dependency`,
              ).toBe(false);
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
  });

  it('shrinks authored exclusion denominators and keeps missing contributions undefined', () => {
    let cases = 0;
    for (const fixture of sourceFixtures) {
      const baseline = baselineInputs(fixture.config);
      const full = calculate(fixture.config, baseline);
      for (const definition of parameters(fixture.config)) {
        const key = text(definition.key);
        const policy = effectiveMissingPolicy(definition);
        if (!key || !['exclude-from-max', 'exclude-from-group', 'not-applicable'].includes(policy))
          continue;
        const omittedInputs =
          definition.inputType === 'derived'
            ? withoutKeys(baseline, derivedDependencies(definition))
            : withoutKeys(baseline, [key]);
        const omitted = calculate(fixture.config, omittedInputs);
        const fullCoverage = full.coverage.entries.find((entry) => entry.key === key);
        const omittedCoverage = omitted.coverage.entries.find((entry) => entry.key === key);
        if (!fullCoverage && !omittedCoverage) continue;
        cases += 1;
        expect(
          omitted.parameters.find((item) => item.key === key)?.points,
          `${fixture.fileName}:${key}`,
        ).toBeUndefined();
        expect(omittedCoverage?.possiblePoints ?? 0, `${fixture.fileName}:${key}`).toBe(0);
        expect(omitted.coverage.possiblePoints, `${fixture.fileName}:${key}`).toBeLessThanOrEqual(
          full.coverage.possiblePoints,
        );
        if (definition.inputType === 'derived') {
          expect(
            omitted.errors.some(
              (error) => error.code === 'DERIVATION_ERROR' && error.path === `parameters.${key}`,
            ),
            `${fixture.fileName}:${key}:derived-blocker`,
          ).toBe(false);
        }
      }
    }
    expect(cases).toBeGreaterThan(0);
  });

  it('executes every unambiguous authored imputation without hard-coded clinical values', () => {
    let cases = 0;
    for (const fixture of sourceFixtures) {
      const baseline = baselineInputs(fixture.config, true);
      for (const imputation of objects(fixture.config.imputationRules)) {
        const key = text(imputation.parameterKey);
        if (!key) continue;
        const inputs = withoutKeys(baseline, [key]);
        const result = calculate(fixture.config, inputs);
        const target = result.parameters.find((item) => item.key === key);
        const action = object(imputation.action);
        let expected = finiteNumber(action.setPoints);
        const byBand = object(action.setPointsByBand);
        const bandParam = text(byBand.bandParam);
        if (expected === undefined && bandParam) {
          const bandValue = finiteNumber(inputs[bandParam]);
          const classification =
            bandValue === undefined
              ? { outcome: 'gap' as const, matches: [] }
              : classifyBands(objects(byBand.bands), bandValue, 'min-inclusive');
          // A maximizing baseline must not choose an ambiguous imputation boundary.
          expect(classification.outcome, `${fixture.fileName}:${key}:imputation-baseline`).toBe(
            'unique',
          );
          expected = finiteNumber(classification.matches[0]?.points);
        }
        cases += 1;
        expect(target?.imputed, `${fixture.fileName}:${key}`).toBe(true);
        expect(target?.points, `${fixture.fileName}:${key}`).toBe(expected);
      }
    }
    expect(cases).toBeGreaterThan(0);
  });
});
