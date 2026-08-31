import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { AuthError, type AuthService } from './service';
import type { AdminRole } from '../persistence/models/admin-user';

export interface AuthenticatedRequest extends Request {
  admin?: { readonly id: string; readonly email: string; readonly role: AdminRole };
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.header('cookie');
  if (!header) return undefined;
  const item = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

function rejectsUnknownBodyFields(
  request: Request,
  response: Response,
  allowedFields: readonly string[],
): boolean {
  if (request.body === undefined) return false;
  if (request.body === null || typeof request.body !== 'object' || Array.isArray(request.body)) {
    response
      .status(422)
      .json({ error: { code: 'INVALID_REQUEST', message: 'Request body must be an object.' } });
    return true;
  }
  const unknown = Object.keys(request.body as Record<string, unknown>).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unknown.length === 0) return false;
  response.status(422).json({
    error: {
      code: 'INVALID_REQUEST',
      message: 'Request body contains unsupported fields.',
      fields: { unknown },
    },
  });
  return true;
}

function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
  accessTtlSeconds: number,
  refreshTtlSeconds: number,
): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', [
    `niro_access=${encodeURIComponent(accessToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${accessTtlSeconds}${secure}`,
    `niro_refresh=${encodeURIComponent(refreshToken)}; HttpOnly; SameSite=Strict; Path=/api/v1/admin/auth; Max-Age=${refreshTtlSeconds}${secure}`,
    `niro_csrf=${encodeURIComponent(csrfToken)}; SameSite=Strict; Path=/; Max-Age=${refreshTtlSeconds}${secure}`,
  ]);
}

function clearAuthCookies(response: Response): void {
  response.setHeader('Set-Cookie', [
    'niro_access=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    'niro_refresh=; HttpOnly; SameSite=Strict; Path=/api/v1/admin/auth; Max-Age=0',
    'niro_csrf=; SameSite=Strict; Path=/; Max-Age=0',
  ]);
}

function authFailure(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Authentication failed.' } });
}

function tokenFromRequest(request: Request): { readonly token?: string; readonly cookie: boolean } {
  const authorization = request.header('authorization');
  if (authorization?.startsWith('Bearer '))
    return { token: authorization.slice('Bearer '.length), cookie: false };
  return { token: cookieValue(request, 'niro_access'), cookie: true };
}

export function requireAdmin(service: AuthService, roles: readonly AdminRole[] = []) {
  return async (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const auth = tokenFromRequest(request);
    const token = auth.token;
    if (!token) {
      response
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Admin authentication is required.' } });
      return;
    }
    try {
      const claims = service.verifyAccess(token);
      if (roles.length && !roles.includes(claims.role)) {
        response
          .status(403)
          .json({ error: { code: 'FORBIDDEN', message: 'This admin role is not permitted.' } });
        return;
      }
      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
      const admin = await service.verifyRequest(token, {
        requireCsrf: auth.cookie && unsafe,
        csrfToken: request.header('x-csrf-token'),
      });
      if (roles.length && !roles.includes(admin.role)) {
        response
          .status(403)
          .json({ error: { code: 'FORBIDDEN', message: 'This admin role is not permitted.' } });
        return;
      }
      request.admin = admin;
      next();
    } catch (error) {
      authFailure(response, error);
    }
  };
}

export function createAuthRouter(service: AuthService | undefined): Router {
  const router = Router();
  const loginHits = new Map<string, { readonly startedAt: number; readonly count: number }>();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    next();
  });
  router.post('/login', async (request, response) => {
    const now = Date.now();
    const client = request.ip || request.socket.remoteAddress || 'unknown';
    for (const [key, value] of loginHits) {
      if (now - value.startedAt >= 60_000) loginHits.delete(key);
    }
    const clientKey = service?.securityEvidence('network', client) ?? 'auth-unconfigured';
    if (!loginHits.has(clientKey) && loginHits.size >= 10_000) {
      response.setHeader('Retry-After', '60');
      response.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many login attempts; retry later.' },
      });
      return;
    }
    const existingHit = loginHits.get(clientKey);
    const hit =
      !existingHit || now - existingHit.startedAt >= 60_000
        ? { startedAt: now, count: 1 }
        : { startedAt: existingHit.startedAt, count: existingHit.count + 1 };
    loginHits.set(clientKey, hit);
    if (hit.count > 20) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((hit.startedAt + 60_000 - now) / 1000))),
      );
      response.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many login attempts; retry later.' },
      });
      return;
    }
    if (!service) {
      response.status(503).json({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Admin authentication is not configured.',
        },
      });
      return;
    }
    if (rejectsUnknownBodyFields(request, response, ['email', 'password'])) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      response
        .status(422)
        .json({ error: { code: 'INVALID_REQUEST', message: 'Email and password are required.' } });
      return;
    }
    try {
      const tokens = await service.login(body.email, body.password, {
        ipHash: service.securityEvidence('network', client),
        userAgent: request.header('user-agent'),
      });
      setAuthCookies(
        response,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.csrfToken,
        service.accessTtlSeconds,
        service.refreshTtlSeconds,
      );
      response.status(200).json({ data: { user: tokens.user } });
    } catch (error) {
      authFailure(response, error);
    }
  });
  router.post('/refresh', async (request, response) => {
    if (rejectsUnknownBodyFields(request, response, ['refreshToken'])) return;
    if (!service) {
      response.status(503).json({
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Admin authentication is not configured.',
        },
      });
      return;
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const bodyRefreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;
    const refreshFromBody = bodyRefreshToken !== undefined;
    const refreshToken = bodyRefreshToken ?? cookieValue(request, 'niro_refresh');
    if (!refreshToken) {
      response.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Refresh authentication is required.' },
      });
      return;
    }
    try {
      const tokens = await service.refresh(refreshToken, {
        requireCsrf: !refreshFromBody,
        csrfToken: request.header('x-csrf-token'),
      });
      setAuthCookies(
        response,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.csrfToken,
        service.accessTtlSeconds,
        service.refreshTtlSeconds,
      );
      response.status(200).json({ data: { user: tokens.user } });
    } catch (error) {
      authFailure(response, error);
    }
  });
  router.post('/logout', async (request, response) => {
    if (rejectsUnknownBodyFields(request, response, ['refreshToken'])) return;
    try {
      if (service) {
        const body = (request.body ?? {}) as Record<string, unknown>;
        const bodyRefreshToken =
          typeof body.refreshToken === 'string' ? body.refreshToken : undefined;
        const refreshFromBody = bodyRefreshToken !== undefined;
        const refreshToken = bodyRefreshToken ?? cookieValue(request, 'niro_refresh');
        if (refreshToken)
          await service.logout(refreshToken, {
            requireCsrf: !refreshFromBody,
            csrfToken: request.header('x-csrf-token'),
          });
      }
    } catch (error) {
      authFailure(response, error);
      return;
    }
    clearAuthCookies(response);
    response.status(204).end();
  });
  return router;
}
