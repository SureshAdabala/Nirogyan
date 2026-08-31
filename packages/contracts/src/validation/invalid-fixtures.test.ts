import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateCalculatorVersion } from './calculator';

const fixturePath = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'data',
  'fixtures',
  'config-samples',
  'covid-risk.config.json',
);
const base = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;

function clone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

const invalidFixtures: readonly [string, (config: Record<string, unknown>) => void][] = [
  ['missing-name', (config) => delete config.name],
  [
    'unknown-root-property',
    (config) => {
      config.unknown = true;
    },
  ],
  [
    'bad-slug',
    (config) => {
      config.calculatorSlug = 'Not A Slug';
    },
  ],
  [
    'duplicate-parameter-key',
    (config) => {
      const params = config.parameters as Record<string, unknown>[];
      params.push({ ...params[0] });
    },
  ],
  [
    'unknown-score-parameter',
    (config) => {
      const rules = config.scoringRules as Record<string, unknown>[];
      rules[0]!.parameterKey = 'missing';
    },
  ],
  [
    'duplicate-scoring-rule',
    (config) => {
      const rules = config.scoringRules as Record<string, unknown>[];
      rules.push({ ...rules[0] });
    },
  ],
  [
    'missing-option-points',
    (config) => {
      const rules = config.scoringRules as Record<string, unknown>[];
      delete rules[0]!.contexts;
    },
  ],
  [
    'unknown-group-parameter',
    (config) => {
      config.parameterGroupsAggregation = [
        { key: 'g', label: 'g', aggregate: 'max', parameterKeys: ['missing'] },
      ];
    },
  ],
  [
    'missing-group-empty-policy',
    (config) => {
      config.parameterGroupsAggregation = [
        { key: 'g', label: 'g', aggregate: 'max', parameterKeys: ['age'] },
      ];
    },
  ],
  [
    'bad-domain-weight',
    (config) => {
      const domains = config.domains as Record<string, unknown>[];
      domains[0]!.weight = 0.5;
    },
  ],
  [
    'missing-final-formula',
    (config) => {
      const formulas = config.formulas as Record<string, unknown>[];
      formulas[0]!.key = 'not-final';
    },
  ],
  [
    'unknown-formula-symbol',
    (config) => {
      const formulas = config.formulas as Record<string, unknown>[];
      formulas[0]!.expression = 'unknownValue + 1';
    },
  ],
  [
    'overlapping-bands',
    (config) => {
      const rules = config.scoringRules as Record<string, unknown>[];
      const context = (rules[0]!.contexts as Record<string, unknown>[])[0]!;
      const bands = context.bands as Record<string, unknown>[];
      bands.push({ min: bands[0]!.min, max: bands[0]!.max, points: 99 });
    },
  ],
  [
    'missing-optional-policy',
    (config) => {
      const params = config.parameters as Record<string, unknown>[];
      const scored = params.find((parameter) => parameter.inputType !== 'derived')!;
      delete scored.missingPolicy;
      if (scored.validation && typeof scored.validation === 'object')
        delete (scored.validation as Record<string, unknown>).required;
    },
  ],
  [
    'invalid-unit-factor',
    (config) => {
      const params = config.parameters as Record<string, unknown>[];
      params[0]!.unit = { canonical: 'x', allowed: [{ code: 'bad', factor: 0 }] };
    },
  ],
  [
    'invalid-default-option',
    (config) => {
      const params = config.parameters as Record<string, unknown>[];
      const select = params.find((parameter) => parameter.inputType === 'select')!;
      select.defaultOption = 'missing';
    },
  ],
  [
    'invalid-scale',
    (config) => {
      const categories = config.resultCategories as Record<string, unknown>;
      categories.scale = { min: 1, max: 1, direction: 'higher-is-worse' };
    },
  ],
  [
    'duplicate-lookup-entry',
    (config) => {
      config.lookupTables = [
        {
          key: 'lookup',
          label: 'lookup',
          entries: [
            { input: 1, output: 1 },
            { input: 1, output: 2 },
          ],
        },
      ];
    },
  ],
  [
    'imputation-without-fallback',
    (config) => {
      config.imputationRules = [
        {
          key: 'impute',
          parameterKey: 'age',
          when: { param: 'age', op: 'missing' },
          action: { setPoints: 1 },
        },
      ];
    },
  ],
  [
    'content-orphan-claim',
    (config) => {
      config.content = {
        claims: [
          {
            id: 'claim',
            text: 'x',
            kind: 'medical-fact',
            citationIds: ['missing'],
            reviewStatus: 'unreviewed',
          },
        ],
      };
    },
  ],
  [
    'bad-domain-reference',
    (config) => {
      const domains = config.domains as Record<string, unknown>[];
      domains[0]!.parameterKeys = ['missing'];
    },
  ],
];

describe('P1 invalid calculator fixtures', () => {
  it('reports every crafted invalid configuration without throwing', () => {
    expect(invalidFixtures.length).toBeGreaterThanOrEqual(20);
    for (const [name, mutate] of invalidFixtures) {
      const config = clone();
      mutate(config);
      const result = validateCalculatorVersion(config, name);
      expect(result.errorCount, name).toBeGreaterThan(0);
    }
  });
});
