import { describe, expect, it } from 'vitest';

import {
  formatReferenceInterval,
  referenceContextEntries,
  safePublicSourceUrl,
} from './range-format';

describe('biomarker range presentation', () => {
  it('preserves inclusive, exclusive, and unbounded interval semantics', () => {
    expect(formatReferenceInterval({ max: 100, maxInclusive: false }, 'mg/dL')).toBe('< 100 mg/dL');
    expect(formatReferenceInterval({ min: 5, minInclusive: true }, 'mg/L')).toBe('≥ 5 mg/L');
    expect(
      formatReferenceInterval({ min: 5.7, max: 6.4, minInclusive: true, maxInclusive: true }, '%'),
    ).toBe('≥ 5.7 and ≤ 6.4 %');
    expect(formatReferenceInterval({ min: 5 }, 'mg/L')).toBe('Boundary inclusivity not published');
    expect(formatReferenceInterval({ max: 100 }, 'mg/dL')).toBe(
      'Boundary inclusivity not published',
    );
    expect(formatReferenceInterval({}, 'mg/dL')).toBe('No numeric interval published');
  });

  it('does not round or rewrite high-precision and scientific thresholds', () => {
    const preciseThreshold = 0.12345678901234568;
    expect(
      formatReferenceInterval({ min: preciseThreshold, minInclusive: true }, 'synthetic-unit'),
    ).toBe(`≥ ${String(preciseThreshold)} synthetic-unit`);
    expect(formatReferenceInterval({ max: 1.2e-9, maxInclusive: false }, 'synthetic-unit')).toBe(
      '< 1.2e-9 synthetic-unit',
    );
    expect(formatReferenceInterval({ min: 1e21, minInclusive: false }, 'synthetic-unit')).toBe(
      '> 1e+21 synthetic-unit',
    );
  });

  it('renders every supported population and collection context explicitly', () => {
    expect(
      referenceContextEntries({
        sexAtBirth: 'female',
        ageMinYears: 18,
        ageMaxYears: 65,
        pregnancyStatus: 'not-pregnant',
        menopausalStatus: 'pre',
        fastingStatus: 'fasting',
        specimen: 'Serum',
        sampleTiming: '08:00–10:00',
        population: 'Reviewed adult cohort',
        method: 'Synthetic assay',
      }),
    ).toEqual([
      { label: 'Sex at birth', value: 'Female' },
      { label: 'Age', value: '18 to 65 years' },
      { label: 'Pregnancy', value: 'Not pregnant' },
      { label: 'Menopausal status', value: 'Pre' },
      { label: 'Preparation', value: 'Fasting' },
      { label: 'Specimen', value: 'Serum' },
      { label: 'Sample timing', value: '08:00–10:00' },
      { label: 'Population', value: 'Reviewed adult cohort' },
      { label: 'Method', value: 'Synthetic assay' },
    ]);
  });

  it('allows only HTTP(S) source links', () => {
    expect(safePublicSourceUrl('https://example.test/source')).toBe('https://example.test/source');
    expect(safePublicSourceUrl('http://example.test/source')).toBe('http://example.test/source');
    expect(safePublicSourceUrl('javascript:alert(1)')).toBeUndefined();
    expect(safePublicSourceUrl('not a url')).toBeUndefined();
  });
});
