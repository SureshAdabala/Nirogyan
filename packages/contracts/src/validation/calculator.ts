import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';

import type {
  CalculatorValidationResult,
  FindingSeverity,
  ValidationFinding,
  ValidationLayer,
  ValidationLayerResult,
} from './types';

type JsonObject = Record<string, unknown>;
type JsonValue = unknown;

let structuralValidator: ValidateFunction | undefined;
let structuralSchemaError: Error | undefined;

const FUNCTIONS = new Set([
  'abs',
  'exp',
  'false',
  'ln',
  'log10',
  'lookup',
  'max',
  'min',
  'pow',
  'round',
  'sqrt',
  'sum',
  'true',
  'weightedSum',
]);
const RESERVED_SYMBOLS = new Set(['adjustments', 'domains', 'floorPenalty', 'maxPoints', 'points']);

function asObject(value: JsonValue): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: JsonValue): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: JsonValue): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseDate(value: JsonValue): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pathOf(path: string, key: string | number): string {
  return typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`;
}

function readSchema(fileName: string): JsonObject {
  const candidates = [
    join(__dirname, '..', 'schemas', fileName),
    join(__dirname, '..', '..', 'schemas', fileName),
  ];
  const schemaPath = candidates.find((candidate) => existsSync(candidate));
  if (!schemaPath) throw new Error(`Schema file not found: ${fileName}`);
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as JsonObject;
}

function isFiniteJson(value: JsonValue): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFiniteJson);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as JsonObject).every(isFiniteJson);
  }
  return true;
}

function addFinding(
  findings: ValidationFinding[],
  layer: ValidationLayer,
  id: string,
  path: string,
  message: string,
  severity: FindingSeverity = 'error',
  remediation = 'Correct the artifact and rerun validation.',
  relatedDiscrepancyIds: readonly string[] = [],
  evidence: readonly { ref?: string; note?: string }[] = [],
): void {
  findings.push({
    id,
    layer,
    severity,
    artifact: 'calculator-version.v1',
    jsonPath: path,
    message,
    relatedDiscrepancyIds,
    remediation,
    status: 'open',
    evidence,
  });
}

function layerResult(
  layer: ValidationLayer,
  findings: readonly ValidationFinding[],
): ValidationLayerResult {
  return { layer, passed: !findings.some((finding) => finding.severity === 'error'), findings };
}

function uniqueValues(
  values: readonly JsonValue[],
  path: string,
  layer: ValidationLayer,
  findings: ValidationFinding[],
  id: string,
): void {
  const seen = new Map<string, number>();
  values.forEach((value, index) => {
    const key = JSON.stringify(value);
    const previous = seen.get(key);
    if (previous !== undefined) {
      addFinding(
        findings,
        layer,
        id,
        pathOf(path, index),
        `Duplicate value also appears at index ${previous}.`,
      );
    } else {
      seen.set(key, index);
    }
  });
}

function validateStructural(config: JsonValue): ValidationLayerResult {
  const findings: ValidationFinding[] = [];
  if (!isFiniteJson(config)) {
    addFinding(
      findings,
      'structural',
      'STR-008',
      '$',
      'Parsed artifact contains a non-finite number.',
    );
  }

  try {
    if (!structuralValidator && !structuralSchemaError) {
      try {
        const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
        const contentSchema = readSchema('content-page.v1.schema.json');
        ajv.addSchema(contentSchema);
        structuralValidator = ajv.compile(readSchema('calculator-version.v1.schema.json'));
      } catch (error) {
        structuralSchemaError = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (structuralSchemaError) throw structuralSchemaError;
    const validator = structuralValidator;
    if (!validator) throw new Error('Structural validator was not initialized.');
    if (!validator(config)) {
      for (const error of validator.errors ?? []) {
        const id =
          error.keyword === 'additionalProperties'
            ? 'STR-004'
            : error.keyword === 'required'
              ? 'STR-003'
              : error.keyword === 'type'
                ? 'STR-003'
                : error.keyword === 'oneOf'
                  ? 'STR-006'
                  : error.keyword === 'minItems'
                    ? 'STR-007'
                    : 'STR-005';
        addFinding(
          findings,
          'structural',
          id,
          error.instancePath || '$',
          errorMessage(error),
          'error',
          'Make the document conform to calculator-version.v1 JSON Schema.',
        );
      }
    }
  } catch (error) {
    addFinding(
      findings,
      'structural',
      'STR-002',
      '$',
      `Schema compilation failed: ${error instanceof Error ? error.message : String(error)}`,
      'error',
      'Repair the schema package/runtime before validating calculator versions.',
    );
  }
  return layerResult('structural', findings);
}

function errorMessage(error: ErrorObject): string {
  if (error.keyword === 'additionalProperties') {
    return `Unknown property ${(error.params as { additionalProperty?: string }).additionalProperty ?? ''}.`;
  }
  if (error.keyword === 'required') {
    return `Required property ${(error.params as { missingProperty?: string }).missingProperty ?? ''} is missing.`;
  }
  return error.message ?? 'Schema constraint failed.';
}

function collectIds(
  items: readonly JsonValue[],
  field: string,
  path: string,
  findings: ValidationFinding[],
): Set<string> {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const value = asString(asObject(item)[field]);
    if (!value) return;
    if (ids.has(value)) {
      addFinding(
        findings,
        'semantic',
        'SEM-001',
        pathOf(path, index),
        `Duplicate ${field} "${value}".`,
      );
    }
    ids.add(value);
  });
  return ids;
}

function conditionReferences(
  condition: JsonValue,
  known: ReadonlySet<string>,
  path: string,
  findings: ValidationFinding[],
  depth = 0,
): void {
  if (depth > 32) {
    addFinding(
      findings,
      'semantic',
      'SEM-021',
      path,
      'Condition nesting exceeds the v1 limit of 32.',
    );
    return;
  }
  const value = asObject(condition);
  for (const key of ['all', 'any']) {
    asArray(value[key]).forEach((child, index) =>
      conditionReferences(child, known, pathOf(path, key) + `[${index}]`, findings, depth + 1),
    );
  }
  if (value.not !== undefined)
    conditionReferences(value.not, known, pathOf(path, 'not'), findings, depth + 1);
  for (const referenceKey of ['param', 'aggregate', 'formula']) {
    const reference = asString(value[referenceKey]);
    if (reference && !known.has(reference)) {
      addFinding(
        findings,
        'semantic',
        'SEM-002',
        pathOf(path, referenceKey),
        `Unknown condition reference "${reference}".`,
      );
    }
  }
}

interface Interval {
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly minInclusive: boolean;
  readonly maxInclusive: boolean;
}

function interval(value: JsonObject, explicit: boolean): Interval {
  const min = typeof value.min === 'number' ? value.min : undefined;
  const max = typeof value.max === 'number' ? value.max : undefined;
  return {
    min,
    max,
    minInclusive: value.minExclusive === true ? false : value.minInclusive === true || !explicit,
    maxInclusive: value.maxExclusive === true ? false : value.maxInclusive === true,
  };
}

function intervalsOverlap(left: Interval, right: Interval): boolean {
  if (left.max !== undefined && right.min !== undefined) {
    if (left.max < right.min) return false;
    if (left.max === right.min && (!left.maxInclusive || !right.minInclusive)) return false;
  }
  if (right.max !== undefined && left.min !== undefined) {
    if (right.max < left.min) return false;
    if (right.max === left.min && (!right.maxInclusive || !left.minInclusive)) return false;
  }
  return true;
}

function validateBands(
  bands: readonly JsonValue[],
  path: string,
  explicit: boolean,
  findings: ValidationFinding[],
  gapId = 'SEM-024',
): void {
  const intervals = bands.map((band) => interval(asObject(band), explicit));
  for (let index = 0; index < intervals.length; index += 1) {
    for (let other = index + 1; other < intervals.length; other += 1) {
      const left = intervals[index];
      const right = intervals[other];
      if (left && right && intervalsOverlap(left, right)) {
        addFinding(
          findings,
          'semantic',
          'SEM-023',
          pathOf(path, other),
          `Band overlaps band ${index}; array order cannot resolve overlap.`,
        );
      }
    }
  }
  const sorted = intervals
    .map((value, index) => ({ value, index }))
    .sort(
      (left, right) =>
        (left.value.min ?? Number.NEGATIVE_INFINITY) -
        (right.value.min ?? Number.NEGATIVE_INFINITY),
    );
  for (let index = 1; index < sorted.length; index += 1) {
    const previousEntry = sorted[index - 1];
    const currentEntry = sorted[index];
    const previous = previousEntry?.value;
    const current = currentEntry?.value;
    if (!previous || !current || !currentEntry) continue;
    if (previous.max !== undefined && current.min !== undefined) {
      const gap =
        previous.max < current.min ||
        (previous.max === current.min && !previous.maxInclusive && !current.minInclusive);
      const band = asObject(bands[currentEntry.index]);
      if (gap && band.asWritten !== true && asArray(band.clarificationRefs).length === 0) {
        addFinding(
          findings,
          'semantic',
          gapId,
          pathOf(path, currentEntry.index),
          'Reachable gap between adjacent bands is not documented.',
        );
      }
    }
  }
}

function validateSemantic(config: JsonObject): ValidationLayerResult {
  const findings: ValidationFinding[] = [];
  const parameters = asArray(config.parameters);
  const parameterIds = collectIds(parameters, 'key', '$.parameters', findings);
  const groups = new Map<string, string>();
  parameters.forEach((item) => {
    const parameter = asObject(item);
    const key = asString(parameter.key);
    const group = asString(parameter.group);
    if (key && group) groups.set(group, key);
  });
  const aggregateIds = collectIds(
    asArray(config.parameterGroupsAggregation),
    'key',
    '$.parameterGroupsAggregation',
    findings,
  );
  const formulaItems = asArray(config.formulas);
  const formulaIds = collectIds(formulaItems, 'key', '$.formulas', findings);
  const formulaSymbols = new Set<string>(formulaIds);
  formulaItems.forEach((item) => {
    const formula = asObject(item);
    const key = asString(formula.key);
    const symbol =
      asString(formula.symbol) ??
      key?.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    if (symbol) {
      if (formulaSymbols.has(symbol) && symbol !== key)
        addFinding(
          findings,
          'semantic',
          'SEM-003',
          '$.formulas',
          `Formula symbol "${symbol}" collides with another runtime symbol.`,
        );
      formulaSymbols.add(symbol);
    }
  });
  const knownSymbols = new Set<string>([
    ...parameterIds,
    ...aggregateIds,
    ...formulaSymbols,
    ...RESERVED_SYMBOLS,
  ]);
  const ruleParameters = new Set<string>();

  asArray(config.scoringRules).forEach((item, index) => {
    const rule = asObject(item);
    const parameterKey = asString(rule.parameterKey);
    if (!parameterKey || !parameterIds.has(parameterKey)) {
      addFinding(
        findings,
        'semantic',
        'SEM-002',
        `$.scoringRules[${index}].parameterKey`,
        `Scoring rule references unknown parameter "${parameterKey ?? ''}".`,
      );
    }
    if (parameterKey && ruleParameters.has(parameterKey)) {
      addFinding(
        findings,
        'semantic',
        'SEM-001',
        `$.scoringRules[${index}].parameterKey`,
        `Multiple scoring rules target "${parameterKey}".`,
      );
    }
    if (parameterKey) ruleParameters.add(parameterKey);
    const contexts = asArray(rule.contexts);
    if (contexts.length > 0) {
      let fallbackCount = 0;
      contexts.forEach((context, contextIndex) => {
        const contextObject = asObject(context);
        if (contextObject.when === null) fallbackCount += 1;
        if (contextObject.when !== null && contextObject.when !== undefined) {
          conditionReferences(
            contextObject.when,
            knownSymbols,
            `$.scoringRules[${index}].contexts[${contextIndex}].when`,
            findings,
          );
        }
        validateBands(
          asArray(contextObject.bands),
          `$.scoringRules[${index}].contexts[${contextIndex}].bands`,
          rule.bandEdges === 'explicit',
          findings,
        );
      });
      if (fallbackCount > 1)
        addFinding(
          findings,
          'semantic',
          'SEM-026',
          `$.scoringRules[${index}].contexts`,
          'At most one fallback context is allowed.',
        );
    }
    const optionPoints = asArray(rule.optionPoints);
    const parameter = parameters.find(
      (candidate) => asString(asObject(candidate).key) === parameterKey,
    );
    const options = asArray(asObject(parameter).options);
    if (optionPoints.length > 0) {
      uniqueValues(
        optionPoints.map((option) => asObject(option).value),
        `$.scoringRules[${index}].optionPoints`,
        'semantic',
        findings,
        'SEM-011',
      );
      const expected = new Set(options.map((option) => JSON.stringify(asObject(option).value)));
      const actual = new Set(optionPoints.map((option) => JSON.stringify(asObject(option).value)));
      expected.forEach((value) => {
        if (!actual.has(value))
          addFinding(
            findings,
            'semantic',
            'SEM-011',
            `$.scoringRules[${index}].optionPoints`,
            `Missing option-points entry for ${value}.`,
          );
      });
    }
  });

  parameters.forEach((item, index) => {
    const parameter = asObject(item);
    const inputType = asString(parameter.inputType);
    const required = asObject(parameter.validation).required === true;
    if (
      inputType !== 'derived' &&
      (required || ruleParameters.has(asString(parameter.key) ?? '')) &&
      parameter.missingPolicy === undefined &&
      !required
    ) {
      addFinding(
        findings,
        'semantic',
        'SEM-010',
        `$.parameters[${index}]`,
        'Reachable optional scored parameter must declare a missingPolicy.',
      );
    }
    if (required && parameter.missingPolicy !== undefined && parameter.missingPolicy !== 'block') {
      addFinding(
        findings,
        'semantic',
        'SEM-010',
        `$.parameters[${index}].missingPolicy`,
        'Required parameters must use block missing policy.',
      );
    }
    const options = asArray(parameter.options);
    uniqueValues(
      options.map((option) => asObject(option).value),
      `$.parameters[${index}].options`,
      'semantic',
      findings,
      'SEM-011',
    );
    if (
      parameter.defaultOption !== undefined &&
      !options.some(
        (option) =>
          JSON.stringify(asObject(option).value) === JSON.stringify(parameter.defaultOption),
      )
    ) {
      addFinding(
        findings,
        'semantic',
        'SEM-012',
        `$.parameters[${index}].defaultOption`,
        'defaultOption does not exist in options.',
      );
    }
    const unit = asObject(parameter.unit);
    const canonical = asString(unit.canonical);
    if (canonical) {
      const allowed = asArray(unit.allowed);
      const codes = new Set<string>();
      allowed.forEach((choice, choiceIndex) => {
        const choiceObject = asObject(choice);
        const code = asString(choiceObject.code);
        if (code && codes.has(code))
          addFinding(
            findings,
            'semantic',
            'SEM-014',
            `$.parameters[${index}].unit.allowed[${choiceIndex}].code`,
            `Duplicate unit code "${code}".`,
          );
        if (code) codes.add(code);
        if (
          typeof choiceObject.factor !== 'number' ||
          !Number.isFinite(choiceObject.factor) ||
          choiceObject.factor <= 0
        )
          addFinding(
            findings,
            'semantic',
            'SEM-014',
            `$.parameters[${index}].unit.allowed[${choiceIndex}].factor`,
            'Unit factor must be finite and positive.',
          );
        if (
          choiceObject.offset !== undefined &&
          (typeof choiceObject.offset !== 'number' || !Number.isFinite(choiceObject.offset))
        )
          addFinding(
            findings,
            'semantic',
            'SEM-014',
            `$.parameters[${index}].unit.allowed[${choiceIndex}].offset`,
            'Unit offset must be finite.',
          );
      });
    }
    const validation = asObject(parameter.validation);
    if (
      typeof validation.min === 'number' &&
      typeof validation.max === 'number' &&
      validation.min > validation.max
    )
      addFinding(
        findings,
        'semantic',
        'SEM-016',
        `$.parameters[${index}].validation`,
        'Validation minimum exceeds maximum.',
      );
    if (parameter.visibility !== undefined)
      conditionReferences(
        parameter.visibility,
        knownSymbols,
        `$.parameters[${index}].visibility`,
        findings,
      );
  });

  asArray(config.parameterGroupsAggregation).forEach((item, index) => {
    const group = asObject(item);
    if (group.emptyPolicy === undefined)
      addFinding(
        findings,
        'semantic',
        'SEM-033',
        `$.parameterGroupsAggregation[${index}].emptyPolicy`,
        'Reachable groups require an explicit empty policy.',
      );
    asArray(group.parameterKeys).forEach((key, keyIndex) => {
      if (typeof key === 'string' && !parameterIds.has(key))
        addFinding(
          findings,
          'semantic',
          'SEM-002',
          `$.parameterGroupsAggregation[${index}].parameterKeys[${keyIndex}]`,
          `Unknown group parameter "${key}".`,
        );
    });
  });

  const derivedGraph = new Map<string, readonly string[]>();
  parameters.forEach((item) => {
    const parameter = asObject(item);
    const key = asString(parameter.key);
    const deps = asArray(asObject(parameter.derived).dependsOn).filter(
      (dep): dep is string => typeof dep === 'string',
    );
    if (key && deps.length > 0) derivedGraph.set(key, deps);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) {
      addFinding(
        findings,
        'semantic',
        'SEM-030',
        '$.parameters',
        `Dependency cycle includes "${key}".`,
      );
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    (derivedGraph.get(key) ?? []).forEach((dependency) => {
      if (!parameterIds.has(dependency))
        addFinding(
          findings,
          'semantic',
          'SEM-002',
          '$.parameters',
          `Derived parameter references unknown dependency "${dependency}".`,
        );
      if (derivedGraph.has(dependency)) visit(dependency);
    });
    visiting.delete(key);
    visited.add(key);
  };
  derivedGraph.forEach((_deps, key) => visit(key));

  asArray(config.formulas).forEach((item, index) => {
    const expression = asString(asObject(item).expression) ?? '';
    // Lookup-table keys and other DSL string arguments are data, not runtime
    // identifiers. Preserve offsets while masking both supported quote forms.
    const expressionWithoutStrings = expression.replace(
      /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/gu,
      (literal) => ' '.repeat(literal.length),
    );
    const identifiers = expressionWithoutStrings.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [];
    identifiers.forEach((identifier) => {
      if (!FUNCTIONS.has(identifier) && !knownSymbols.has(identifier) && identifier !== 'e')
        addFinding(
          findings,
          'semantic',
          'SEM-031',
          `$.formulas[${index}].expression`,
          `Unknown expression symbol "${identifier}".`,
        );
    });
    if (/\/\s*0(?:\D|$)/.test(expression))
      addFinding(
        findings,
        'semantic',
        'SEM-032',
        `$.formulas[${index}].expression`,
        'Expression contains a statically provable division by zero.',
      );
  });
  if (formulaIds.has('final-score') === false)
    addFinding(
      findings,
      'semantic',
      'SEM-042',
      '$.formulas',
      'Exactly one final-score formula is required.',
    );
  if ([...formulaIds].filter((key) => key === 'final-score').length > 1)
    addFinding(findings, 'semantic', 'SEM-001', '$.formulas', 'final-score formula is duplicated.');

  const domains = asArray(config.domains);
  collectIds(domains, 'key', '$.domains', findings);
  const weightTotal = domains.reduce<number>(
    (sum, item) =>
      sum + (typeof asObject(item).weight === 'number' ? (asObject(item).weight as number) : 0),
    0,
  );
  if (Math.abs(weightTotal - 1) > 1e-9)
    addFinding(
      findings,
      'semantic',
      'SEM-036',
      '$.domains',
      `Domain weights must sum to 1; received ${weightTotal}.`,
    );
  domains.forEach((item, index) => {
    const domain = asObject(item);
    asArray(domain.parameterKeys).forEach((key, keyIndex) => {
      if (typeof key === 'string' && !parameterIds.has(key))
        addFinding(
          findings,
          'semantic',
          'SEM-035',
          `$.domains[${index}].parameterKeys[${keyIndex}]`,
          `Unknown domain parameter "${key}".`,
        );
    });
    asArray(domain.aggregateKeys).forEach((key, keyIndex) => {
      if (typeof key === 'string' && !aggregateIds.has(key))
        addFinding(
          findings,
          'semantic',
          'SEM-034',
          `$.domains[${index}].aggregateKeys[${keyIndex}]`,
          `Unknown domain aggregate "${key}".`,
        );
    });
  });
  const policy = asObject(config.domainAggregationPolicy);
  if (domains.length > 1 && policy.missingDomainPolicy === undefined)
    addFinding(
      findings,
      'semantic',
      'SEM-037',
      '$.domainAggregationPolicy',
      'Multi-domain calculators must declare missingDomainPolicy.',
    );

  asArray(config.lookupTables).forEach((item, index) => {
    const table = asObject(item);
    const rawEntries = table.entries;
    const entries = asArray(
      Array.isArray(rawEntries) && rawEntries.length > 0 ? rawEntries : table.map,
    );
    uniqueValues(
      entries.map((entry) => asObject(entry).input ?? asObject(entry).points),
      `$.lookupTables[${index}]`,
      'semantic',
      findings,
      'SEM-039',
    );
    const below = entries.filter((entry) => asObject(entry).orBelow === true).length;
    const above = entries.filter((entry) => asObject(entry).orAbove === true).length;
    if (below > 1 || above > 1)
      addFinding(
        findings,
        'semantic',
        'SEM-039',
        `$.lookupTables[${index}]`,
        'Lookup sentinels must be unique by direction.',
      );
  });

  const categories = asObject(config.resultCategories);
  const scale = asObject(categories.scale);
  if (typeof scale.min === 'number' && typeof scale.max === 'number' && scale.min >= scale.max)
    addFinding(
      findings,
      'semantic',
      'SEM-027',
      '$.resultCategories.scale',
      'Result scale maximum must exceed minimum.',
    );
  validateBands(
    asArray(categories.bands),
    '$.resultCategories.bands',
    categories.bandEdges === 'explicit',
    findings,
    'SEM-027',
  );
  const labels = asArray(categories.bands).map((band) => asObject(band).label);
  uniqueValues(labels, '$.resultCategories.bands.label', 'semantic', findings, 'SEM-041');
  asArray(categories.overrides).forEach((override, index) => {
    const minCategory = asString(asObject(override).minCategory);
    if (minCategory && !labels.includes(minCategory))
      addFinding(
        findings,
        'semantic',
        'SEM-041',
        `$.resultCategories.overrides[${index}].minCategory`,
        `Unknown category override label "${minCategory}".`,
      );
    if (asObject(override).when !== undefined)
      conditionReferences(
        asObject(override).when,
        knownSymbols,
        `$.resultCategories.overrides[${index}].when`,
        findings,
      );
  });
  asArray(config.imputationRules).forEach((rule, index) => {
    const ruleObject = asObject(rule);
    const parameterKey = asString(ruleObject.parameterKey);
    if (parameterKey && !parameterIds.has(parameterKey))
      addFinding(
        findings,
        'semantic',
        'SEM-002',
        `$.imputationRules[${index}].parameterKey`,
        `Unknown imputation target "${parameterKey}".`,
      );
    if (ruleObject.fallbackPolicy === undefined)
      addFinding(
        findings,
        'semantic',
        'SEM-013',
        `$.imputationRules[${index}].fallbackPolicy`,
        'Imputation rules require a fallback policy.',
      );
    conditionReferences(
      ruleObject.when,
      knownSymbols,
      `$.imputationRules[${index}].when`,
      findings,
    );
    const setPointsByBand = asObject(asObject(ruleObject.action).setPointsByBand);
    const imputationBands = asArray(setPointsByBand.bands);
    if (imputationBands.length > 0) {
      // Imputation actions have no bandEdges mode. The frozen runtime default is
      // min-inclusive/max-exclusive, with only per-band flags overriding an edge.
      validateBands(
        imputationBands,
        `$.imputationRules[${index}].action.setPointsByBand.bands`,
        false,
        findings,
      );
    }
  });

  const content = asObject(config.content);
  if (Object.keys(content).length > 0) {
    const blockIds = collectIds(asArray(content.blocks), 'id', '$.content.blocks', findings);
    const claimIds = collectIds(asArray(content.claims), 'id', '$.content.claims', findings);
    const citationIds = collectIds(
      asArray(content.citations),
      'id',
      '$.content.citations',
      findings,
    );
    asArray(content.claims).forEach((claim, index) =>
      asArray(asObject(claim).citationIds).forEach((citationId) => {
        if (typeof citationId === 'string' && !citationIds.has(citationId))
          addFinding(
            findings,
            'semantic',
            'SEM-050',
            `$.content.claims[${index}].citationIds`,
            `Claim references unknown citation "${citationId}".`,
          );
      }),
    );
    asArray(content.blocks).forEach((block, index) =>
      asArray(asObject(block).claimIds).forEach((claimId) => {
        if (typeof claimId === 'string' && !claimIds.has(claimId))
          addFinding(
            findings,
            'semantic',
            'SEM-050',
            `$.content.blocks[${index}].claimIds`,
            `Content block references unknown claim "${claimId}".`,
          );
      }),
    );
    const canonicalPath = asString(asObject(content.seo).canonicalPath);
    if (canonicalPath && !canonicalPath.startsWith('/'))
      addFinding(
        findings,
        'semantic',
        'SEM-052',
        '$.content.seo.canonicalPath',
        'Canonical path must begin with /.',
      );
    if (blockIds.size === 0)
      addFinding(
        findings,
        'semantic',
        'SEM-050',
        '$.content.blocks',
        'Content must contain at least one identified block.',
      );
  }
  return layerResult('semantic', findings);
}

function approvedReviewScopes(governance: JsonObject): ReadonlySet<string> {
  return new Set(
    asArray(governance.reviews)
      .map(asObject)
      .filter((review) => review.decision === 'approved')
      .flatMap((review) => (typeof review.scope === 'string' ? [review.scope] : [])),
  );
}

function hasCompleteGovernanceApproval(governance: JsonObject, clinical: boolean): boolean {
  if (!clinical) return true;
  const scopes = approvedReviewScopes(governance);
  return (
    scopes.has('full-version') ||
    (scopes.has('clinical-logic') && scopes.has('content') && scopes.has('sources'))
  );
}

function medicalClaimIds(content: JsonObject): readonly string[] {
  const medicalKinds = new Set(['medical-fact', 'threshold', 'formula', 'recommendation']);
  return asArray(content.claims)
    .map(asObject)
    .filter((claim) => medicalKinds.has(asString(claim.kind) ?? ''))
    .flatMap((claim) => (typeof claim.id === 'string' ? [claim.id] : []));
}

function hasApprovedMedicalContentReview(content: JsonObject): boolean {
  const claimIds = medicalClaimIds(content);
  if (claimIds.length === 0) return true;
  const review = asObject(content.medicalReview);
  const approvedIds = new Set(
    asArray(review.approvedClaimIds).filter((id): id is string => typeof id === 'string'),
  );
  return (
    review.status === 'approved' &&
    (review.scope === 'clinical-claims' || review.scope === 'full-page') &&
    typeof review.reviewerId === 'string' &&
    review.reviewerId.length > 0 &&
    typeof review.reviewedAt === 'string' &&
    claimIds.every((id) => approvedIds.has(id))
  );
}

function validateClinical(config: JsonObject, now: Date): ValidationLayerResult {
  const findings: ValidationFinding[] = [];
  const slug = asString(config.calculatorSlug) ?? '';
  const sources = asArray(config.sources);
  if (sources.length === 0)
    addFinding(
      findings,
      'clinical',
      'CLN-003',
      '$.sources',
      'No source manifest is attached to the calculator.',
    );
  sources.forEach((source, index) => {
    const sourceObject = asObject(source);
    const verification = asString(sourceObject.verification);
    if (verification !== 'fetch-verified' && verification !== 'source-provided') {
      addFinding(
        findings,
        'clinical',
        'CLN-004',
        `$.sources[${index}]`,
        `Source verification status "${verification ?? 'missing'}" requires re-verification before publication.`,
      );
    }
  });
  const governance = asObject(config.governance);
  const hasGovernance = Object.keys(governance).length > 0;
  if (!hasGovernance)
    addFinding(
      findings,
      'clinical',
      'CLN-010',
      '$.governance',
      'Governance and medical-review evidence is missing.',
    );
  const clinicalStatus = asString(governance.clinicalStatus);
  const sourceReviewStatus = asString(governance.sourceReviewStatus);
  const clinical = clinicalStatus !== 'not-applicable';
  if (hasGovernance && clinicalStatus !== 'approved' && clinicalStatus !== 'not-applicable')
    addFinding(
      findings,
      'clinical',
      'CLN-010',
      '$.governance.clinicalStatus',
      `Clinical governance status "${clinicalStatus ?? 'missing'}" is not approved.`,
      'error',
      'Obtain authorized medical approval without changing protected values after review.',
    );
  if (hasGovernance && sourceReviewStatus !== 'verified' && sourceReviewStatus !== 'not-applicable')
    addFinding(
      findings,
      'clinical',
      sourceReviewStatus === 'expired' ? 'CLN-011' : 'CLN-004',
      '$.governance.sourceReviewStatus',
      `Source-review status "${sourceReviewStatus ?? 'missing'}" is not publishable.`,
      'error',
      'Complete and record a current source review against the protected snapshot.',
    );
  const sourceReviewExpiresAt = parseDate(governance.sourceReviewExpiresAt);
  if (sourceReviewExpiresAt !== undefined && sourceReviewExpiresAt <= now.getTime())
    addFinding(
      findings,
      'clinical',
      'CLN-011',
      '$.governance.sourceReviewExpiresAt',
      'The source-review approval is expired.',
      'error',
      'Reverify the evidence and record a new review expiry.',
    );
  if (hasGovernance && !hasCompleteGovernanceApproval(governance, clinical))
    addFinding(
      findings,
      'clinical',
      'CLN-010',
      '$.governance.reviews',
      'Approved review evidence does not cover clinical logic, content, and sources (or full-version scope).',
      'error',
      'Record authorized approvals for every protected review scope; persistence must bind them to current hashes.',
    );
  if (asArray(governance.publishBlockers).length > 0)
    addFinding(
      findings,
      'clinical',
      'CLN-001',
      '$.governance.publishBlockers',
      'Declared governance publish blockers remain open.',
    );
  if (slug === 'niro-cws')
    addFinding(
      findings,
      'clinical',
      'CLN-001',
      '$.calculatorSlug',
      'CWS remains blocked pending Niro stratified-range confirmation (N1).',
      'error',
      'Resolve N1 with the source owner and medical reviewer.',
      ['N1'],
    );
  if (slug.startsWith('covid'))
    addFinding(
      findings,
      'clinical',
      'CLN-013',
      '$.calculatorSlug',
      'COVID fixture is intentionally nonclinical and cannot transition directly to clinical publication.',
    );
  const content = asObject(config.content);
  const claims = asArray(content.claims);
  const citations = new Map(
    asArray(content.citations)
      .map(asObject)
      .flatMap((citation) =>
        typeof citation.id === 'string' ? ([[citation.id, citation]] as const) : [],
      ),
  );
  claims.forEach((claim, index) => {
    const claimObject = asObject(claim);
    const kind = asString(claimObject.kind);
    const reviewStatus = asString(claimObject.reviewStatus);
    if (kind !== 'nonmedical' && asArray(claimObject.citationIds).length === 0)
      addFinding(
        findings,
        'clinical',
        'CLN-003',
        `$.content.claims[${index}]`,
        'Medical claim has no citation attachment.',
      );
    if (reviewStatus === 'unreviewed' || reviewStatus === 'disputed' || reviewStatus === 'expired')
      addFinding(
        findings,
        'clinical',
        'CLN-010',
        `$.content.claims[${index}].reviewStatus`,
        `Claim review status "${reviewStatus}" is not publishable.`,
      );
    asArray(claimObject.citationIds).forEach((citationId) => {
      if (typeof citationId !== 'string') return;
      const citation = citations.get(citationId);
      if (!citation) return;
      const verification = asString(citation.verificationStatus);
      if (
        verification === 'blocked-cited' ||
        verification === 'search-verified' ||
        verification === 'needs-verification'
      )
        addFinding(
          findings,
          'clinical',
          'CLN-004',
          `$.content.citations[${citationId}]`,
          `Citation verification status "${verification}" is not publishable.`,
          'error',
          'Reverify the cited claim against an allowed source.',
        );
      const license = asString(citation.licenseStatus);
      if (license === 'permission-required' || license === 'unknown')
        addFinding(
          findings,
          'clinical',
          'CLN-012',
          `$.content.citations[${citationId}].licenseStatus`,
          `Citation license status "${license}" is not cleared for publication.`,
          'error',
          'Obtain permission or record a reviewed clear/licensed/not-applicable disposition.',
        );
      const expiresAt = parseDate(citation.reviewExpiresAt);
      if (expiresAt !== undefined && expiresAt <= now.getTime())
        addFinding(
          findings,
          'clinical',
          'CLN-011',
          `$.content.citations[${citationId}].reviewExpiresAt`,
          'Citation review has expired.',
          'error',
          'Reverify the citation and update its reviewed expiry.',
        );
    });
  });
  if (Object.keys(content).length > 0 && !hasApprovedMedicalContentReview(content))
    addFinding(
      findings,
      'clinical',
      'CLN-010',
      '$.content.medicalReview',
      'Medical-content review is absent, incomplete, or does not cover every medical claim.',
      'error',
      'Record an approved clinical-claims/full-page review with reviewer, date, and approved claim ids.',
    );
  const medicalReview = asObject(content.medicalReview);
  const nextReviewAt = parseDate(medicalReview.nextReviewAt);
  if (
    medicalClaimIds(content).length > 0 &&
    nextReviewAt !== undefined &&
    nextReviewAt <= now.getTime()
  )
    addFinding(
      findings,
      'clinical',
      'CLN-011',
      '$.content.medicalReview.nextReviewAt',
      'Medical-content review is expired.',
      'error',
      'Complete a new medical review against the current content and claim set.',
    );
  if (medicalClaimIds(content).length > 0) {
    const authorship = asObject(content.authorship);
    const contributors = asArray(authorship.contributors).map(asObject);
    const reviewerId = asString(medicalReview.reviewerId);
    const hasAuthor = contributors.some((contributor) => contributor.role === 'author');
    const hasReviewer = contributors.some(
      (contributor) =>
        contributor.role === 'medical-reviewer' &&
        reviewerId !== undefined &&
        contributor.id === reviewerId,
    );
    if (!hasAuthor || !hasReviewer)
      addFinding(
        findings,
        'clinical',
        'CLN-010',
        '$.content.authorship.contributors',
        'Medical content must identify an author and the approved medical reviewer.',
        'error',
        'Add the accountable author and matching medical-reviewer contributor metadata.',
      );
  }
  return layerResult('clinical', findings);
}

function validatePublish(
  config: JsonObject,
  layers: readonly ValidationLayerResult[],
  now: Date,
): ValidationLayerResult {
  const findings: ValidationFinding[] = [];
  const hasErrors = (layer: ValidationLayer): boolean =>
    layers
      .find((entry) => entry.layer === layer)
      ?.findings.some((finding) => finding.severity === 'error') ?? true;
  if (hasErrors('structural'))
    addFinding(findings, 'publish', 'PUB-001', '$', 'Structural validation has open errors.');
  if (hasErrors('semantic'))
    addFinding(findings, 'publish', 'PUB-002', '$', 'Semantic validation has open errors.');
  if (hasErrors('clinical'))
    addFinding(
      findings,
      'publish',
      'PUB-003',
      '$',
      'Clinical/evidence validation has open errors.',
    );
  const status = asString(config.status);
  if (status !== 'approved')
    addFinding(
      findings,
      'publish',
      'PUB-004',
      '$.status',
      'Only an approved immutable version can enter publication.',
    );
  const governance = asObject(config.governance);
  const clinical = governance.clinicalStatus !== 'not-applicable';
  if (asArray(governance.publishBlockers).length > 0)
    addFinding(
      findings,
      'publish',
      'PUB-005',
      '$.governance.publishBlockers',
      'Open publication blockers are present.',
    );
  const content = asObject(config.content);
  if (Object.keys(content).length === 0)
    addFinding(
      findings,
      'publish',
      'PUB-008',
      '$.content',
      'Structured content and disclaimer evidence are required.',
    );
  const testCases = asArray(config.testCases);
  const hasCompleteSourceGolden = testCases.some((testCase) => {
    const value = asObject(testCase);
    const expected = asObject(value.expected);
    const source = asObject(value.source);
    const verification = asString(source.verification);
    return (
      value.kind === 'source-worked-example' &&
      Object.keys(asObject(value.inputs)).length > 0 &&
      typeof expected.finalScore === 'number' &&
      Number.isFinite(expected.finalScore) &&
      typeof expected.category === 'string' &&
      expected.category.length > 0 &&
      typeof source.ref === 'string' &&
      source.ref.length > 0 &&
      (verification === 'source-provided' || verification === 'fetch-verified')
    );
  });
  const hasBoundaryTest = testCases.some((testCase) => asObject(testCase).kind === 'boundary');
  const malformedSourceTest = testCases.some((testCase) => {
    const value = asObject(testCase);
    return (
      value.kind === 'source-worked-example' && Object.keys(asObject(value.source)).length === 0
    );
  });
  if (
    testCases.length === 0 ||
    (clinical && (!hasCompleteSourceGolden || !hasBoundaryTest)) ||
    malformedSourceTest
  )
    addFinding(
      findings,
      'publish',
      'PUB-007',
      '$.testCases',
      'Clinical publication requires a complete source-worked example with inputs, final score, category, precise verified source locator, plus boundary evidence.',
    );
  if (
    clinical &&
    (!hasCompleteGovernanceApproval(governance, true) || !hasApprovedMedicalContentReview(content))
  )
    addFinding(
      findings,
      'publish',
      'PUB-006',
      '$.governance.reviews',
      'Medical/source approvals do not cover the current protected review scopes.',
      'error',
      'Complete protected-snapshot reviews; the admin lifecycle must verify their current hashes.',
    );
  if (Object.keys(content).length > 0) {
    const seo = asObject(content.seo);
    const robots = asObject(seo.robots);
    const expectedCanonical = `/c/${asString(config.calculatorSlug) ?? ''}`;
    const publicationStatus = asString(asObject(content.publication).status);
    const seoCoherent =
      seo.canonicalPath === expectedCanonical &&
      (clinical ? robots.index === true && robots.follow === true : robots.index === false) &&
      (publicationStatus === 'approved' || publicationStatus === 'published');
    if (!seoCoherent)
      addFinding(
        findings,
        'publish',
        'PUB-009',
        '$.content.seo',
        'Canonical, indexing, or associated-content publication state is not coherent for this calculator.',
        'error',
        'Use the canonical /c/{slug} route, reviewed indexing policy, and approved/published content snapshot.',
      );
  }
  const evidenceFindings =
    layers
      .find((entry) => entry.layer === 'clinical')
      ?.findings.filter((finding) =>
        ['CLN-003', 'CLN-004', 'CLN-011', 'CLN-012'].includes(finding.id),
      ) ?? [];
  if (evidenceFindings.length > 0)
    addFinding(
      findings,
      'publish',
      'PUB-010',
      '$.sources',
      'Current evidence, citation, or license gates have open errors.',
      'error',
      'Resolve the linked clinical evidence findings without replacing Niro source values.',
    );
  const biomarkerKeys = asArray(config.parameters)
    .map((parameter) => asString(asObject(parameter).biomarkerKey))
    .filter((key): key is string => key !== undefined);
  const revisionIds = asArray(governance.measurementRevisionIds).filter(
    (id): id is string => typeof id === 'string',
  );
  if (
    (biomarkerKeys.length > 0 && revisionIds.length !== new Set(biomarkerKeys).size) ||
    testCases.length === 0
  )
    addFinding(
      findings,
      'publish',
      'PUB-013',
      '$.governance.measurementRevisionIds',
      'Runtime measurement dependencies and complete reproducibility evidence are not fully snapshotted.',
      'error',
      'Bind exactly one immutable measurement revision per biomarker key and retain complete saved tests.',
    );
  if (asString(config.engineSemanticVersion) !== '1.0.0')
    addFinding(
      findings,
      'publish',
      'PUB-015',
      '$.engineSemanticVersion',
      'The declared engine semantic version is absent or unsupported by this contract package.',
      'error',
      'Declare the supported engine semantic version 1.0.0; do not alter calculator logic to fit it.',
    );
  void now;
  return layerResult('publish', findings);
}

export function validateCalculatorVersion(
  config: JsonValue,
  artifact = 'calculator-version.v1',
  now = new Date(),
): CalculatorValidationResult {
  const structural = validateStructural(config);
  const semantic = validateSemantic(asObject(config));
  const clinical = validateClinical(asObject(config), now);
  const publish = validatePublish(asObject(config), [structural, semantic, clinical], now);
  const allFindings = [
    ...structural.findings,
    ...semantic.findings,
    ...clinical.findings,
    ...publish.findings,
  ];
  return {
    artifact,
    structural,
    semantic,
    clinical,
    publish,
    publishEligible: [structural, semantic, clinical, publish].every((layer) => layer.passed),
    errorCount: allFindings.filter((finding) => finding.severity === 'error').length,
    warningCount: allFindings.filter((finding) => finding.severity === 'warning').length,
  };
}

export function validateCalculatorJson(
  jsonText: string,
  artifact = 'calculator-version.v1',
  now = new Date(),
): CalculatorValidationResult {
  try {
    return validateCalculatorVersion(JSON.parse(jsonText) as JsonValue, artifact, now);
  } catch (error) {
    const finding: ValidationFinding = {
      id: 'STR-001',
      layer: 'structural',
      severity: 'error',
      artifact,
      jsonPath: '$',
      message: `JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      relatedDiscrepancyIds: [],
      remediation: 'Provide valid JSON without duplicate member names.',
      status: 'open',
      evidence: [],
    };
    const structural = layerResult('structural', [finding]);
    const semantic = layerResult('semantic', []);
    const clinical = layerResult('clinical', []);
    const publish = layerResult('publish', [
      { ...finding, id: 'PUB-001', layer: 'publish', message: 'Structural validation failed.' },
    ]);
    return {
      artifact,
      structural,
      semantic,
      clinical,
      publish,
      publishEligible: false,
      errorCount: 2,
      warningCount: 0,
    };
  }
}
