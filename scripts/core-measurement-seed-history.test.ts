import { describe, expect, it } from 'vitest';

import {
  buildCoreMeasurementHistoryManifest,
  findCoreMeasurementChronologyConflicts,
  preflightCoreMeasurementHistory,
  validateCoreMeasurementHistoryManifest,
} from './core-measurement-seed-history';
import type { StoredCoreMeasurementRevisionContent } from './core-measurement-seed-persistence';

const KEYS = Array.from({ length: 40 }, (_, index) => `measurement-${String(index + 1)}`);

function row(key: string, revision: 1 | 2): StoredCoreMeasurementRevisionContent {
  const definition = { key, version: revision, value: `definition-${revision}` };
  return {
    key,
    revision,
    status: 'draft',
    displayName: `Measurement ${key}`,
    kind: 'biomarker',
    canonicalUnit: 'mg/dL',
    definitionHash: `definition-hash-${revision}-${key}`,
    definition,
    sources: [{ id: `source-${key}` }],
    migrationProvenance: { sourcePointer: `/biomarkers/${key}`, validation: {} },
  };
}

function completeHistory(): StoredCoreMeasurementRevisionContent[] {
  return [...KEYS.map((key) => row(key, 1)), ...KEYS.map((key) => row(key, 2))];
}

describe('P6 seed audit-history preflight', () => {
  it('accepts a clean database or the exact checked history', () => {
    const rows = completeHistory();
    const manifest = buildCoreMeasurementHistoryManifest(rows);

    expect(validateCoreMeasurementHistoryManifest(manifest, KEYS)).toEqual([]);
    expect(preflightCoreMeasurementHistory([], manifest, KEYS)).toEqual({
      disposition: 'clean-database',
      rowsChecked: 0,
      revisionHashes: {},
    });
    expect(preflightCoreMeasurementHistory(rows, manifest, KEYS)).toMatchObject({
      disposition: 'matched-audit-history',
      rowsChecked: 80,
      revisionHashes: { '1': expect.stringMatching(/^[a-f0-9]{64}$/u) },
    });
  });

  it('rejects partial history before any seed insert can run', () => {
    const rows = completeHistory();
    const manifest = buildCoreMeasurementHistoryManifest(rows);
    expect(() => preflightCoreMeasurementHistory(rows.slice(0, -1), manifest, KEYS)).toThrow(
      'historical revisions 1/2 are partial (79/80 rows)',
    );
  });

  it('rejects drift in any historical seed-owned field', () => {
    const rows = completeHistory();
    const manifest = buildCoreMeasurementHistoryManifest(rows);
    const drifted = structuredClone(rows);
    const first = drifted[0];
    if (!first) throw new Error('Expected a history row.');
    Object.assign(first, { status: 'verified' });
    expect(() => preflightCoreMeasurementHistory(drifted, manifest, KEYS)).toThrow(
      'historical content drift at measurement-1@1',
    );
  });

  it('rejects a checked manifest whose whole-revision hash was altered', () => {
    const rows = completeHistory();
    const manifest = buildCoreMeasurementHistoryManifest(rows);
    const altered = structuredClone(manifest);
    const first = altered.revisions[0];
    if (!first) throw new Error('Expected a manifest revision.');
    Object.assign(first, { revisionHash: '0'.repeat(64) });
    expect(validateCoreMeasurementHistoryManifest(altered, KEYS)).toContain(
      'revision 1 whole-revision hash does not match its records.',
    );
    expect(() => preflightCoreMeasurementHistory(rows, altered, KEYS)).toThrow(
      'Invalid checked audit-history manifest',
    );
  });

  it('rejects capture input that is partial or outside revisions 1/2', () => {
    expect(() => buildCoreMeasurementHistoryManifest(completeHistory().slice(0, 40))).toThrow(
      'expected 40 rows, found 0',
    );
    expect(() =>
      buildCoreMeasurementHistoryManifest([
        ...completeHistory(),
        { ...row(KEYS[0]!, 2), revision: 3 },
      ]),
    ).toThrow('outside revisions 1 and 2');
  });
});

describe('P6 seed revision chronology', () => {
  it('rejects a missing revision 3 when any later revision exists for that key', () => {
    expect(
      findCoreMeasurementChronologyConflicts(
        [
          { key: 'alpha', revision: 1 },
          { key: 'alpha', revision: 4 },
          { key: 'beta', revision: 3 },
          { key: 'beta', revision: 5 },
        ],
        ['alpha', 'beta'],
      ),
    ).toEqual(['alpha']);
  });

  it('allows no later revisions and allows a complete revision-3 chronology', () => {
    expect(
      findCoreMeasurementChronologyConflicts(
        [
          { key: 'alpha', revision: 1 },
          { key: 'beta', revision: 2 },
          { key: 'gamma', revision: 3 },
          { key: 'gamma', revision: 9 },
        ],
        ['alpha', 'beta', 'gamma'],
      ),
    ).toEqual([]);
  });
});
