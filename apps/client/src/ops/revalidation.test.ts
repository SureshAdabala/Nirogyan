import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { revalidationTargets, verifyRevalidationRequest } from './revalidation';

const secret = 'revalidation-secret-that-is-at-least-thirty-two-characters';
const timestamp = '1787918400';
const now = new Date(Number(timestamp) * 1_000);

function signed(body: string) {
  return {
    body,
    timestamp,
    signature: `sha256=${createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex')}`,
    secret,
    now,
  };
}

describe('signed cache revalidation', () => {
  it('verifies the exact message and maps semantic outbox paths to Next paths/tags', () => {
    const body = JSON.stringify({
      schemaVersion: 'v1',
      eventId: '0123456789abcdef01234567',
      calculatorSlug: 'heart-risk',
      reason: 'publish',
      paths: ['/calculators', '/calculators/heart-risk', '/biomarkers', '/sitemap.xml'],
    });
    const message = verifyRevalidationRequest(signed(body));
    expect(revalidationTargets(message)).toEqual({
      paths: ['/', '/c/heart-risk', '/biomarkers', '/sitemap.xml'],
      tags: ['calculators', 'calculator:heart-risk', 'biomarkers'],
    });
  });

  it('rejects stale, tampered, extra-field, duplicate, and out-of-scope messages', () => {
    const valid = {
      schemaVersion: 'v1',
      eventId: '0123456789abcdef01234567',
      calculatorSlug: 'heart-risk',
      reason: 'retire',
      paths: ['/calculators/heart-risk'],
    };
    const body = JSON.stringify(valid);
    expect(() =>
      verifyRevalidationRequest({ ...signed(body), signature: `sha256=${'0'.repeat(64)}` }),
    ).toThrow(/SIGNATURE/);
    expect(() =>
      verifyRevalidationRequest({ ...signed(body), now: new Date(now.getTime() + 301_000) }),
    ).toThrow(/EXPIRED/);
    for (const invalid of [
      { ...valid, extra: true },
      { ...valid, paths: ['/calculators/heart-risk', '/calculators/heart-risk'] },
      { ...valid, paths: ['/admin'] },
    ]) {
      const invalidBody = JSON.stringify(invalid);
      expect(() => verifyRevalidationRequest(signed(invalidBody))).toThrow();
    }
  });
});
