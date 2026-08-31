import type { Server } from 'node:http';

import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app';
import { AuthError, createAuthService } from './auth/service';
import { loadEnvironment } from './config/env';
import type { AdminRole } from './persistence/models/admin-user';

const ACCESS_SECRET = 'p10-access-secret-for-tests';
const servers: Server[] = [];

function accessToken(role: AdminRole): string {
  return jwt.sign(
    {
      sub: '64c000000000000000000001',
      email: `${role}@p10.invalid`,
      role,
      tokenType: 'access',
    },
    ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: 60 },
  );
}

async function listen(app: ReturnType<typeof createApp>): Promise<string> {
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('P10 test server unavailable.');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('P10 authorization and abuse matrix', () => {
  it.each([
    ['editor', 'GET', '/api/v1/admin/users'],
    ['medical-reviewer', 'POST', '/api/v1/admin/calculators'],
    ['editor', 'POST', '/api/v1/admin/calculators/test/versions/1/approve'],
    ['editor', 'POST', '/api/v1/admin/calculators/test/versions/1/publish'],
  ] satisfies readonly [AdminRole, string, string][])(
    '%s cannot %s %s',
    async (role, method, path) => {
      const real = createAuthService({
        accessSecret: ACCESS_SECRET,
        refreshSecret: 'p10-refresh-secret-for-tests',
      });
      const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
        authService: {
          ...real,
          verifyRequest: async (token: string) => real.verifyAccess(token),
        },
      });
      const response = await fetch(`${await listen(app)}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${accessToken(role)}`,
          'content-type': 'application/json',
        },
        body: method === 'GET' ? undefined : '{}',
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: { code: 'FORBIDDEN', message: 'This admin role is not permitted.' },
      });
    },
  );

  it('requires authentication and rate-limits brute-force login attempts', async () => {
    const auth = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: 'p10-refresh-secret-for-tests',
    });
    vi.spyOn(auth, 'login').mockRejectedValue(
      new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    const base = await listen(
      createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { authService: auth }),
    );
    const anonymous = await fetch(`${base}/api/v1/admin/calculators`);
    expect(anonymous.status).toBe(401);
    for (let index = 0; index < 20; index += 1) {
      const response = await fetch(`${base}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@example.test', password: 'wrong-password' }),
      });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${base}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'attacker@example.test', password: 'wrong-password' }),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(await limited.text()).not.toContain('wrong-password');
  });

  it('rate-limits optional lead abuse before repeated writes', async () => {
    const save = vi.fn(async () => undefined);
    const base = await listen(
      createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
        leadCapture: { store: { save }, consentVersion: 'p10-v1' },
        leadRateLimit: { max: 1, windowMs: 60_000 },
      }),
    );
    const submit = () =>
      fetch(`${base}/api/v1/leads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'fixture@example.test',
          consent: true,
          consentVersion: 'p10-v1',
        }),
      });
    expect((await submit()).status).toBe(201);
    const limited = await submit();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('cache-control')).toBe('no-store');
    expect(save).toHaveBeenCalledOnce();
  });
});

describe('P10 malformed-input, injection, privacy, and failure boundaries', () => {
  it.each([
    ['{"inputs":', 400, 'INVALID_JSON'],
    [JSON.stringify({ value: 'x'.repeat(1_100_000) }), 413, 'REQUEST_TOO_LARGE'],
  ])('returns a bounded error for malformed body case %#', async (body, status, code) => {
    const base = await listen(createApp(loadEnvironment({ NODE_ENV: 'test' })));
    const response = await fetch(`${base}/api/v1/calculators/test/assess`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    expect(response.status).toBe(status);
    const text = await response.text();
    expect(text).toContain(code);
    expect(text).not.toMatch(/stack|node_modules|at createApp/iu);
  });

  it('does not leak an unexpected exception, stack, or secret to a client', async () => {
    const secret = 'p10-never-return-this-secret';
    const base = await listen(
      createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
        catalog: {
          listPublished: async () => {
            throw new Error(secret);
          },
          getPublished: async () => undefined,
        },
      }),
    );
    const response = await fetch(`${base}/api/v1/calculators`);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(secret);
    expect(text).not.toMatch(/stack|node_modules/iu);
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
    });
  });

  it('normalizes capability failures to private, noindex 404 responses', async () => {
    const base = await listen(createApp(loadEnvironment({ NODE_ENV: 'test' })));
    const response = await fetch(`${base}/api/v1/results/%24where%5Bprototype%5D=polluted`);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await response.text()).not.toContain('$where');
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });
});
