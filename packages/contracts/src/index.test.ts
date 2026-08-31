import { describe, expect, it } from 'vitest';

import { CONTRACT_SCHEMA_IDS } from './index';

describe('contracts foundation', () => {
  it('exposes the three immutable P0A schema identifiers', () => {
    expect(Object.values(CONTRACT_SCHEMA_IDS)).toHaveLength(3);
    expect(CONTRACT_SCHEMA_IDS.calculatorVersion).toBe('urn:niro:schema:calculator-version:v1');
  });
});
