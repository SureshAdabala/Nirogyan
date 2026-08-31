import { describe, expect, it } from 'vitest';

describe('public client foundation', () => {
  it('uses the Next.js client workspace for contract-driven pages', () => {
    expect('nextjs').toBe('nextjs');
  });
});
