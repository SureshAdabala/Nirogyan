/** Deliberately public, synthetic-only credential valid solely in nonce-isolated fixture DBs. */
export const P7_FIXTURE_PASSWORD = 'P7-Synthetic-Only!2026';

export function assertP7FixtureNonce(value: string | undefined): asserts value is string {
  if (!value || !/^[a-f0-9]{30}$/.test(value)) {
    throw new Error('P7 fixture nonce must be exactly 30 lowercase hexadecimal characters.');
  }
}

export function p7FixtureKeys(nonce: string) {
  assertP7FixtureNonce(nonce);
  const short = nonce.slice(0, 12);
  return {
    adminEmail: `admin-${short}@p7-fixture.invalid`,
    reviewerEmail: `reviewer-${short}@p7-fixture.invalid`,
    measurement: `p7-${nonce}-marker`,
    calculator: `p7-${nonce}-calculator`,
  } as const;
}
