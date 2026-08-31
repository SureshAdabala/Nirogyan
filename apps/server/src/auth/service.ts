import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { AdminSessionModel } from '../persistence/models/admin-session';
import { AdminUserModel, type AdminRole } from '../persistence/models/admin-user';
import { AuditLogModel } from '../persistence/models/audit-log';
import { LoginAttemptModel } from '../persistence/models/login-attempt';

export interface AuthOptions {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessTtlSeconds?: number;
  readonly refreshTtlSeconds?: number;
  readonly bcryptRounds?: number;
  readonly lockoutThreshold?: number;
  readonly lockoutSeconds?: number;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Non-secret double-submit value bound to the persisted session family. */
  readonly csrfToken: string;
  readonly user: AuthUser;
}

export class AuthError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CREDENTIALS'
      | 'ACCOUNT_LOCKED'
      | 'ACCOUNT_DISABLED'
      | 'REFRESH_REUSE'
      | 'CSRF_FAILED'
      | 'INVALID_TOKEN',
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

type TokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: AdminRole;
  tokenType: 'access' | 'refresh';
  familyId?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function tokenHashMatches(token: string | undefined, expectedHash: string | undefined): boolean {
  if (!token || !expectedHash || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function payloadUser(payload: TokenPayload): AuthUser {
  return { id: payload.sub, email: payload.email, role: payload.role };
}

function verifyPayload(
  token: string,
  secret: string,
  tokenType: TokenPayload['tokenType'],
): TokenPayload {
  try {
    const value = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof value === 'string') throw new Error('Token payload must be an object.');
    const payload = value as TokenPayload;
    if (!payload.sub || !payload.email || !payload.role || payload.tokenType !== tokenType) {
      throw new Error('Token claims are incomplete.');
    }
    return payload;
  } catch {
    throw new AuthError('INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }
}

export async function hashPassword(password: string, rounds = 12): Promise<string> {
  if (password.length < 12) throw new Error('Admin passwords must be at least 12 characters.');
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAuthService(options: AuthOptions) {
  if (!options.accessSecret || !options.refreshSecret)
    throw new Error('Auth signing secrets are required.');
  const accessTtlSeconds = options.accessTtlSeconds ?? 900;
  const refreshTtlSeconds = options.refreshTtlSeconds ?? 604_800;
  const lockoutThreshold = options.lockoutThreshold ?? 5;
  const lockoutSeconds = options.lockoutSeconds ?? 900;

  function securityEvidence(
    domain: 'network' | 'account' | 'network-label',
    value: string,
  ): string {
    return `v1:${createHmac('sha256', options.accessSecret)
      .update(`auth-${domain}:v1:${value}`)
      .digest('hex')}`;
  }

  async function recordLoginAttempt(
    email: string,
    success: boolean,
    ipHash: string | undefined,
    reason?: string,
  ): Promise<void> {
    await LoginAttemptModel.create({
      accountHash: securityEvidence('account', email),
      success,
      ...(reason ? { reason } : {}),
      ...(ipHash ? { ipHash } : {}),
    });
  }

  function issueTokens(user: AuthUser, familyId: string = randomUUID()): AuthTokens {
    const csrfToken = randomBytes(32).toString('base64url');
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, tokenType: 'access', familyId },
      options.accessSecret,
      { algorithm: 'HS256', expiresIn: accessTtlSeconds },
    );
    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, tokenType: 'refresh', familyId },
      options.refreshSecret,
      { algorithm: 'HS256', expiresIn: refreshTtlSeconds },
    );
    return { accessToken, refreshToken, csrfToken, user };
  }

  return {
    accessTtlSeconds,
    refreshTtlSeconds,
    securityEvidence,
    async login(
      emailInput: string,
      password: string,
      metadata: { readonly ipHash?: string; readonly userAgent?: string } = {},
    ): Promise<AuthTokens> {
      const email = normalizeEmail(emailInput);
      const user = await AdminUserModel.findOne({ email }).select('+passwordHash');
      if (!user) {
        await recordLoginAttempt(email, false, metadata.ipHash, 'unknown-user');
        throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
      const now = new Date();
      if (user.status !== 'active') {
        await recordLoginAttempt(email, false, metadata.ipHash, 'account-disabled');
        throw new AuthError('ACCOUNT_DISABLED', 'This admin account is disabled.', 403);
      }
      if (user.lockedUntil && user.lockedUntil > now) {
        await recordLoginAttempt(email, false, metadata.ipHash, 'account-locked');
        throw new AuthError('ACCOUNT_LOCKED', 'This admin account is temporarily locked.', 423);
      }
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        const failedLoginCount = user.failedLoginCount + 1;
        user.failedLoginCount = failedLoginCount;
        if (failedLoginCount >= lockoutThreshold)
          user.lockedUntil = new Date(now.getTime() + lockoutSeconds * 1000);
        await user.save();
        await recordLoginAttempt(email, false, metadata.ipHash, 'invalid-password');
        throw new AuthError(
          failedLoginCount >= lockoutThreshold ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
          failedLoginCount >= lockoutThreshold
            ? 'This admin account is temporarily locked.'
            : 'Email or password is incorrect.',
          failedLoginCount >= lockoutThreshold ? 423 : 401,
        );
      }
      user.failedLoginCount = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = now;
      await user.save();
      await recordLoginAttempt(email, true, metadata.ipHash);
      const authUser: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
      const tokens = issueTokens(authUser);
      const refreshPayload = verifyPayload(tokens.refreshToken, options.refreshSecret, 'refresh');
      await AdminSessionModel.create({
        adminUserId: user._id,
        tokenFamilyId: refreshPayload.familyId,
        refreshTokenHash: hashToken(tokens.refreshToken),
        csrfTokenHash: hashToken(tokens.csrfToken),
        issuedAt: now,
        expiresAt: new Date(now.getTime() + refreshTtlSeconds * 1000),
        ipHash: metadata.ipHash,
        userAgent: metadata.userAgent,
      });
      await AuditLogModel.create({
        actorId: user._id,
        action: 'admin.login',
        entityType: 'AdminUser',
        entityId: user._id.toString(),
      });
      return tokens;
    },
    async refresh(
      refreshToken: string,
      requestOptions: { readonly csrfToken?: string; readonly requireCsrf?: boolean } = {},
    ): Promise<AuthTokens> {
      const payload = verifyPayload(refreshToken, options.refreshSecret, 'refresh');
      if (!payload.familyId)
        throw new AuthError('INVALID_TOKEN', 'Refresh token family is missing.');
      const session = await AdminSessionModel.findOne({ tokenFamilyId: payload.familyId }).select(
        '+refreshTokenHash +csrfTokenHash',
      );
      if (!session || session.revokedAt || session.expiresAt <= new Date())
        throw new AuthError('INVALID_TOKEN', 'Refresh session is invalid or expired.');
      if (
        requestOptions.requireCsrf &&
        !tokenHashMatches(requestOptions.csrfToken, session.csrfTokenHash)
      )
        throw new AuthError('CSRF_FAILED', 'CSRF validation failed.', 403);
      if (session.refreshTokenHash !== hashToken(refreshToken)) {
        session.reuseDetectedAt = new Date();
        session.revokedAt = new Date();
        await session.save();
        await AuditLogModel.create({
          actorId: payload.sub,
          action: 'admin.session.refresh-reuse',
          entityType: 'AdminSession',
          entityId: session._id.toString(),
          diffSummary: { tokenFamilyId: payload.familyId, revoked: true },
        });
        throw new AuthError('REFRESH_REUSE', 'Refresh token reuse was detected; sign in again.');
      }
      const user = await AdminUserModel.findById(payload.sub);
      if (!user || user.status !== 'active')
        throw new AuthError('ACCOUNT_DISABLED', 'This admin account is unavailable.', 403);
      const authUser: AuthUser = { id: user._id.toString(), email: user.email, role: user.role };
      const tokens = issueTokens(authUser, payload.familyId);
      session.refreshTokenHash = hashToken(tokens.refreshToken);
      session.csrfTokenHash = hashToken(tokens.csrfToken);
      session.issuedAt = new Date();
      session.expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);
      await session.save();
      await AuditLogModel.create({
        actorId: user._id,
        action: 'admin.session.refresh',
        entityType: 'AdminSession',
        entityId: session._id.toString(),
        diffSummary: { tokenFamilyId: payload.familyId, rotated: true },
      });
      return tokens;
    },
    async logout(
      refreshToken: string,
      requestOptions: { readonly csrfToken?: string; readonly requireCsrf?: boolean } = {},
    ): Promise<void> {
      const payload = verifyPayload(refreshToken, options.refreshSecret, 'refresh');
      if (!payload.familyId) return;
      const session = await AdminSessionModel.findOne({ tokenFamilyId: payload.familyId }).select(
        '+csrfTokenHash',
      );
      if (!session) return;
      if (
        requestOptions.requireCsrf &&
        !tokenHashMatches(requestOptions.csrfToken, session.csrfTokenHash)
      )
        throw new AuthError('CSRF_FAILED', 'CSRF validation failed.', 403);
      session.revokedAt = new Date();
      await session.save();
      await AuditLogModel.create({
        actorId: payload.sub,
        action: 'admin.logout',
        entityType: 'AdminSession',
        entityId: session._id.toString(),
        diffSummary: { tokenFamilyId: payload.familyId, revoked: true },
      });
    },
    verifyAccess(token: string): AuthUser {
      return payloadUser(verifyPayload(token, options.accessSecret, 'access'));
    },
    async verifyRequest(
      token: string,
      requestOptions: { readonly csrfToken?: string; readonly requireCsrf?: boolean } = {},
    ): Promise<AuthUser> {
      const payload = verifyPayload(token, options.accessSecret, 'access');
      if (!payload.familyId)
        throw new AuthError('INVALID_TOKEN', 'Authentication session is missing.');
      const session = await AdminSessionModel.findOne({
        tokenFamilyId: payload.familyId,
        adminUserId: payload.sub,
      }).select('+csrfTokenHash');
      if (!session || session.revokedAt || session.expiresAt <= new Date())
        throw new AuthError('INVALID_TOKEN', 'Authentication session is invalid or expired.');
      if (requestOptions.requireCsrf) {
        if (!tokenHashMatches(requestOptions.csrfToken, session.csrfTokenHash))
          throw new AuthError('CSRF_FAILED', 'CSRF validation failed.', 403);
      }
      const user = await AdminUserModel.findById(payload.sub).lean();
      if (!user || user.status !== 'active')
        throw new AuthError('ACCOUNT_DISABLED', 'This admin account is unavailable.', 403);
      return { id: user._id.toString(), email: user.email, role: user.role };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/**
 * One-way privacy migration for pre-P9 login evidence. The account grouping
 * signal is retained, but raw email addresses are removed from login_attempts.
 * This is safe to run repeatedly and never exposes the legacy value in logs.
 */
export async function scrubLegacyLoginAttemptEmails(service: AuthService): Promise<number> {
  const cursor = LoginAttemptModel.find({ email: { $exists: true } })
    .select('+email +accountHash')
    .lean()
    .cursor();
  const operations: Parameters<typeof LoginAttemptModel.bulkWrite>[0] = [];
  let scrubbed = 0;

  async function flush(): Promise<void> {
    if (operations.length === 0) return;
    const batch = operations.splice(0, operations.length);
    await LoginAttemptModel.bulkWrite(batch, { ordered: false });
  }

  for await (const attempt of cursor) {
    if (!attempt.email) continue;
    operations.push({
      updateOne: {
        filter: { _id: attempt._id, email: { $exists: true } },
        update: {
          ...(attempt.accountHash
            ? {}
            : { $set: { accountHash: service.securityEvidence('account', attempt.email) } }),
          $unset: { email: 1 },
        },
      },
    });
    scrubbed += 1;
    if (operations.length >= 500) await flush();
  }
  await flush();
  return scrubbed;
}
