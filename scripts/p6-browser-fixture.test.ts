import { validateCalculatorVersion } from '@niro/contracts';
import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  assertSafeP6FixtureEnvironment,
  authorizeP6FixtureWrites,
  canonicalP6CalculatorVersionHash,
  createP6CalculatorPayload,
  createP6MeasurementEnvelopes,
  createP6MeasurementSnapshot,
  p6FixtureKeys,
  p6FixtureOwnershipIssue,
  p6TemporaryDatabaseName,
  rethrowAfterP6UnknownCommit,
  type FixtureFootprint,
} from './p6-browser-fixture';

const PREFIX = 'p6-ui-0123456789abcdef0123456789abcd';

function ownedFootprint(): FixtureFootprint {
  const keys = p6FixtureKeys(PREFIX);
  const measurements = createP6MeasurementEnvelopes(PREFIX).map((record) => ({
    ...record,
    _id: new Types.ObjectId(),
  }));
  const current = measurements[1]!;
  const revisionId = String(current._id);
  const payload = createP6CalculatorPayload(PREFIX, keys.primary, [revisionId]);
  const calculatorId = new Types.ObjectId();
  const versionId = new Types.ObjectId();
  return {
    measurements,
    calculators: [
      {
        _id: calculatorId,
        slug: keys.calculator,
        name: payload.name,
        currentVersionId: versionId,
      },
    ],
    versions: [
      {
        _id: versionId,
        calculatorId,
        calculatorSlug: keys.calculator,
        version: 1,
        status: 'published',
        payload,
        measurementRevisionIds: [revisionId],
        measurementSnapshots: [createP6MeasurementSnapshot(revisionId, current)],
        versionHash: canonicalP6CalculatorVersionHash(keys.calculator, 1, payload),
      },
    ],
  };
}

describe('P6 temporary fixture safety', () => {
  it('requires a unique isolated database and an explicit per-command write opt-in', () => {
    const databaseName = p6TemporaryDatabaseName(PREFIX);
    const environment = { nodeEnv: 'test' as const, mongoDbName: databaseName };
    expect(databaseName).toBe('niro_p6_0123456789abcdef0123456789abcd');
    expect(Buffer.byteLength(databaseName, 'utf8')).toBe(38);
    expect(() => assertSafeP6FixtureEnvironment(environment, PREFIX)).not.toThrow();
    expect(() => authorizeP6FixtureWrites(environment, PREFIX, [])).toThrow(
      '--allow-temporary-database-write',
    );
    expect(() =>
      authorizeP6FixtureWrites(environment, PREFIX, ['--allow-temporary-database-write']),
    ).not.toThrow();
    expect(() =>
      assertSafeP6FixtureEnvironment({ nodeEnv: 'test', mongoDbName: 'niro_dev' }, PREFIX),
    ).toThrow('shared development databases are refused');
    expect(() =>
      assertSafeP6FixtureEnvironment({ nodeEnv: 'production', mongoDbName: databaseName }, PREFIX),
    ).toThrow('forbidden in production');
  });

  it.each([
    'p6-ui-live-0123456789abcdef01234567',
    'p6-ui-0123456789ABCDEF0123456789ABCD',
    'p6-ui-0123456789abcdef0123456789abcdef',
    'p6-ui-0123456789abcdef',
  ])('rejects a non-unique or noncanonical fixture prefix: %s', (prefix) => {
    expect(() => p6FixtureKeys(prefix)).toThrow('30 lowercase hex');
  });
});

describe('P6 canonical calculator fixture', () => {
  it('is publish-eligible nonclinical configuration with deterministic canonical hashing', () => {
    const keys = p6FixtureKeys(PREFIX);
    const revisionId = new Types.ObjectId().toString();
    const payload = createP6CalculatorPayload(PREFIX, keys.primary, [revisionId]);
    const validation = validateCalculatorVersion(payload, 'p6-test-fixture');
    expect(validation.publishEligible).toBe(true);
    expect(payload).toMatchObject({
      $schema: 'niro-platform/calculator-version.v1',
      calculatorSlug: keys.calculator,
      status: 'approved',
      governance: { measurementRevisionIds: [revisionId] },
    });

    const reversedPayload = Object.fromEntries(Object.entries(payload).reverse());
    expect(canonicalP6CalculatorVersionHash(keys.calculator, 1, reversedPayload)).toBe(
      canonicalP6CalculatorVersionHash(keys.calculator, 1, payload),
    );
    expect(canonicalP6CalculatorVersionHash(keys.calculator, 1, payload)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts only a complete nonce-owned footprint with exact revision snapshots', () => {
    const footprint = ownedFootprint();
    expect(p6FixtureOwnershipIssue(PREFIX, footprint)).toBeUndefined();

    const partial: FixtureFootprint = {
      ...footprint,
      measurements: footprint.measurements.slice(0, 4),
    };
    expect(p6FixtureOwnershipIssue(PREFIX, partial)).toContain('partial');

    const persistedVersion = footprint.versions[0]!;
    const persistedSnapshots = persistedVersion.measurementSnapshots as Array<
      Record<string, unknown>
    >;
    const tamperedSnapshot: FixtureFootprint = {
      ...footprint,
      versions: [
        {
          ...persistedVersion,
          measurementSnapshots: [{ ...persistedSnapshots[0], definitionHash: 'unowned' }],
        },
      ],
    };
    expect(p6FixtureOwnershipIssue(PREFIX, tamperedSnapshot)).toContain('snapshot');
  });

  it('runs verified cleanup after an unknown seed commit and preserves both failures', async () => {
    const original = new Error('unknown transaction commit');
    const cleanup = vi.fn(async () => undefined);
    await expect(rethrowAfterP6UnknownCommit(original, cleanup)).rejects.toBe(original);
    expect(cleanup).toHaveBeenCalledOnce();

    const cleanupError = new Error('cleanup ownership verification failed');
    await expect(
      rethrowAfterP6UnknownCommit(original, async () => {
        throw cleanupError;
      }),
    ).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [original, cleanupError],
    });
  });
});
