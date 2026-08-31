import { describe, expect, it } from 'vitest';

import { validateMeasurementDefinitionStructure } from './measurement';

function validMeasurement(): Record<string, unknown> {
  return {
    schemaVersion: 'measurement-definition.v1',
    key: 'format-check',
    version: 1,
    status: 'approved',
    displayName: 'Format check',
    kind: 'laboratory-biomarker',
    valueType: 'number',
    canonicalUnit: { code: 'unit', dimension: 'dimensionless', display: 'unit' },
    acceptedUnits: [{ code: 'unit', dimension: 'dimensionless', display: 'unit' }],
    inputBounds: {
      hard: { min: 0, max: 10, minInclusive: true, maxInclusive: true },
    },
    referenceRanges: [
      {
        id: 'format-range',
        label: 'Format range',
        unit: 'unit',
        interval: { min: 1, max: 2, minInclusive: true, maxInclusive: true },
        context: {},
        interpretationOnly: true,
        sourceClaimIds: ['format-claim'],
        reviewExpiresAt: '2027-08-25T00:00:00.000Z',
      },
    ],
    sources: [
      {
        id: 'format-source',
        type: 'external',
        title: 'Format source',
        url: 'https://example.test/evidence',
        accessed: '2024-02-29',
        verification: 'fetch-verified',
        claimIds: ['format-claim'],
      },
    ],
    governance: {
      reviewStatus: 'approved',
      reviewedAt: '2026-08-25T00:00:00.000Z',
      reviewerId: 'format-reviewer',
      reviewExpiresAt: '2027-08-25T00:00:00.000Z',
      publishBlockers: [],
    },
  };
}

describe('measurement structural formats', () => {
  it('accepts strict calendar dates, RFC 3339 date-times, and absolute URIs', () => {
    expect(validateMeasurementDefinitionStructure(validMeasurement())).toEqual({
      valid: true,
      findings: [],
    });
  });

  it.each([
    ['source accessed date', ['sources', 0, 'accessed'], '2026-02-30', 'date'],
    ['review timestamp', ['governance', 'reviewedAt'], '2026-08-25', 'date-time'],
    ['review expiry', ['governance', 'reviewExpiresAt'], '2027-13-01T00:00:00Z', 'date-time'],
    [
      'range expiry',
      ['referenceRanges', 0, 'reviewExpiresAt'],
      '2027-08-25T25:00:00Z',
      'date-time',
    ],
    ['source URI', ['sources', 0, 'url'], 'not a uri', 'uri'],
  ] as const)('rejects an invalid %s', (_label, path, value, expectedFormat) => {
    const measurement = validMeasurement();
    let cursor: unknown = measurement;
    for (const segment of path.slice(0, -1)) {
      cursor = (cursor as Record<string | number, unknown>)[segment];
    }
    (cursor as Record<string | number, unknown>)[path.at(-1)!] = value;

    const result = validateMeasurementDefinitionStructure(measurement);
    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: `must match format "${expectedFormat}"` }),
      ]),
    );
  });
});
