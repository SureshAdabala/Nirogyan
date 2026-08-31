import { describe, expect, it } from 'vitest';

import type { PublicParameterConfig } from './types';
import { canSkipParameter, validateParameter } from './validation';

const numberParameter: PublicParameterConfig = {
  key: 'quantity',
  label: 'Quantity',
  group: 'fixture',
  inputType: 'number',
  unit: { canonical: 'base', allowed: [{ code: 'scaled', factor: 10 }] },
  validation: { required: true, min: 10, max: 100, softMin: 20, softMax: 80 },
  missingPolicy: 'block',
  order: 1,
};

describe('config-driven field validation', () => {
  it('applies hard bounds after canonical conversion', () => {
    expect(validateParameter(numberParameter, 2, 'scaled', false)).toEqual({});
    expect(validateParameter(numberParameter, 0.9, 'scaled', false).error).toContain('at least 10');
    expect(validateParameter(numberParameter, 11, 'scaled', false).error).toContain('at most 100');
  });

  it('keeps soft warnings separate and nonblocking', () => {
    expect(validateParameter(numberParameter, 1.5, 'scaled', false)).toEqual({
      warning: 'Quantity is unusually low. Double-check the value and unit.',
    });
    expect(validateParameter(numberParameter, 9, 'scaled', false)).toEqual({
      warning: 'Quantity is unusually high. Double-check the value and unit.',
    });
  });

  it('preserves unanswered versus false for Boolean inputs', () => {
    const booleanParameter: PublicParameterConfig = {
      key: 'answer',
      label: 'Answer',
      group: 'fixture',
      inputType: 'boolean',
      validation: { required: true },
      missingPolicy: 'block',
      order: 1,
    };
    expect(validateParameter(booleanParameter, undefined, undefined, false).error).toContain(
      'required',
    );
    expect(validateParameter(booleanParameter, false, undefined, false)).toEqual({});
  });

  it('matches select options without string coercion', () => {
    const select: PublicParameterConfig = {
      key: 'choice',
      label: 'Choice',
      group: 'fixture',
      inputType: 'select',
      options: [{ value: 1, label: 'One' }],
      missingPolicy: 'block',
      order: 1,
    };
    expect(validateParameter(select, 1, undefined, false)).toEqual({});
    expect(validateParameter(select, '1', undefined, false).error).toContain('valid option');
  });

  it('offers skip only for explicit nonblocking policies', () => {
    expect(
      canSkipParameter({ ...numberParameter, validation: {}, missingPolicy: 'exclude-from-max' }),
    ).toBe(true);
    expect(canSkipParameter(numberParameter)).toBe(false);
    expect(canSkipParameter({ ...numberParameter, validation: {}, missingPolicy: undefined })).toBe(
      false,
    );
  });
});
