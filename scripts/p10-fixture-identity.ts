import { assertP7FixtureNonce } from './p7-fixture-identity';

export function p10CalculatorSlug(nonce: string): string {
  assertP7FixtureNonce(nonce);
  return `p10-${nonce}-calculator`;
}
