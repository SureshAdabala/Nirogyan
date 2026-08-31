import { describe, expect, it } from 'vitest';

import type { PublicBiomarkerDetail, PublicCondition } from './public-api';

describe('public biomarker DTO', () => {
  it('represents typed ranges, provenance, and safe public relationships', () => {
    const detail = {
      key: 'synthetic-marker',
      revision: 1,
      displayName: 'Synthetic marker',
      kind: 'laboratory-biomarker',
      canonicalUnit: 'mg/L',
      definition: {
        domainKeys: ['metabolic'],
        canonicalUnit: { code: 'mg/L', display: 'mg/L', dimension: 'mass-concentration' },
        referenceRanges: [
          {
            id: 'fixture-range',
            label: 'Fixture range',
            unit: 'mg/L',
            interval: { min: 1, minInclusive: true },
            context: { population: 'Synthetic adults' },
            interpretationOnly: true,
            sourceClaimIds: ['fixture-claim'],
          },
        ],
      },
      sources: [
        {
          id: 'fixture-source',
          type: 'external',
          title: 'Fixture source',
          verification: 'fetch-verified',
          claimIds: ['fixture-claim'],
        },
      ],
      relatedBiomarkers: [
        { key: 'related-marker', displayName: 'Related marker', relation: 'same-domain' },
      ],
      usedInCalculators: [{ calculatorSlug: 'fixture-calculator', version: 1 }],
    } satisfies PublicBiomarkerDetail;

    expect(detail.definition.referenceRanges[0]?.sourceClaimIds).toEqual(['fixture-claim']);
    expect(detail.relatedBiomarkers[0]?.key).toBe('related-marker');
    expect(detail.usedInCalculators[0]?.calculatorSlug).toBe('fixture-calculator');
  });

  it('keeps authoring-only bounds and unresolved source states out of the public DTO', () => {
    const definition = {
      canonicalUnit: { code: 'mg/L', display: 'mg/L', dimension: 'mass-concentration' },
      // @ts-expect-error input validation bounds are protected authoring data.
      inputBounds: { hard: { min: 0, max: 10 } },
    } satisfies import('./public-api').PublicBiomarkerDefinition;
    const unresolvedSource = {
      id: 'unresolved-source',
      type: 'external',
      title: 'Unresolved source',
      // @ts-expect-error unresolved evidence cannot be represented by the reviewed public DTO.
      verification: 'needs-verification',
    } satisfies import('./public-api').PublicBiomarkerSource;

    expect(definition).toHaveProperty('inputBounds');
    expect(unresolvedSource.verification).toBe('needs-verification');
  });

  it('represents redacted authoring-only conditions without a public formula identifier', () => {
    const redacted = { unavailable: true } satisfies PublicCondition;
    const authoredFormulaCondition = {
      // @ts-expect-error formula identifiers are protected authoring data.
      formula: 'private-formula-key',
      op: 'gte',
      value: 1,
    } satisfies PublicCondition;

    expect(redacted.unavailable).toBe(true);
    expect(authoredFormulaCondition.formula).toBe('private-formula-key');
  });
});
