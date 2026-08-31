import { describe, expect, it } from 'vitest';

import { evaluateCondition, isConditionVisible, valuesForVisibility } from './conditions';
import { createInitialRendererState } from './reducer';
import { visibleParameterKeys } from './structure';
import { rendererFixture } from './test-fixture';

describe('locked client visibility semantics', () => {
  it('does not coerce types and treats ordinary comparisons with missing values as false', () => {
    expect(evaluateCondition({ param: 'answer', op: 'ne', value: false }, {})).toBe(false);
    expect(evaluateCondition({ param: 'answer', op: 'missing' }, {})).toBe(true);
    expect(evaluateCondition({ param: 'answer', op: 'exists' }, {})).toBe(false);
    expect(evaluateCondition({ param: 'count', op: 'eq', value: 2 }, { count: '2' })).toBe(false);
  });

  it('evaluates nested all, any and not conditions without inventing operators', () => {
    const condition = {
      all: [
        { param: 'enabled', op: 'eq' as const, value: true },
        {
          any: [
            { param: 'count', op: 'gte' as const, value: 2 },
            { not: { param: 'mode', op: 'eq' as const, value: 'blocked' } },
          ],
        },
      ],
    };
    expect(evaluateCondition(condition, { enabled: true, count: 2, mode: 'blocked' })).toBe(true);
    expect(evaluateCondition(condition, { enabled: false, count: 5, mode: 'open' })).toBe(false);
  });

  it('keeps unavailable aggregate/formula predicates unknown even below not', () => {
    const aggregate = { aggregate: 'computed', op: 'exists' as const };
    const redacted = { unavailable: true } as const;
    expect(evaluateCondition(aggregate, {})).toBe('unknown');
    expect(evaluateCondition({ formula: 'private-formula', op: 'exists' }, {})).toBe('unknown');
    expect(evaluateCondition(redacted, {})).toBe('unknown');
    expect(evaluateCondition({ not: aggregate }, {})).toBe('unknown');
    expect(isConditionVisible({ not: aggregate }, {})).toBe(false);
  });

  it('removes skipped values before evaluating dependent visibility', () => {
    expect(valuesForVisibility({ gate: true, other: 4 }, { gate: true })).toEqual({ other: 4 });
  });

  it('evaluates numeric parameter predicates in canonical units', () => {
    const fixture = rendererFixture();
    const config = {
      ...fixture,
      parameters: fixture.parameters.map((parameter) =>
        parameter.key === 'optionalValue'
          ? { ...parameter, visibility: { param: 'quantity', op: 'gt' as const, value: 100 } }
          : parameter,
      ),
    };
    const state = {
      ...createInitialRendererState(config),
      values: { quantity: 2 },
      units: { quantity: 'large-unit', optionalValue: 'unit' },
    };
    expect(visibleParameterKeys(config, state).has('optionalValue')).toBe(true);
  });
});
