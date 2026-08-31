import { describe, expect, it } from 'vitest';

import {
  prefillParameterFromBiomarker,
  summarizeCategoryCoverage,
  summarizeDomainAssignments,
  summarizeDomainWeights,
} from './editor-helpers';

describe('admin editor helpers', () => {
  it('prefills only canonical measurement authoring hints and preserves unrelated parameter fields', () => {
    const parameter = {
      key: 'existing-key',
      group: 'labs',
      order: 3,
      customExtension: { preserved: true },
      validation: { required: true },
    };
    const result = prefillParameterFromBiomarker(parameter, {
      key: 'fixture-marker',
      displayName: 'Fixture marker',
      canonicalUnit: 'legacy-envelope-unit',
      status: 'draft',
      definition: {
        canonicalUnit: { code: 'mg/L', dimension: 'mass-concentration' },
        acceptedUnits: [
          { code: 'mg/L', dimension: 'mass-concentration' },
          { code: 'g/L', dimension: 'mass-concentration' },
        ],
        conversions: [
          { kind: 'affine', fromUnit: 'g/L', toUnit: 'mg/L', factor: 1000, offset: 0 },
          { kind: 'affine', fromUnit: 'unsafe', toUnit: 'mg/L', factor: 3, offset: 0 },
          { kind: 'composite', adapter: 'not-copied', toUnit: 'mg/L' },
        ],
        inputBounds: {
          hard: { min: 0, max: 100, minInclusive: true, maxInclusive: true },
          soft: { min: 2, max: 80, minInclusive: true, maxInclusive: true },
          integerOnly: true,
        },
        description: {
          whatItMeasures: 'A synthetic quantity.',
          whyItMatters: 'Used only by an editor test.',
        },
        referenceRanges: [{ id: 'must-not-copy', interval: { min: 10, max: 20 } }],
        scoringRules: [{ points: 99 }],
      },
      provenance: { legacyRecord: { validation: { min: -999 }, niroScoring: { points: 50 } } },
    });

    expect(result).toMatchObject({
      key: 'existing-key',
      biomarkerKey: 'fixture-marker',
      label: 'Fixture marker',
      group: 'labs',
      order: 3,
      customExtension: { preserved: true },
      unit: { canonical: 'mg/L', allowed: [{ code: 'g/L', factor: 1000, offset: 0 }] },
      validation: { required: true, min: 0, max: 100, softMin: 2, softMax: 80, integer: true },
      helpText: 'A synthetic quantity. Used only by an editor test.',
    });
    expect(result).not.toHaveProperty('referenceRanges');
    expect(result).not.toHaveProperty('scoringRules');
    expect(JSON.stringify(result)).not.toContain('must-not-copy');
    expect(JSON.stringify(result)).not.toContain('-999');
  });

  it('does not weaken exclusive canonical bounds into inclusive calculator bounds', () => {
    const result = prefillParameterFromBiomarker(
      {},
      {
        key: 'exclusive-marker',
        definition: {
          canonicalUnit: { code: 'ratio' },
          inputBounds: {
            hard: { min: 0, max: 10, minInclusive: false, maxInclusive: false },
            soft: { min: 1, max: 9, minInclusive: false, maxInclusive: false },
          },
        },
      },
    );
    expect(result.validation).toBeUndefined();
  });

  it('keeps domain fractions exact while reporting assignment problems', () => {
    expect(summarizeDomainWeights([{ weight: 0.25 }, { weight: 0.75 }])).toEqual({
      total: 1,
      percent: 100,
      exact: true,
    });
    expect(summarizeDomainWeights([{ weight: 0.25 }, { weight: 0.7 }]).exact).toBe(false);
    expect(
      summarizeDomainAssignments(
        [{ key: 'alpha' }, { key: 'beta' }, { key: 'gamma' }],
        [{ parameterKeys: ['alpha', 'beta'] }, { parameterKeys: ['beta'] }],
      ),
    ).toEqual({ unassigned: ['gamma'], multiplyAssigned: ['beta'] });
  });

  it('detects category gaps, overlaps and exact shared-edge ownership', () => {
    expect(
      summarizeCategoryCoverage({ min: 0, max: 100 }, [
        { label: 'Low', min: 0, max: 50, minInclusive: true, maxExclusive: true },
        { label: 'High', min: 50, max: 100, minInclusive: true, maxInclusive: true },
      ]),
    ).toMatchObject({ complete: true, gaps: [], overlaps: [] });
    expect(
      summarizeCategoryCoverage({ min: 0, max: 100 }, [
        { label: 'Low', min: 0, max: 50, minInclusive: true, maxInclusive: true },
        { label: 'High', min: 50, max: 100, minInclusive: true, maxInclusive: true },
      ]).overlaps,
    ).toHaveLength(1);
    expect(
      summarizeCategoryCoverage({ min: 0, max: 100 }, [
        { label: 'Low', min: 0, max: 40, minInclusive: true, maxExclusive: true },
        { label: 'High', min: 50, max: 100, minInclusive: true, maxInclusive: true },
      ]).gaps,
    ).toHaveLength(1);
    expect(
      summarizeCategoryCoverage(
        { min: 0, max: 100 },
        [
          { label: 'Low', min: 0, minInclusive: true, max: 50 },
          {
            label: 'High',
            min: 50,
            minInclusive: true,
            max: 100,
            maxInclusive: true,
          },
        ],
        'explicit',
      ),
    ).toMatchObject({ complete: true, gaps: [], overlaps: [] });
    expect(
      summarizeCategoryCoverage(
        { min: 0, max: 100 },
        [
          { label: 'Low', min: 0, max: 50 },
          { label: 'High', min: 50, max: 100, maxInclusive: true },
        ],
        'explicit',
      ).gaps,
    ).toEqual(expect.arrayContaining([expect.stringContaining('Scale start 0')]));
  });
});
