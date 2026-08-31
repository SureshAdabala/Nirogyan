import { describe, expect, it } from 'vitest';

import { calculate } from './index';
import { evaluateExpression } from './expression';

const fixture = {
  calculatorSlug: 'engine-fixture',
  version: 1,
  parameters: [
    {
      key: 'age',
      label: 'Age',
      group: 'general',
      inputType: 'number',
      order: 1,
      unit: { canonical: 'years', allowed: [{ code: 'months', factor: 1 / 12 }] },
      validation: { required: true, min: 0, max: 120 },
      missingPolicy: 'block',
    },
    {
      key: 'smoker',
      label: 'Smoker',
      group: 'general',
      inputType: 'boolean',
      order: 2,
      missingPolicy: 'default-option',
      defaultOption: false,
    },
    {
      key: 'bmi',
      label: 'BMI',
      group: 'derived',
      inputType: 'derived',
      order: 3,
      unit: { canonical: 'kg/m2' },
      derived: {
        formula: 'weightKg / pow(heightCm / 100, 2)',
        dependsOn: ['weightKg', 'heightCm'],
      },
    },
    {
      key: 'heightCm',
      label: 'Height',
      group: 'general',
      inputType: 'number',
      order: 4,
      unit: { canonical: 'cm' },
    },
    {
      key: 'weightKg',
      label: 'Weight',
      group: 'general',
      inputType: 'number',
      order: 5,
      unit: { canonical: 'kg' },
    },
  ],
  scoringRules: [
    {
      parameterKey: 'age',
      contexts: [
        {
          when: null,
          bands: [
            { min: null, max: 40, points: 0 },
            { min: 40, max: null, points: 2 },
          ],
        },
      ],
    },
    {
      parameterKey: 'smoker',
      optionPoints: [
        { value: false, points: 0 },
        { value: true, points: 3 },
      ],
    },
    {
      parameterKey: 'bmi',
      contexts: [
        {
          when: null,
          bands: [
            { min: null, max: 25, points: 0 },
            { min: 25, max: null, points: 1 },
          ],
        },
      ],
    },
  ],
  formulas: [{ key: 'final-score', expression: 'sum(points)' }],
  domains: [
    { key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['age', 'smoker', 'bmi'] },
  ],
  resultCategories: {
    scale: { min: 0, max: 6, direction: 'higher-is-worse' },
    bandEdges: 'min-inclusive',
    bands: [
      { label: 'low', max: 2, color: '#00aa00' },
      { label: 'high', min: 2, color: '#aa0000' },
    ],
  },
};

describe('deterministic calculator engine', () => {
  it('evaluates expressions without dynamic code execution', () => {
    expect(evaluateExpression('age < 40 ? 2 : max(3, 1)', { values: { age: 35 } })).toBe(2);
    expect(evaluateExpression('sum(points) + 1', { values: { points: [1, 2] } })).toBe(4);
  });

  it('normalizes units, derives values, scores bands, and emits a trace', () => {
    const result = calculate(fixture, {
      age: { value: 480, unit: 'months' },
      smoker: true,
      heightCm: 170,
      weightKg: 80,
    });
    expect(result.ok).toBe(true);
    expect(result.score).toBe(6);
    expect(result.category?.label).toBe('high');
    expect(result.parameters.find((parameter) => parameter.key === 'age')?.value).toBe(40);
    expect(result.parameters.find((parameter) => parameter.key === 'bmi')?.value).toBeCloseTo(
      27.68166,
      4,
    );
    expect(result.trace.some((step) => step.kind === 'derived')).toBe(true);
  });

  it('honors explicit exclusive band overrides at scoring and result boundaries', () => {
    const boundaryFixture = {
      ...fixture,
      parameters: [fixture.parameters[0]],
      scoringRules: [
        {
          parameterKey: 'age',
          bandEdges: 'min-inclusive',
          contexts: [
            {
              when: null,
              bands: [
                { min: 40, minExclusive: true, points: 2 },
                { max: 40, maxInclusive: true, points: 1 },
              ],
            },
          ],
        },
      ],
      domains: [{ key: 'overall', label: 'Overall', weight: 1, parameterKeys: ['age'] }],
      resultCategories: {
        scale: { min: 0, max: 2, direction: 'higher-is-worse' },
        bandEdges: 'min-inclusive',
        bands: [
          { label: 'high', min: 1, minExclusive: true, color: '#aa0000' },
          { label: 'low', max: 1, maxInclusive: true, color: '#00aa00' },
        ],
      },
    };

    const boundary = calculate(boundaryFixture, { age: 40 });
    expect(boundary.ok).toBe(true);
    expect(boundary.score).toBe(1);
    expect(boundary.category?.label).toBe('low');

    const aboveBoundary = calculate(boundaryFixture, { age: 40.001 });
    expect(aboveBoundary.ok).toBe(true);
    expect(aboveBoundary.score).toBe(2);
    expect(aboveBoundary.category?.label).toBe('high');
  });

  it('blocks missing required input and rejects unknown input', () => {
    const result = calculate(fixture, { heightCm: 170, weightKg: 80, extra: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors.some((item) => item.code === 'MISSING_REQUIRED_INPUT')).toBe(true);
    expect(result.errors.some((item) => item.code === 'UNKNOWN_PARAMETER')).toBe(true);
  });

  it('evaluates adjustments and floor penalties through reserved formula symbols', () => {
    const config = {
      ...fixture,
      parameters: fixture.parameters.slice(0, 2),
      scoringRules: [fixture.scoringRules[0], fixture.scoringRules[1]],
      formulas: [
        { key: 'final-score', expression: 'sum(points) + sum(adjustments) + floorPenalty' },
      ],
      adjustmentRules: [
        {
          key: 'smoker-adjustment',
          label: 'Smoking adjustment',
          optionParam: 'smoker',
          optionPoints: [
            { value: false, points: 0 },
            { value: true, points: 1 },
          ],
        },
      ],
      floorRules: [
        {
          key: 'smoker-floor',
          label: 'Smoking floor',
          appliesWhen: { all: [{ param: 'smoker', op: 'eq', value: true }] },
          tiers: [{ bandParam: 'age', min: 0, floorPct: 3 }],
        },
      ],
      resultCategories: {
        ...fixture.resultCategories,
        scale: { ...fixture.resultCategories.scale, max: 10 },
      },
    };
    const result = calculate(config, { age: 20, smoker: true });
    expect(result.ok).toBe(true);
    expect(result.score).toBe(7);
    expect(result.trace.some((step) => step.kind === 'adjustment')).toBe(true);
    expect(result.trace.some((step) => step.kind === 'floor')).toBe(true);
  });

  it('returns a no-score context error instead of silently assigning zero points', () => {
    const config = {
      ...fixture,
      scoringRules: [
        {
          ...fixture.scoringRules[0],
          contexts: [
            { when: { param: 'age', op: 'gt', value: 200 }, bands: [{ min: 0, points: 1 }] },
          ],
        },
      ],
    };
    const result = calculate(config, { age: 40, heightCm: 170, weightKg: 80 });
    expect(result.ok).toBe(false);
    expect(result.errors.some((item) => item.code === 'NO_SCORING_CONTEXT')).toBe(true);
  });

  it('enforces explicit arithmetic domains and decimal half-away-from-zero rounding', () => {
    expect(evaluateExpression('round(-1.25, 1)', { values: {} })).toBe(-1.3);
    expect(() => evaluateExpression('sqrt(-1)', { values: {} })).toThrow(/non-negative/);
    expect(() => evaluateExpression('ln(0)', { values: {} })).toThrow(/greater than zero/);
    expect(() => evaluateExpression('1 / 0', { values: {} })).toThrow(/Division by zero/);
  });
});
