import { describe, expect, it } from 'vitest';

import {
  assertRestoreVerificationTarget,
  missingRequiredRestoreCollections,
  REQUIRED_RESTORE_COLLECTIONS,
} from './verify-atlas-restore';

describe('Atlas restore verification safety gate', () => {
  const valid = {
    allowReadOnly: true,
    expectedDbName: 'niro_prod',
    configuredDbName: 'niro_prod',
    targetLabel: 'restore-drill-2026-08-28',
    uri: 'mongodb+srv://restore-reader:secret@restored.example/niro_prod',
  };

  it('accepts an explicit isolated, read-only restore target', () => {
    expect(() => assertRestoreVerificationTarget(valid)).not.toThrow();
  });

  it('rejects missing authorization, database mismatch, placeholders, and ambiguous labels', () => {
    expect(() => assertRestoreVerificationTarget({ ...valid, allowReadOnly: false })).toThrow(
      /allow-read-only/,
    );
    expect(() =>
      assertRestoreVerificationTarget({ ...valid, expectedDbName: 'different' }),
    ).toThrow(/exactly match/);
    expect(() =>
      assertRestoreVerificationTarget({ ...valid, uri: 'mongodb+srv://<placeholder>' }),
    ).toThrow(/configured Atlas/);
    expect(() => assertRestoreVerificationTarget({ ...valid, targetLabel: 'production' })).toThrow(
      /restore drill/,
    );
  });

  it('checks the implemented biomarker collection rather than a legacy model name', () => {
    expect(REQUIRED_RESTORE_COLLECTIONS).toContain('biomarkers');
    expect(REQUIRED_RESTORE_COLLECTIONS).not.toContain('measurement_revisions');
    expect(missingRequiredRestoreCollections(REQUIRED_RESTORE_COLLECTIONS)).toEqual([]);
    expect(
      missingRequiredRestoreCollections(
        REQUIRED_RESTORE_COLLECTIONS.map((name) =>
          name === 'biomarkers' ? 'measurement_revisions' : name,
        ),
      ),
    ).toEqual(['biomarkers']);
  });
});
