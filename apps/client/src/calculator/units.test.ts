import { describe, expect, it } from 'vitest';

import { availableUnits, fromCanonicalUnit, switchEnteredUnit, toCanonicalUnit } from './units';

const unit = {
  canonical: 'canonical',
  allowed: [
    { code: 'scaled', factor: 10, offset: 2 },
    { code: 'canonical', factor: 99 },
  ],
} as const;

describe('v1 unit conversion helpers', () => {
  it('uses canonical = entered * factor + offset and its exact inverse', () => {
    expect(toCanonicalUnit(3, 'scaled', unit)).toBe(32);
    expect(fromCanonicalUnit(32, 'scaled', unit)).toBe(3);
  });

  it('adds the implicit identity once and ignores a duplicate configured canonical code', () => {
    expect(availableUnits(unit)).toEqual([
      { code: 'canonical', factor: 1, offset: 0 },
      { code: 'scaled', factor: 10, offset: 2 },
    ]);
  });

  it('preserves the physical value and performs no display rounding on unit changes', () => {
    const entered = switchEnteredUnit(32, 'canonical', 'scaled', unit);
    expect(entered).toBe(3);
    expect(switchEnteredUnit(entered, 'scaled', 'canonical', unit)).toBe(32);
  });

  it('fails closed for undeclared units and nonfinite inputs', () => {
    expect(toCanonicalUnit(2, 'unknown', unit)).toBeUndefined();
    expect(toCanonicalUnit(Number.POSITIVE_INFINITY, 'canonical', unit)).toBeUndefined();
  });
});
