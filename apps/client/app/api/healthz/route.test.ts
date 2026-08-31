import { afterEach, describe, expect, it } from 'vitest';

import { GET } from './route';

const previousReleaseId = process.env.NIRO_CLIENT_BUILD_RELEASE_ID;

afterEach(() => {
  if (previousReleaseId === undefined) delete process.env.NIRO_CLIENT_BUILD_RELEASE_ID;
  else process.env.NIRO_CLIENT_BUILD_RELEASE_ID = previousReleaseId;
});

describe('client process health', () => {
  it('returns a dependency-free non-cacheable release identity', async () => {
    process.env.NIRO_CLIENT_BUILD_RELEASE_ID = 'sha-client-123';
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'niro-client',
      releaseId: 'sha-client-123',
    });
  });
});
