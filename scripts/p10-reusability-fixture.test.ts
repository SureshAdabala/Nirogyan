import { validateCalculatorVersion } from '@niro/contracts';
import { calculate } from '@niro/engine';
import { describe, expect, it } from 'vitest';

import { createP10ReusabilityPayload, p10CalculatorSlug } from './p10-reusability-fixture';

const NONCE = 'fedcba9876543210fedcba98765432';

describe('P10 genuinely-new calculator fixture', () => {
  it('is deterministic, nonclinical, publish eligible, and uses generic primitives only', () => {
    const payload = createP10ReusabilityPayload(NONCE);
    expect(createP10ReusabilityPayload(NONCE)).toEqual(payload);
    expect(payload).toMatchObject({
      calculatorSlug: p10CalculatorSlug(NONCE),
      governance: { clinicalStatus: 'not-applicable', publishBlockers: [] },
    });
    expect(validateCalculatorVersion(payload, 'p10-reusability').publishEligible).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/niro-cws|covid|diabetes|heart-risk|hypothyroid/i);
  });

  it('supports an explicitly partial laboratory result and an authored threshold', () => {
    const payload = createP10ReusabilityPayload(NONCE);
    const partial = calculate(payload, { readinessAnswer: false });
    expect(partial).toMatchObject({ ok: true, score: 0 });
    expect(partial.ok && partial.category?.label).toBe('Lower synthetic score');
    expect(partial.ok && partial.coverage?.scoredParameterCount).toBe(1);
    expect(
      partial.ok && partial.parameters.find((item) => item.key === 'markerValue'),
    ).toMatchObject({ missing: true, status: 'excluded' });

    const boundary = calculate(payload, { readinessAnswer: false, markerValue: 50 });
    expect(boundary).toMatchObject({ ok: true, score: 1 });
    expect(boundary.ok && boundary.category?.label).toBe('Higher synthetic score');
  });
});
