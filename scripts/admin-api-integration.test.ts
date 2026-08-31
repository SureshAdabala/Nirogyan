import { readFileSync } from 'node:fs';

import type { Db } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

import {
  authorizeP4IntegrationWrites,
  dropAndVerifyP4Database,
  mergeP4OperationAndCleanupFailures,
  p4CleanupOwnershipIssue,
  p4TemporaryDatabaseName,
  settleP4ModelInitialization,
  type P4DatabaseFootprint,
} from './admin-api-integration';
import {
  authorizeTemporaryDatabaseWrite,
  TEMPORARY_DATABASE_WRITE_OPT_IN,
} from './integration-write-authorization';

const NONCE = '0123456789abcdef0123456789abcd';
const DATABASE_NAME = `niro_p4_${NONCE}`;

function ownedCleanupFootprint(overrides: Partial<P4DatabaseFootprint> = {}): P4DatabaseFootprint {
  return {
    collectionCounts: { p4_integration_manifests: 1 },
    manifests: [
      {
        fixtureId: 'p4-admin-api-integration-v1',
        nonce: NONCE,
        databaseName: DATABASE_NAME,
      },
    ],
    ...overrides,
  };
}

describe('Atlas integration write authorization', () => {
  it('requires an explicit invocation opt-in and refuses production', () => {
    expect(() => authorizeTemporaryDatabaseWrite({ nodeEnv: 'test' }, [], 'Fixture')).toThrow(
      TEMPORARY_DATABASE_WRITE_OPT_IN,
    );
    expect(() =>
      authorizeTemporaryDatabaseWrite(
        { nodeEnv: 'production' },
        [TEMPORARY_DATABASE_WRITE_OPT_IN],
        'Fixture',
      ),
    ).toThrow('forbidden in production');
    expect(() =>
      authorizeTemporaryDatabaseWrite(
        { nodeEnv: 'test' },
        [TEMPORARY_DATABASE_WRITE_OPT_IN],
        'Fixture',
      ),
    ).not.toThrow();
  });

  it('wires authorization before connection in every guarded integration harness', () => {
    for (const [path, authorizationCall] of [
      ['scripts/db-integration-check.ts', 'authorizeTemporaryDatabaseWrite'],
      ['scripts/public-api-integration.ts', 'authorizeTemporaryDatabaseWrite'],
      ['scripts/admin-api-integration.ts', 'authorizeP4IntegrationWrites'],
    ] as const) {
      const source = readFileSync(path, 'utf8');
      const invocation = source.indexOf(`${authorizationCall}(environment`);
      expect(invocation).toBeGreaterThanOrEqual(0);
      expect(invocation).toBeLessThan(source.indexOf('await connectDatabase'));
    }
  });

  it('wires the P4 ownership proof before its guarded drop', () => {
    const source = readFileSync('scripts/admin-api-integration.ts', 'utf8');
    expect(source).toContain('LoginAttemptModel.deleteMany({ accountHash:');
    expect(source).toContain(
      "AdminGovernanceLockModel.deleteOne({ _id: 'active-admin-invariant' })",
    );
    expect(source.lastIndexOf('p4CleanupOwnershipIssue(')).toBeLessThan(
      source.lastIndexOf('dropAndVerifyP4Database('),
    );
    expect(source).toContain('mergeP4OperationAndCleanupFailures(failure, cleanupFailures)');
  });
});

describe('P4 temporary database ownership', () => {
  it('binds authorization to the exact generated database and rejects production', () => {
    expect(p4TemporaryDatabaseName(NONCE)).toBe(DATABASE_NAME);
    expect(Buffer.byteLength(DATABASE_NAME, 'utf8')).toBe(38);
    expect(() => p4TemporaryDatabaseName('not-a-nonce')).toThrow('30 lowercase hex');
    expect(() =>
      authorizeP4IntegrationWrites({ nodeEnv: 'test', mongoDbName: DATABASE_NAME }, NONCE, []),
    ).toThrow(TEMPORARY_DATABASE_WRITE_OPT_IN);
    expect(() =>
      authorizeP4IntegrationWrites({ nodeEnv: 'production', mongoDbName: DATABASE_NAME }, NONCE, [
        TEMPORARY_DATABASE_WRITE_OPT_IN,
      ]),
    ).toThrow('forbidden in production');
    expect(() =>
      authorizeP4IntegrationWrites({ nodeEnv: 'test', mongoDbName: 'niro_dev' }, NONCE, [
        TEMPORARY_DATABASE_WRITE_OPT_IN,
      ]),
    ).toThrow('exact owned database');
    expect(() =>
      authorizeP4IntegrationWrites({ nodeEnv: 'test', mongoDbName: DATABASE_NAME }, NONCE, [
        TEMPORARY_DATABASE_WRITE_OPT_IN,
      ]),
    ).not.toThrow();
  });

  it('accepts only one exact manifest and a zero-record application footprint', () => {
    expect(p4CleanupOwnershipIssue(NONCE, ownedCleanupFootprint())).toBeUndefined();
    expect(
      p4CleanupOwnershipIssue(
        NONCE,
        ownedCleanupFootprint({
          collectionCounts: { p4_integration_manifests: 1, calculators: 1 },
        }),
      ),
    ).toContain('calculators has cardinality 1');
    expect(
      p4CleanupOwnershipIssue(
        NONCE,
        ownedCleanupFootprint({
          collectionCounts: { p4_integration_manifests: 1, foreign_records: 0 },
        }),
      ),
    ).toContain('Unexpected');
    expect(
      p4CleanupOwnershipIssue(
        NONCE,
        ownedCleanupFootprint({ collectionCounts: {}, manifests: [] }),
      ),
    ).toContain('manifest collection is missing');
    expect(
      p4CleanupOwnershipIssue(
        NONCE,
        ownedCleanupFootprint({
          manifests: [...ownedCleanupFootprint().manifests, ...ownedCleanupFootprint().manifests],
        }),
      ),
    ).toContain('Exactly one');
    expect(
      p4CleanupOwnershipIssue(
        NONCE,
        ownedCleanupFootprint({
          manifests: [
            {
              fixtureId: 'p4-admin-api-integration-v1',
              nonce: 'fedcba98765432100123456789abcd',
              databaseName: DATABASE_NAME,
            },
          ],
        }),
      ),
    ).toContain('does not match');
  });

  it('waits for every model initializer before guarded cleanup', async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    await settleP4ModelInitialization([{ init: first }, { init: second }]);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('drops only the exact namespace and verifies it disappears', async () => {
    const dropDatabase = vi.fn(async () => true);
    const listDatabases = vi
      .fn()
      .mockResolvedValueOnce({ databases: [{ name: DATABASE_NAME }] })
      .mockResolvedValueOnce({ databases: [] });
    const database = {
      databaseName: DATABASE_NAME,
      dropDatabase,
      admin: () => ({ listDatabases }),
    } as unknown as Db;

    await expect(
      dropAndVerifyP4Database(database, DATABASE_NAME, { attempts: 2, delayMs: 0 }),
    ).resolves.toBeUndefined();
    expect(dropDatabase).toHaveBeenCalledOnce();
    expect(listDatabases).toHaveBeenCalledTimes(2);

    await expect(
      dropAndVerifyP4Database(database, 'niro_p4_wrong', { attempts: 1, delayMs: 0 }),
    ).rejects.toThrow('outside the authorized P4 namespace');
  });

  it('refuses a cleanup whose namespace remains listed', async () => {
    const database = {
      databaseName: DATABASE_NAME,
      dropDatabase: vi.fn(async () => true),
      admin: () => ({
        listDatabases: vi.fn(async () => ({ databases: [{ name: DATABASE_NAME }] })),
      }),
    } as unknown as Db;
    await expect(
      dropAndVerifyP4Database(database, DATABASE_NAME, { attempts: 2, delayMs: 0 }),
    ).rejects.toThrow('did not remove');
  });

  it('preserves operation and cleanup failures in order', () => {
    const operation = new Error('operation failed');
    const cleanupOne = new Error('close failed');
    const cleanupTwo = new Error('drop verification failed');
    expect(mergeP4OperationAndCleanupFailures(operation, [])).toBe(operation);
    expect(mergeP4OperationAndCleanupFailures(undefined, [])).toBeUndefined();
    const combined = mergeP4OperationAndCleanupFailures(operation, [cleanupOne, cleanupTwo]);
    expect(combined).toBeInstanceOf(AggregateError);
    expect((combined as AggregateError).errors).toEqual([operation, cleanupOne, cleanupTwo]);
    const cleanupOnly = mergeP4OperationAndCleanupFailures(undefined, [cleanupOne]);
    expect((cleanupOnly as AggregateError).errors).toEqual([cleanupOne]);
  });
});
