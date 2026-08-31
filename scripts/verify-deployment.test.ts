import { describe, expect, it, vi } from 'vitest';

import { verifyDeployment } from './verify-deployment';

describe('deployment smoke verification', () => {
  it('binds liveness and readiness to the expected release and verifies public headers', async () => {
    const fetchImplementation = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/healthz')) {
        return Response.json({ status: 'ok', releaseId: 'sha-abc123' });
      }
      if (value.endsWith('/readyz')) {
        return Response.json({ status: 'ready', releaseId: 'sha-abc123' });
      }
      if (value.endsWith('/api/healthz')) {
        return Response.json({ status: 'ok', releaseId: 'sha-abc123' });
      }
      return new Response('<html></html>', {
        headers: {
          'x-content-type-options': 'nosniff',
          'strict-transport-security': 'max-age=31536000; includeSubDomains',
        },
      });
    });
    await expect(
      verifyDeployment({
        apiOrigin: 'https://api.example.test',
        siteOrigin: 'https://web.example.test',
        expectedReleaseId: 'sha-abc123',
        fetchImplementation,
      }),
    ).resolves.toEqual({ status: 'ok', releaseId: 'sha-abc123' });
  });

  it('rejects release drift, insecure remote targets, and missing HSTS', async () => {
    const releaseDrift = vi.fn(async (url: string | URL | Request) =>
      Response.json({
        status: String(url).endsWith('/readyz') ? 'ready' : 'ok',
        releaseId: 'wrong-release',
      }),
    );
    await expect(
      verifyDeployment({
        apiOrigin: 'https://api.example.test',
        siteOrigin: 'https://web.example.test',
        expectedReleaseId: 'sha-abc123',
        fetchImplementation: releaseDrift,
      }),
    ).rejects.toThrow(/expected immutable release/);
    await expect(
      verifyDeployment({
        apiOrigin: 'http://api.example.test',
        siteOrigin: 'https://web.example.test',
        expectedReleaseId: 'sha-abc123',
      }),
    ).rejects.toThrow(/HTTPS/);
  });

  it('rejects a stale client artifact even when the API release is current', async () => {
    const fetchImplementation = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/healthz') && !value.includes('web.example.test')) {
        return Response.json({ status: 'ok', releaseId: 'sha-abc123' });
      }
      if (value.endsWith('/readyz')) {
        return Response.json({ status: 'ready', releaseId: 'sha-abc123' });
      }
      return Response.json({ status: 'ok', releaseId: 'stale-client' });
    });
    await expect(
      verifyDeployment({
        apiOrigin: 'https://api.example.test',
        siteOrigin: 'https://web.example.test',
        expectedReleaseId: 'sha-abc123',
        fetchImplementation,
      }),
    ).rejects.toThrow(/Client liveness response/);
  });
});
