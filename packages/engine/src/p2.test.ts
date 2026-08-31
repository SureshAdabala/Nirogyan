import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSourceGapMatrix, calculate } from './index';

type Json = Record<string, unknown>;

function config(overrides: Json = {}): Json {
  return {
    calculatorSlug: 'p2-policy-fixture',
    version: 1,
    parameters: [
      {
        key: 'value',
        label: 'Value',
        group: 'main',
        inputType: 'number',
        order: 1,
        unit: { canonical: 'unit' },
        missingPolicy: 'block',
        validation: { min: 0, max: 10 },
      },
    ],
    scoringRules: [
      {
        parameterKey: 'value',
        contexts: [
          {
            when: null,
            bands: [
              { max: 5, points: 0 },
              { min: 5, points: 5 },
            ],
          },
        ],
      },
    ],
    domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['value'] }],
    domainAggregationPolicy: {
      zeroDenominator: 'unscored',
      missingDomainPolicy: 'exclude-and-renormalize',
      negativeDomainPolicy: 'preserve',
    },
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    resultCategories: {
      scale: { min: 0, max: 5, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        { label: 'low', max: 5, color: '#00aa00' },
        { label: 'high', min: 5, color: '#aa0000' },
      ],
    },
    uiConfig: {
      theme: { accent: '#000000' },
      steps: [{ key: 'main', title: 'Main', parameterGroups: ['main'] }],
      result: { layout: ['category'] },
    },
    ...overrides,
  };
}

describe('P2 coverage and policy stages', () => {
  it('records soft bounds after canonical conversion without blocking the score', () => {
    const result = calculate(
      config({
        parameters: [
          {
            ...(config().parameters as Json[])[0],
            unit: {
              canonical: 'C',
              allowed: [{ code: 'F', factor: 5 / 9, offset: -17.77777777777778 }],
            },
            validation: { min: 30, max: 45, softMin: 36, softMax: 38 },
          },
        ],
        scoringRules: [
          {
            parameterKey: 'value',
            contexts: [
              {
                when: null,
                bands: [
                  { max: 40, points: 0 },
                  { min: 40, points: 5 },
                ],
              },
            ],
          },
        ],
      }),
      { value: { value: 95, unit: 'F' } },
    );

    expect(result.ok).toBe(true);
    expect(result.parameters[0]?.value).toBeCloseTo(35);
    expect(result.warnings).toEqual(['inputs.value: Value is below the review range of 36 C.']);
  });

  it('applies hard validation when a numeric parameter has no unit declaration', () => {
    const result = calculate(
      config({
        parameters: [
          {
            ...(config().parameters as Json[])[0],
            unit: undefined,
            validation: { min: 0, max: 10 },
          },
        ],
      }),
      { value: 11 },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'INVALID_INPUT',
      path: 'inputs.value',
      message: 'Value must be at most 10.',
    });
  });

  it('implements all missing policies without converting absence to false or zero', () => {
    const blocked = calculate(config(), {});
    expect(blocked.ok).toBe(false);
    expect(blocked.errors.some((error) => error.code === 'MISSING_REQUIRED_INPUT')).toBe(true);

    const zero = calculate(
      config({
        parameters: [{ ...(config().parameters as Json[])[0], missingPolicy: 'zero-points' }],
      }),
      {},
    );
    expect(zero.ok).toBe(true);
    expect(zero.parameters[0]?.points).toBe(0);
    expect(zero.parameters[0]?.possiblePoints).toBe(5);
    expect(zero.coverage.parameterCoverage).toBe(1);

    const excluded = calculate(
      config({
        parameters: [{ ...(config().parameters as Json[])[0], missingPolicy: 'exclude-from-max' }],
      }),
      {},
    );
    expect(excluded.ok).toBe(false);
    expect(excluded.parameters[0]?.points).toBeUndefined();
    expect(excluded.coverage.possiblePoints).toBe(0);

    const defaulted = calculate(
      config({
        parameters: [
          {
            key: 'value',
            label: 'Value',
            group: 'main',
            inputType: 'select',
            options: [{ value: 'yes', label: 'Yes' }],
            defaultOption: 'yes',
            missingPolicy: 'default-option',
            order: 1,
          },
        ],
        scoringRules: [{ parameterKey: 'value', optionPoints: [{ value: 'yes', points: 2 }] }],
        resultCategories: {
          scale: { min: 0, max: 2, direction: 'higher-is-worse' },
          bandEdges: 'min-inclusive',
          bands: [
            { label: 'low', max: 2, color: '#00aa00' },
            { label: 'high', min: 2, color: '#aa0000' },
          ],
        },
      }),
      {},
    );
    expect(defaulted.ok).toBe(true);
    expect(defaulted.parameters[0]?.value).toBe('yes');
    expect(defaulted.trace.some((step) => step.kind === 'normalization')).toBe(true);

    const imputed = calculate(
      config({
        parameters: [
          {
            ...(config().parameters as Json[])[0],
            key: 'age',
            validation: { min: 0, max: 120 },
            missingPolicy: 'block',
          },
          {
            ...(config().parameters as Json[])[0],
            key: 'value',
            order: 2,
            missingPolicy: 'impute-rule',
          },
        ],
        scoringRules: [
          {
            parameterKey: 'age',
            contexts: [
              {
                when: null,
                bands: [
                  { max: 40, points: 0 },
                  { min: 40, points: 1 },
                ],
              },
            ],
          },
          {
            parameterKey: 'value',
            contexts: [
              {
                when: null,
                bands: [
                  { max: 5, points: 0 },
                  { min: 5, points: 5 },
                ],
              },
            ],
          },
        ],
        domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['age', 'value'] }],
        imputationRules: [
          {
            key: 'value-by-age',
            parameterKey: 'value',
            when: { param: 'value', op: 'missing' },
            action: {
              setPointsByBand: {
                bandParam: 'age',
                bands: [
                  { max: 40, points: 0 },
                  { min: 40, points: 5 },
                ],
              },
            },
            fallbackPolicy: 'block',
          },
        ],
        resultCategories: {
          scale: { min: 0, max: 6, direction: 'higher-is-worse' },
          bandEdges: 'min-inclusive',
          bands: [
            { label: 'low', max: 3, color: '#00aa00' },
            { label: 'high', min: 3, color: '#aa0000' },
          ],
        },
      }),
      { age: 50 },
    );
    expect(imputed.ok).toBe(true);
    expect(imputed.parameters.find((parameter) => parameter.key === 'value')?.imputed).toBe(true);
    expect(imputed.parameters.find((parameter) => parameter.key === 'value')?.points).toBe(5);
  });

  it('ignores stale non-applicable input and records it in the trace', () => {
    const result = calculate(
      config({
        parameters: [
          ...(config().parameters as Json[]),
          {
            key: 'optional',
            label: 'Optional',
            group: 'main',
            inputType: 'number',
            order: 2,
            visibility: { param: 'value', op: 'lt', value: 0 },
            missingPolicy: 'exclude-from-max',
          },
        ],
        scoringRules: [
          ...(config().scoringRules as Json[]),
          { parameterKey: 'optional', contexts: [{ when: null, bands: [{ max: 10, points: 3 }] }] },
        ],
      }),
      { value: 8, optional: 9 },
    );
    expect(result.ok).toBe(true);
    expect(result.parameters.find((parameter) => parameter.key === 'optional')?.applicable).toBe(
      false,
    );
    expect(
      result.trace.some((step) => step.key === 'optional' && step.detail?.ignored === true),
    ).toBe(true);
  });

  it('returns a documented source-gap no-score and exposes coverage separately', () => {
    const result = calculate(
      config({
        scoringRules: [
          {
            parameterKey: 'value',
            asWritten: true,
            clarificationRefs: ['P2-GAP'],
            contexts: [
              {
                when: null,
                bands: [
                  { max: 5, points: 0 },
                  { min: 6, points: 5 },
                ],
              },
            ],
          },
        ],
      }),
      { value: 5.5 },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === 'NO_SCORING_BAND')).toBe(true);
    expect(result.coverage.entries.find((entry) => entry.key === 'value')?.sourceGap).toBe(true);
    expect(
      result.coverage.entries.find((entry) => entry.key === 'value')?.clarificationRefs,
    ).toEqual(['P2-GAP']);
    expect(buildSourceGapMatrix(resultConfigForGap())).toEqual([
      expect.objectContaining({ key: 'value', documented: true, from: 5, to: 6 }),
    ]);
  });

  it('enforces explicit aggregate empty policy and domain policy choices', () => {
    const aggregate = calculate(
      config({
        parameters: [
          { ...(config().parameters as Json[])[0], missingPolicy: 'exclude-from-group' },
        ],
        parameterGroupsAggregation: [
          { key: 'group-max', label: 'Group max', aggregate: 'max', parameterKeys: ['value'] },
        ],
        domains: [
          {
            key: 'overall',
            label: 'Overall',
            weight: 1,
            parameterKeys: [],
            aggregateKeys: ['group-max'],
          },
        ],
      }),
      {},
    );
    expect(aggregate.errors.some((error) => error.code === 'AGGREGATE_EMPTY')).toBe(true);

    const multiDomain = config({
      parameters: [
        { ...(config().parameters as Json[])[0], missingPolicy: 'exclude-from-max' },
        {
          ...(config().parameters as Json[])[0],
          key: 'second',
          order: 2,
          missingPolicy: 'exclude-from-max',
        },
      ],
      scoringRules: [
        ...(config().scoringRules as Json[]),
        { parameterKey: 'second', contexts: [{ when: null, bands: [{ max: 10, points: 5 }] }] },
      ],
      domains: [
        { key: 'first', label: 'First', weight: 0.5, parameterKeys: ['value'] },
        { key: 'second-domain', label: 'Second', weight: 0.5, parameterKeys: ['second'] },
      ],
      domainAggregationPolicy: {
        zeroDenominator: 'unscored',
        missingDomainPolicy: 'block',
        negativeDomainPolicy: 'preserve',
      },
    });
    const blocked = calculate(multiDomain, { second: 8 });
    expect(blocked.ok).toBe(false);
    expect(blocked.errors.some((error) => error.code === 'DOMAIN_UNSCORABLE')).toBe(true);
    const renormalized = calculate(
      {
        ...multiDomain,
        domainAggregationPolicy: {
          zeroDenominator: 'unscored',
          missingDomainPolicy: 'exclude-and-renormalize',
          negativeDomainPolicy: 'preserve',
        },
      },
      { second: 8 },
    );
    expect(renormalized.ok).toBe(true);
    expect(renormalized.coverage.possibleWeightCoverage).toBe(0.5);
  });

  it('keeps per-domain formula scope isolated from global formulas', () => {
    const result = calculate(
      config({
        formulas: [
          { key: 'domain-score', scope: 'per-domain', expression: 'sum(points) / maxPoints * 100' },
          { key: 'final-score', expression: 'weightedSum(domains)' },
        ],
        resultCategories: {
          scale: { min: 0, max: 100, direction: 'higher-is-worse' },
          bandEdges: 'min-inclusive',
          bands: [
            { label: 'low', max: 100, color: '#00aa00' },
            { label: 'high', min: 100, color: '#aa0000' },
          ],
        },
      }),
      { value: 8 },
    );
    expect(result.ok).toBe(true);
    expect(result.domains[0]?.formulas?.['domain-score']).toBe(100);
    expect(result.score).toBe(100);
  });

  it('applies an excluded derived parameter policy when a dependency is absent', () => {
    const result = calculate(
      config({
        parameters: [
          {
            key: 'source',
            label: 'Source',
            group: 'main',
            inputType: 'number',
            order: 1,
            missingPolicy: 'exclude-from-max',
          },
          {
            key: 'value',
            label: 'Value',
            group: 'main',
            inputType: 'derived',
            order: 2,
            missingPolicy: 'exclude-from-max',
            derived: { formula: 'source * 2', dependsOn: ['source'] },
          },
        ],
        scoringRules: [
          {
            parameterKey: 'value',
            contexts: [{ when: null, bands: [{ max: 10, points: 1 }] }],
          },
        ],
      }),
      {},
    );

    expect(result.parameters.find((parameter) => parameter.key === 'value')).toEqual(
      expect.objectContaining({ missing: true, status: 'excluded' }),
    );
    expect(result.errors.some((error) => error.code === 'DERIVATION_ERROR')).toBe(false);
  });

  it('fails closed when more than one imputation band owns the dependency value', () => {
    const result = calculate(
      config({
        parameters: [
          {
            ...(config().parameters as Json[])[0],
            key: 'age',
            validation: { min: 0, max: 100 },
          },
          {
            ...(config().parameters as Json[])[0],
            key: 'value',
            order: 2,
            missingPolicy: 'impute-rule',
          },
        ],
        imputationRules: [
          {
            parameterKey: 'value',
            when: { param: 'value', op: 'missing' },
            action: {
              setPointsByBand: {
                bandParam: 'age',
                bands: [
                  { min: 40, max: 50, maxInclusive: true, points: 1 },
                  { min: 50, points: 2 },
                ],
              },
            },
          },
        ],
      }),
      { age: 50 },
    );

    expect(
      result.parameters.find((parameter) => parameter.key === 'value')?.points,
    ).toBeUndefined();
    expect(
      result.errors.some(
        (error) => error.code === 'BLOCKED_BY_POLICY' && error.path === 'imputationRules.value',
      ),
    ).toBe(true);
  });

  it('reports an unresolved aggregate-dependent imputation instead of silently excluding it', () => {
    const result = calculate(
      config({
        parameters: [
          { ...(config().parameters as Json[])[0], key: 'member' },
          {
            ...(config().parameters as Json[])[0],
            key: 'value',
            order: 2,
            missingPolicy: 'impute-rule',
          },
        ],
        scoringRules: [
          {
            parameterKey: 'member',
            contexts: [{ when: null, bands: [{ max: 10, points: 0 }] }],
          },
          (config().scoringRules as Json[])[0],
        ],
        parameterGroupsAggregation: [
          {
            key: 'member-max',
            aggregate: 'max',
            parameterKeys: ['member'],
            emptyPolicy: 'block',
          },
        ],
        imputationRules: [
          {
            parameterKey: 'value',
            when: { aggregate: 'member-max', op: 'gte', value: 10 },
            action: { setPoints: 5 },
          },
        ],
      }),
      { member: 1 },
    );

    expect(
      result.parameters.find((parameter) => parameter.key === 'value')?.points,
    ).toBeUndefined();
    expect(
      result.errors.some(
        (error) => error.code === 'BLOCKED_BY_POLICY' && error.path === 'imputationRules.value',
      ),
    ).toBe(true);
  });
});

function resultConfigForGap(): Json {
  return config({
    scoringRules: [
      {
        parameterKey: 'value',
        asWritten: true,
        clarificationRefs: ['P2-GAP'],
        contexts: [
          {
            when: null,
            bands: [
              { max: 5, points: 0 },
              { min: 6, points: 5 },
            ],
          },
        ],
      },
    ],
  });
}

function diabetesDiagnosticConfig(): Json {
  const configPath = join(
    process.cwd(),
    '..',
    '..',
    'data',
    'fixtures',
    'config-samples',
    'diabetes-risk.config.json',
  );
  return JSON.parse(readFileSync(configPath, 'utf8')) as Json;
}

function diabetesDiagnosticInputs(overrides: Json = {}): Json {
  return {
    age: 50,
    sex: 'male',
    waistCm: 80,
    physicalActivity: 'regular',
    familyHistory: 'none',
    ppSugar: 'normal',
    ...overrides,
  };
}

function lookupDiagnosticConfig(table: Json): Json {
  return config({
    parameters: [
      {
        ...(config().parameters as Json[])[0],
        validation: { min: -100, max: 100 },
      },
    ],
    scoringRules: [
      {
        parameterKey: 'value',
        bandEdges: 'min-inclusive',
        contexts: [
          {
            when: null,
            bands: [
              { min: -100, max: 0, points: 0 },
              { min: 0, max: 100, maxInclusive: true, points: 1 },
            ],
          },
        ],
      },
    ],
    lookupTables: [table],
    formulas: [{ key: 'final-score', expression: "lookup('risk', value)" }],
    resultCategories: {
      scale: { min: 0, max: 100, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [{ label: 'result', min: 0, max: 100, maxInclusive: true, color: '#00aa00' }],
    },
  });
}

describe('lookup boundary sentinels', () => {
  it('normalizes legacy map rows and applies orBelow/orAbove without changing exact matches', () => {
    const lookup = lookupDiagnosticConfig({
      key: 'risk',
      map: [
        { points: -2, riskPct: 0.9, orBelow: true },
        { points: 13, riskPct: 10 },
        { points: 21, riskPct: 30.1, orAbove: true },
      ],
    });

    expect(calculate(lookup, { value: -5 }).score).toBe(0.9);
    expect(calculate(lookup, { value: 13 }).score).toBe(10);
    expect(calculate(lookup, { value: 37 }).score).toBe(30.1);
  });

  it('applies modern entry sentinels in their declared directions without nearest fallback', () => {
    const lookup = lookupDiagnosticConfig({
      key: 'risk',
      entries: [
        { input: -2, output: 0.9, orBelow: true },
        { input: 13, output: 10 },
        { input: 21, output: 30.1, orAbove: true },
      ],
    });

    expect(calculate(lookup, { value: -5 }).score).toBe(0.9);
    expect(calculate(lookup, { value: 13 }).score).toBe(10);
    expect(calculate(lookup, { value: 37 }).score).toBe(30.1);
    expect(calculate(lookup, { value: 14 }).errors).toContainEqual({
      code: 'LOOKUP_MISS',
      path: 'formulas.final-score',
      message: 'No lookup entry for 14 in "risk".',
    });
  });
});

describe('source-bound P2 golden', () => {
  it('reproduces the source Heart base-stage 13 points → 10% example', () => {
    const configPath = join(
      process.cwd(),
      '..',
      '..',
      'data',
      'fixtures',
      'config-samples',
      'heart-risk.config.json',
    );
    const heart = JSON.parse(readFileSync(configPath, 'utf8')) as Json;
    // The source example intentionally omits LDL because it validates only
    // the base Framingham stage. The config requires LDL for the later lipid
    // adjustment, so a neutral supplemental value is supplied here and only
    // the source-approved base formulas are asserted.
    const result = calculate(heart, {
      age: 58,
      totalCholesterol: 168,
      ldl: 100,
      hdl: 38,
      sbp: 124,
      bpTreated: false,
      smoker: true,
      glycemicStatus: 'normal',
    });
    expect(result.ok).toBe(true);
    expect(result.formulas['base-points']).toBe(13);
    expect(result.formulas['base-risk']).toBe(10);
    expect(result.trace.some((step) => step.kind === 'formula' && step.key === 'base-risk')).toBe(
      true,
    );
  });
});

/**
 * These checks preserve and expose unresolved, source-transcribed Diabetes
 * behavior. They are engineering diagnostics only: none is a clinical
 * decision, an approved boundary, a source-worked example, or PUB-007 evidence.
 */
describe('Diabetes fail-closed diagnostics (not source goldens or PUB-007 evidence)', () => {
  it('[DIA-06] fails when all glycemic members are absent and no empty policy exists', () => {
    const result = calculate(
      diabetesDiagnosticConfig(),
      diabetesDiagnosticInputs({ ppSugar: undefined }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'AGGREGATE_EMPTY',
      path: 'parameterGroupsAggregation.glycemicIndex',
      message: 'An empty aggregate requires an explicit emptyPolicy.',
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'EXPRESSION_ERROR', path: 'formulas.final-score' }),
    );
    expect(result.formulas['final-score']).toBeUndefined();
    expect(
      result.trace.find((step) => step.kind === 'aggregate' && step.key === 'glycemicIndex'),
    ).toEqual(
      expect.objectContaining({
        value: undefined,
        detail: expect.objectContaining({ empty: true }),
      }),
    );
  });

  it('[DIA-07] fails when waist is missing below the glycemic trigger and no fallback exists', () => {
    const result = calculate(
      diabetesDiagnosticConfig(),
      diabetesDiagnosticInputs({ waistCm: undefined, hba1c: 5 }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'BLOCKED_BY_POLICY',
      path: 'imputationRules.waistCm',
      message:
        'No aggregate-dependent imputation rule applied and no reachable fallback supplied a contribution.',
    });
    const waist = result.parameters.find((parameter) => parameter.key === 'waistCm');
    expect(waist).toEqual(expect.objectContaining({ status: 'excluded' }));
    expect(waist?.imputed).toBeUndefined();
    expect(
      result.trace.find((step) => step.kind === 'aggregate' && step.key === 'glycemicIndex'),
    ).toEqual(expect.objectContaining({ value: 0 }));
    expect(
      result.trace.some(
        (step) => step.key === 'waistCm' && step.kind === 'score' && step.detail?.imputed === true,
      ),
    ).toBe(false);
  });

  it('[DIA-13] leaves an accepted noninteger age in the 49-to-50 gap unscored', () => {
    const result = calculate(
      diabetesDiagnosticConfig(),
      diabetesDiagnosticInputs({ age: 49.5, hba1c: 5 }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      code: 'NO_SCORING_BAND',
      path: 'scoringRules.age',
      message: 'No score band matches value 49.5.',
    });
    expect(result.parameters.find((parameter) => parameter.key === 'age')?.points).toBeUndefined();
    expect(result.trace.some((step) => step.kind === 'score' && step.key === 'age')).toBe(false);
  });

  it('[DIA-02/DIA-03] records exact configured endpoints and adjacent source gaps without harmonizing them', () => {
    const exactCases = [
      { key: 'hba1c', value: 6.5 },
      { key: 'fbs', value: 126 },
    ] as const;
    for (const diagnostic of exactCases) {
      const result = calculate(
        diabetesDiagnosticConfig(),
        diabetesDiagnosticInputs({ [diagnostic.key]: diagnostic.value }),
      );
      expect(result.ok, diagnostic.key).toBe(true);
      expect(
        result.parameters.find((parameter) => parameter.key === diagnostic.key)?.points,
        diagnostic.key,
      ).toBe(20);
      expect(
        result.trace.find((step) => step.kind === 'aggregate' && step.key === 'glycemicIndex')
          ?.value,
        diagnostic.key,
      ).toBe(20);
    }

    const gapCases = [
      { key: 'hba1c', value: 6.45 },
      { key: 'fbs', value: 125.5 },
    ] as const;
    for (const diagnostic of gapCases) {
      const result = calculate(
        diabetesDiagnosticConfig(),
        diabetesDiagnosticInputs({ [diagnostic.key]: diagnostic.value }),
      );
      expect(result.ok, diagnostic.key).toBe(false);
      expect(result.errors, diagnostic.key).toContainEqual({
        code: 'NO_SCORING_BAND',
        path: `scoringRules.${diagnostic.key}`,
        message: `No score band matches value ${diagnostic.value}.`,
      });
      expect(
        result.parameters.find((parameter) => parameter.key === diagnostic.key)?.points,
        diagnostic.key,
      ).toBeUndefined();
    }
  });

  it('[DIA-09] exposes the reachable 110 score as outside the declared 0-to-100 scale', () => {
    const result = calculate(
      diabetesDiagnosticConfig(),
      diabetesDiagnosticInputs({
        waistCm: 91,
        physicalActivity: 'sedentary',
        familyHistory: 'both-parents',
        hba1c: 7,
        ppSugar: undefined,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.formulas['final-score']).toBe(110);
    expect(result.domains[0]).toEqual(
      expect.objectContaining({ earnedPoints: 110, possiblePoints: 110 }),
    );
    expect(result.errors).toContainEqual({
      code: 'SCALE_ASSERTION_FAILED',
      path: 'resultCategories.scale',
      message: 'Score 110 is outside the declared result scale.',
    });
  });

  it('[DIA-05/DIA-08] counts glycemic max once and traces missing-target-only waist imputation', () => {
    const diabetes = diabetesDiagnosticConfig();
    const result = calculate(diabetes, {
      age: 50,
      sex: 'male',
      physicalActivity: 'regular',
      familyHistory: 'none',
      hba1c: 6,
      ppSugar: 'normal',
    });

    expect(result.ok).toBe(true);
    expect(result.parameters.find((parameter) => parameter.key === 'hba1c')?.points).toBe(10);
    expect(result.parameters.find((parameter) => parameter.key === 'ppSugar')?.points).toBe(0);
    expect(result.parameters.find((parameter) => parameter.key === 'waistCm')).toEqual(
      expect.objectContaining({ points: 10, imputed: true }),
    );
    expect(result.domains[0]).toEqual(
      expect.objectContaining({ earnedPoints: 50, possiblePoints: 110 }),
    );
    expect(
      result.trace.find((step) => step.kind === 'aggregate' && step.key === 'glycemicIndex'),
    ).toEqual(expect.objectContaining({ value: 10 }));
    expect(result.trace.find((step) => step.kind === 'score' && step.key === 'waistCm')).toEqual(
      expect.objectContaining({
        value: 10,
        detail: expect.objectContaining({ imputed: true, aggregateDependencies: true }),
      }),
    );
    expect(result.formulas['final-score']).toBe(50);
    expect(
      result.trace.find((step) => step.kind === 'formula' && step.key === 'final-score'),
    ).toEqual(expect.objectContaining({ value: 50 }));
  });

  it('[DIA-08] does not overwrite a present waist when the glycemic trigger matches', () => {
    const result = calculate(diabetesDiagnosticConfig(), diabetesDiagnosticInputs({ hba1c: 6 }));

    expect(result.ok).toBe(true);
    expect(result.parameters.find((parameter) => parameter.key === 'waistCm')).toEqual(
      expect.objectContaining({ input: 80, value: 80, points: 0, imputed: false }),
    );
    const waistScoreTraces = result.trace.filter(
      (step) => step.kind === 'score' && step.key === 'waistCm',
    );
    expect(waistScoreTraces).toHaveLength(1);
    expect(waistScoreTraces[0]).toEqual(
      expect.objectContaining({
        value: 0,
        detail: expect.objectContaining({ input: 80, imputed: false }),
      }),
    );
    expect(result.formulas['final-score']).toBe(40);
  });
});
