import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAuthService,
  hashPassword,
  scrubLegacyLoginAttemptEmails,
  verifyPassword,
} from './service';
import { AdminSessionModel } from '../persistence/models/admin-session';
import { AdminUserModel } from '../persistence/models/admin-user';
import { LoginAttemptModel } from '../persistence/models/login-attempt';

const ACCESS_SECRET = 'access-secret-for-test';
const REFRESH_SECRET = 'refresh-secret-for-test';

function sessionAccessToken(familyId = 'session-family-1'): string {
  return jwt.sign(
    {
      sub: '64c000000000000000000001',
      email: 'token-email@example.test',
      role: 'editor',
      tokenType: 'access',
      familyId,
    },
    ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: 60 },
  );
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sessionQuery(session: Record<string, unknown> | null) {
  return { select: vi.fn().mockResolvedValue(session) };
}

function userQuery(user: Record<string, unknown> | null) {
  return { lean: vi.fn().mockResolvedValue(user) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin authentication foundation', () => {
  it('creates deterministic domain-separated keyed security evidence', () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const network = service.securityEvidence('network', '203.0.113.10');
    expect(network).toMatch(/^v1:[a-f\d]{64}$/);
    expect(network).toBe(service.securityEvidence('network', '203.0.113.10'));
    expect(network).not.toBe(service.securityEvidence('account', '203.0.113.10'));
    expect(network).not.toContain('203.0.113.10');
  });

  it('persists only keyed account evidence for unknown, disabled, and locked login attempts', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const create = vi.spyOn(LoginAttemptModel, 'create').mockResolvedValue({} as never);
    const findOne = vi.spyOn(AdminUserModel, 'findOne');
    const cases = [
      { user: null, code: 'INVALID_CREDENTIALS', reason: 'unknown-user' },
      {
        user: { status: 'disabled' },
        code: 'ACCOUNT_DISABLED',
        reason: 'account-disabled',
      },
      {
        user: { status: 'active', lockedUntil: new Date(Date.now() + 60_000) },
        code: 'ACCOUNT_LOCKED',
        reason: 'account-locked',
      },
    ] as const;

    for (const [index, item] of cases.entries()) {
      findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(item.user) } as never);
      const email = `Raw.Private-${index}@Example.test`;
      await expect(
        service.login(email, 'wrong-password', {
          ipHash: service.securityEvidence('network', `203.0.113.${index + 1}`),
        }),
      ).rejects.toMatchObject({ code: item.code });
      const persisted = create.mock.calls.at(-1)?.[0];
      expect(persisted).toMatchObject({
        accountHash: service.securityEvidence('account', email.toLowerCase()),
        success: false,
        reason: item.reason,
      });
      expect(persisted).not.toHaveProperty('email');
      expect(JSON.stringify(persisted)).not.toContain(email);
    }
  });

  it('scrubs legacy raw login emails while preserving opaque grouping evidence', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const legacyEmail = 'legacy.private@example.test';
    const query = {
      select: vi.fn(),
      lean: vi.fn(),
      cursor: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    query.cursor.mockReturnValue(
      (async function* () {
        yield { _id: '64c000000000000000000099', email: legacyEmail };
      })(),
    );
    vi.spyOn(LoginAttemptModel, 'find').mockReturnValue(query as never);
    const bulkWrite = vi.spyOn(LoginAttemptModel, 'bulkWrite').mockResolvedValue({} as never);

    await expect(scrubLegacyLoginAttemptEmails(service)).resolves.toBe(1);
    const operations = bulkWrite.mock.calls[0]?.[0];
    expect(operations).toEqual([
      {
        updateOne: {
          filter: { _id: '64c000000000000000000099', email: { $exists: true } },
          update: {
            $set: { accountHash: service.securityEvidence('account', legacyEmail) },
            $unset: { email: 1 },
          },
        },
      },
    ]);
    expect(JSON.stringify(operations)).not.toContain(legacyEmail);
  });

  it('hashes passwords and never treats plaintext as a valid hash', async () => {
    const password = 'a-long-development-password';
    const hashed = await hashPassword(password, 4);
    expect(hashed).not.toBe(password);
    await expect(verifyPassword(password, hashed)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hashed)).resolves.toBe(false);
  });

  it('accepts only correctly typed, signed access tokens', () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const token = jwt.sign(
      { sub: 'admin-1', email: 'admin@example.test', role: 'admin', tokenType: 'access' },
      ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: 60 },
    );
    expect(service.verifyAccess(token)).toEqual({
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'admin',
    });
    expect(() => service.verifyAccess(token + 'tampered')).toThrow(
      'Authentication token is invalid or expired.',
    );
  });

  it('binds access verification to a live session and the current active user record', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    const session = {
      revokedAt: undefined,
      expiresAt: new Date(Date.now() + 60_000),
      csrfTokenHash: hashToken('csrf-value'),
    };
    const findSession = vi
      .spyOn(AdminSessionModel, 'findOne')
      .mockReturnValue(sessionQuery(session) as never);
    vi.spyOn(AdminUserModel, 'findById').mockReturnValue(
      userQuery({
        _id: '64c000000000000000000001',
        email: 'current-email@example.test',
        role: 'medical-reviewer',
        status: 'active',
      }) as never,
    );

    await expect(service.verifyRequest(sessionAccessToken())).resolves.toEqual({
      id: '64c000000000000000000001',
      email: 'current-email@example.test',
      role: 'medical-reviewer',
    });
    expect(findSession).toHaveBeenCalledWith({
      tokenFamilyId: 'session-family-1',
      adminUserId: '64c000000000000000000001',
    });
  });

  it('rejects access tokens whose persisted session is revoked', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    vi.spyOn(AdminSessionModel, 'findOne').mockReturnValue(
      sessionQuery({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        csrfTokenHash: hashToken('csrf-value'),
      }) as never,
    );
    const findUser = vi.spyOn(AdminUserModel, 'findById');

    await expect(service.verifyRequest(sessionAccessToken())).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 401,
    });
    expect(findUser).not.toHaveBeenCalled();
  });

  it('rejects a valid session when its admin account has been disabled', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    vi.spyOn(AdminSessionModel, 'findOne').mockReturnValue(
      sessionQuery({
        revokedAt: undefined,
        expiresAt: new Date(Date.now() + 60_000),
        csrfTokenHash: hashToken('csrf-value'),
      }) as never,
    );
    vi.spyOn(AdminUserModel, 'findById').mockReturnValue(
      userQuery({
        _id: '64c000000000000000000001',
        email: 'admin@example.test',
        role: 'admin',
        status: 'disabled',
      }) as never,
    );

    await expect(service.verifyRequest(sessionAccessToken())).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
      status: 403,
    });
  });

  it('requires the session-bound CSRF token only when requested by the HTTP boundary', async () => {
    const service = createAuthService({
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
    });
    vi.spyOn(AdminSessionModel, 'findOne').mockReturnValue(
      sessionQuery({
        revokedAt: undefined,
        expiresAt: new Date(Date.now() + 60_000),
        csrfTokenHash: hashToken('correct-csrf-value'),
      }) as never,
    );
    vi.spyOn(AdminUserModel, 'findById').mockReturnValue(
      userQuery({
        _id: '64c000000000000000000001',
        email: 'admin@example.test',
        role: 'admin',
        status: 'active',
      }) as never,
    );

    await expect(
      service.verifyRequest(sessionAccessToken(), { requireCsrf: true }),
    ).rejects.toMatchObject({ code: 'CSRF_FAILED', status: 403 });
    await expect(
      service.verifyRequest(sessionAccessToken(), {
        requireCsrf: true,
        csrfToken: 'wrong-csrf-value',
      }),
    ).rejects.toMatchObject({ code: 'CSRF_FAILED', status: 403 });
    await expect(
      service.verifyRequest(sessionAccessToken(), {
        requireCsrf: true,
        csrfToken: 'correct-csrf-value',
      }),
    ).resolves.toMatchObject({ id: '64c000000000000000000001' });
  });
});
