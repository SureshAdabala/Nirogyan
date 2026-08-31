import express from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app';
import { loadEnvironment } from '../config/env';
import { requireAdmin } from './http';
import { AuthError, createAuthService } from './service';

const ACCESS_SECRET = 'access-secret-for-test';
const REFRESH_SECRET = 'refresh-secret-for-test';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin authentication HTTP boundary', () => {
  it('rejects unauthenticated admin access without touching MongoDB', async () => {
    const authService = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { authService });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/me`);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('reports missing auth configuration instead of accepting a login', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }));
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'not-a-real-password' }),
      });
      expect(response.status).toBe(503);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('sets hardened auth cookies while keeping tokens and CSRF values out of the JSON response', async () => {
    const authService = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    vi.spyOn(authService, 'login').mockResolvedValue({
      accessToken: 'access-cookie-secret',
      refreshToken: 'refresh-cookie-secret',
      csrfToken: 'csrf-cookie-value',
      user: {
        id: '64c000000000000000000001',
        email: 'admin@example.test',
        role: 'admin',
      },
    });
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { authService });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.test',
          password: 'a-password-that-must-not-be-returned',
        }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      const cookies = (
        response.headers as Headers & { getSetCookie: () => readonly string[] }
      ).getSetCookie();
      const accessCookie = cookies.find((cookie) => cookie.startsWith('niro_access='));
      const refreshCookie = cookies.find((cookie) => cookie.startsWith('niro_refresh='));
      const csrfCookie = cookies.find((cookie) => cookie.startsWith('niro_csrf='));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('SameSite=Strict');
      expect(accessCookie).toContain('Path=/');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
      expect(refreshCookie).toContain('Path=/api/v1/admin/auth');
      expect(csrfCookie).toContain('SameSite=Strict');
      expect(csrfCookie).toContain('Path=/');
      expect(csrfCookie).not.toContain('Path=/api/v1/admin');
      expect(csrfCookie).not.toContain('HttpOnly');
      expect(body).toEqual({
        data: {
          user: {
            id: '64c000000000000000000001',
            email: 'admin@example.test',
            role: 'admin',
          },
        },
      });
      const serializedBody = JSON.stringify(body);
      expect(serializedBody).not.toContain('access-cookie-secret');
      expect(serializedBody).not.toContain('refresh-cookie-secret');
      expect(serializedBody).not.toContain('csrf-cookie-value');
      expect(serializedBody).not.toContain('a-password-that-must-not-be-returned');
      expect(authService.login).toHaveBeenCalledWith(
        'admin@example.test',
        'a-password-that-must-not-be-returned',
        expect.objectContaining({ ipHash: expect.stringMatching(/^v1:[a-f\d]{64}$/) }),
      );
      expect(JSON.stringify(vi.mocked(authService.login).mock.calls)).not.toContain('127.0.0.1');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('rejects unknown authentication fields before invoking credential verification', async () => {
    const authService = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const login = vi.spyOn(authService, 'login');
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, { authService });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.test',
          password: 'a-password-that-is-not-checked',
          $where: 'this must never reach persistence',
        }),
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'INVALID_REQUEST', fields: { unknown: ['$where'] } },
      });
      expect(login).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('enforces CSRF for unsafe cookie-authenticated requests but exempts bearer requests', async () => {
    const authService = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const token = jwt.sign(
      {
        sub: '64c000000000000000000001',
        email: 'admin@example.test',
        role: 'admin',
        tokenType: 'access',
        familyId: 'session-family-1',
      },
      ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: 60 },
    );
    const verifyRequest = vi
      .spyOn(authService, 'verifyRequest')
      .mockImplementation(async (_token, options = {}) => {
        if (options.requireCsrf && options.csrfToken !== 'correct-csrf-value')
          throw new AuthError('CSRF_FAILED', 'CSRF validation failed.', 403);
        return {
          id: '64c000000000000000000001',
          email: 'admin@example.test',
          role: 'admin',
        };
      });
    const app = express();
    app.post('/protected', requireAdmin(authService), (_request, response) => {
      response.status(204).end();
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      const url = `http://127.0.0.1:${address.port}/protected`;
      const bearer = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const cookieWithoutCsrf = await fetch(url, {
        method: 'POST',
        headers: { cookie: `niro_access=${encodeURIComponent(token)}` },
      });
      const cookieWithCsrf = await fetch(url, {
        method: 'POST',
        headers: {
          cookie: `niro_access=${encodeURIComponent(token)}`,
          'x-csrf-token': 'correct-csrf-value',
        },
      });

      expect(bearer.status).toBe(204);
      expect(cookieWithoutCsrf.status).toBe(403);
      await expect(cookieWithoutCsrf.json()).resolves.toMatchObject({
        error: { code: 'CSRF_FAILED' },
      });
      expect(cookieWithCsrf.status).toBe(204);
      expect(verifyRequest).toHaveBeenNthCalledWith(1, token, {
        requireCsrf: false,
        csrfToken: undefined,
      });
      expect(verifyRequest).toHaveBeenNthCalledWith(2, token, {
        requireCsrf: true,
        csrfToken: undefined,
      });
      expect(verifyRequest).toHaveBeenNthCalledWith(3, token, {
        requireCsrf: true,
        csrfToken: 'correct-csrf-value',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
