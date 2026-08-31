import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  cacheInvalidationBody,
  dispatchCacheInvalidation,
  signCacheInvalidationBody,
  type ClaimedCacheInvalidation,
} from './cache-invalidation';

const claim: ClaimedCacheInvalidation = {
  schemaVersion: 'v1',
  eventId: '0123456789abcdef01234567',
  calculatorSlug: 'heart-risk',
  reason: 'publish',
  paths: ['/calculators', '/calculators/heart-risk', '/sitemap.xml'],
  owner: 'test-worker',
  attempt: 1,
};
const secret = 'cache-secret-that-is-at-least-thirty-two-characters';

describe('cache invalidation dispatcher', () => {
  it('emits a deterministic signed v1 message and completes only after a 2xx response', async () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    const complete = vi.fn(async () => undefined);
    const fail = vi.fn(async () => undefined);
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body);
      const headers = new Headers(init?.headers);
      const timestamp = headers.get('x-niro-timestamp') ?? '';
      expect(body).toBe(cacheInvalidationBody(claim));
      expect(headers.get('x-niro-signature')).toBe(
        `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`,
      );
      expect(timestamp).toBe(String(Math.floor(now.getTime() / 1_000)));
      return Response.json({ status: 'revalidated', eventId: claim.eventId });
    });

    await expect(
      dispatchCacheInvalidation({
        claim,
        endpoint: 'https://web.example.test/api/v1/internal/revalidate',
        signingSecret: secret,
        now,
        fetchImplementation,
        complete,
        fail,
      }),
    ).resolves.toBe('completed');
    expect(complete).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });

  it('retains retry state when the downstream revalidation endpoint fails', async () => {
    const complete = vi.fn(async () => undefined);
    const fail = vi.fn(async () => undefined);
    await expect(
      dispatchCacheInvalidation({
        claim,
        endpoint: 'https://web.example.test/api/v1/internal/revalidate',
        signingSecret: secret,
        fetchImplementation: vi.fn(async () => new Response(null, { status: 503 })),
        complete,
        fail,
      }),
    ).resolves.toBe('failed');
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(claim, expect.any(Error));
  });

  it('does not complete a misrouted or mismatched 2xx acknowledgement', async () => {
    for (const response of [
      new Response('<html>login</html>', { status: 200 }),
      Response.json({ status: 'revalidated', eventId: 'ffffffffffffffffffffffff' }),
    ]) {
      const complete = vi.fn(async () => undefined);
      const fail = vi.fn(async () => undefined);
      await expect(
        dispatchCacheInvalidation({
          claim,
          endpoint: 'https://web.example.test/api/v1/internal/revalidate',
          signingSecret: secret,
          fetchImplementation: vi.fn(async () => response),
          complete,
          fail,
        }),
      ).resolves.toBe('failed');
      expect(complete).not.toHaveBeenCalled();
      expect(fail).toHaveBeenCalledOnce();
    }
  });

  it('uses the documented HMAC input exactly', () => {
    expect(signCacheInvalidationBody('{}', '1787918400', secret)).toBe(
      createHmac('sha256', secret).update('1787918400.{}').digest('hex'),
    );
  });
});
