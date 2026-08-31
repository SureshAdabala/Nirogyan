import { validateCalculatorVersion, validateMeasurementDefinitionStructure } from '@niro/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  assertSafeP7FixtureEnvironment,
  authorizeP7FixtureWrites,
  createP7CalculatorPayload,
  createP7MeasurementDefinition,
  createP7MeasurementEnvelope,
  inspectP7FixtureFootprint,
  p7FixtureIdentities,
  p7FixtureKeys,
  p7FixtureOwnershipIssue,
  p7TemporaryDatabaseName,
  rethrowAfterP7Cleanup,
  settleP7ModelInitialization,
  type P7FixtureFootprint,
} from './p7-browser-fixture';

const NONCE = '0123456789abcdef0123456789abcd';

function ownedFootprint(): P7FixtureFootprint {
  const keys = p7FixtureKeys(NONCE);
  const ids = p7FixtureIdentities(NONCE);
  return {
    manifests: [
      {
        _id: ids.manifestId,
        fixtureId: 'p7-calculator-studio-browser-fixture-v1',
        nonce: NONCE,
        databaseName: p7TemporaryDatabaseName(NONCE),
        adminIds: [ids.adminId.toString(), ids.reviewerId.toString()],
        adminEmails: [keys.adminEmail, keys.reviewerEmail],
        measurementRevisionId: ids.measurementId.toString(),
        measurementKey: keys.measurement,
        calculatorSlug: keys.calculator,
      },
    ],
    admins: [
      {
        _id: ids.adminId,
        email: keys.adminEmail,
        role: 'admin',
        status: 'active',
      },
      {
        _id: ids.reviewerId,
        email: keys.reviewerEmail,
        role: 'medical-reviewer',
        status: 'active',
      },
    ],
    measurements: [createP7MeasurementEnvelope(NONCE)],
  };
}

describe('P7 fixture isolation and write authorization', () => {
  it('requires the exact nonce database, nonproduction mode, and explicit write opt-in', () => {
    const database = p7TemporaryDatabaseName(NONCE);
    expect(database).toBe('niro_p7_0123456789abcdef0123456789abcd');
    expect(Buffer.byteLength(database)).toBe(38);
    const environment = { nodeEnv: 'test' as const, mongoDbName: database };
    expect(() => assertSafeP7FixtureEnvironment(environment, NONCE)).not.toThrow();
    expect(() => authorizeP7FixtureWrites(environment, NONCE, [])).toThrow(
      '--allow-temporary-database-write',
    );
    expect(() =>
      authorizeP7FixtureWrites(environment, NONCE, ['--allow-temporary-database-write']),
    ).not.toThrow();
    expect(() =>
      assertSafeP7FixtureEnvironment({ nodeEnv: 'test', mongoDbName: 'niro_dev' }, NONCE),
    ).toThrow('shared databases are refused');
    expect(() =>
      assertSafeP7FixtureEnvironment({ nodeEnv: 'production', mongoDbName: database }, NONCE),
    ).toThrow('forbidden in production');
  });

  it.each([
    '0123456789abcdef',
    '0123456789ABCDEF0123456789ABCD',
    '0123456789abcdef0123456789abcdef',
    'p7-ui-0123456789abcdef01234567',
  ])('rejects noncanonical nonce %s', (nonce) => {
    expect(() => p7TemporaryDatabaseName(nonce)).toThrow('30 lowercase hexadecimal');
  });
});

describe('P7 canonical nonclinical fixture artifacts', () => {
  it('creates a structurally valid and verified canonical measurement', () => {
    const definition = createP7MeasurementDefinition(NONCE);
    expect(validateMeasurementDefinitionStructure(definition).valid).toBe(true);
    expect(createP7MeasurementEnvelope(NONCE)).toMatchObject({
      _id: p7FixtureIdentities(NONCE).measurementId,
      key: p7FixtureKeys(NONCE).measurement,
      revision: 1,
      status: 'verified',
    });
  });

  it('creates a deterministic publish-eligible nonclinical Calculator Studio import', () => {
    const revisionId = p7FixtureIdentities(NONCE).measurementId.toString();
    const payload = createP7CalculatorPayload(NONCE);
    const validation = validateCalculatorVersion(payload, 'p7-browser-fixture');
    expect(validation.publishEligible).toBe(true);
    expect(payload).toMatchObject({
      calculatorSlug: p7FixtureKeys(NONCE).calculator,
      status: 'approved',
      governance: { clinicalStatus: 'not-applicable', measurementRevisionIds: [revisionId] },
    });
    expect(createP7CalculatorPayload(NONCE)).toEqual(payload);
  });

  it('accepts only an exact manifest/admin/measurement seed footprint', () => {
    const footprint = ownedFootprint();
    expect(p7FixtureOwnershipIssue(NONCE, footprint)).toBeUndefined();
    expect(
      p7FixtureOwnershipIssue(NONCE, { ...footprint, admins: footprint.admins.slice(0, 1) }),
    ).toContain('cardinality');
    const measurement = footprint.measurements[0]!;
    expect(
      p7FixtureOwnershipIssue(NONCE, {
        ...footprint,
        measurements: [{ ...measurement, migrationProvenance: { fixture: 'foreign' } }],
      }),
    ).toContain('not exactly owned');
  });

  it('reports ownership read-only before guarded cleanup', () => {
    const footprint = ownedFootprint();
    expect(inspectP7FixtureFootprint(NONCE, footprint)).toEqual({
      status: 'ok',
      action: 'inspect',
      database: p7TemporaryDatabaseName(NONCE),
      nonce: NONCE,
      fixtureOnly: true,
      ownershipVerified: true,
      issue: null,
    });
    const partial = inspectP7FixtureFootprint(NONCE, {
      ...footprint,
      admins: footprint.admins.slice(0, 1),
    });
    expect(partial.status).toBe('not-owned');
    expect(partial.ownershipVerified).toBe(false);
    expect(partial.issue).toContain('cardinality');
  });

  it('preserves both the operation and cleanup failures', async () => {
    const operationError = new Error('operation failed');
    const cleanup = vi.fn(async () => undefined);
    await expect(rethrowAfterP7Cleanup(operationError, cleanup)).rejects.toBe(operationError);
    expect(cleanup).toHaveBeenCalledOnce();
    const cleanupError = new Error('cleanup failed');
    await expect(
      rethrowAfterP7Cleanup(operationError, async () => {
        throw cleanupError;
      }),
    ).rejects.toMatchObject({ errors: [operationError, cleanupError] });
  });

  it('drains every loaded model initializer before guarded database deletion', async () => {
    let releaseInitialization: (() => void) | undefined;
    const delayed = vi.fn(
      async () =>
        await new Promise<void>((resolveInitialization) => {
          releaseInitialization = resolveInitialization;
        }),
    );
    const immediate = vi.fn(async () => undefined);
    let settled = false;
    const pending = settleP7ModelInitialization([{ init: delayed }, { init: immediate }]).then(
      () => {
        settled = true;
      },
    );

    await Promise.resolve();
    expect(delayed).toHaveBeenCalledOnce();
    expect(immediate).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    releaseInitialization?.();
    await pending;
    expect(settled).toBe(true);
  });
});
