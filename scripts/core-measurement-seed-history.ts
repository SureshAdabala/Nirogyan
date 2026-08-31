import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { stableJsonStringify } from '../packages/contracts/src/measurement-seed';
import {
  CORE_MEASUREMENT_SEED_REVISION,
  hashCoreMeasurementRevisionContent,
  type StoredCoreMeasurementRevisionContent,
} from './core-measurement-seed-persistence';

export const CORE_MEASUREMENT_HISTORY_MANIFEST_PATH = join(
  resolve(__dirname, '..'),
  'data',
  'seeds',
  'core-measurements.audit-history.v1.json',
);

export const CORE_MEASUREMENT_HISTORY_REVISIONS = [1, 2] as const;

export interface CoreMeasurementHistoryManifestRecord {
  readonly key: string;
  readonly contentHash: string;
}

export interface CoreMeasurementHistoryManifestRevision {
  readonly revision: (typeof CORE_MEASUREMENT_HISTORY_REVISIONS)[number];
  readonly recordCount: 40;
  readonly revisionHash: string;
  readonly records: readonly CoreMeasurementHistoryManifestRecord[];
}

export interface CoreMeasurementHistoryManifest {
  readonly schemaVersion: 'core-measurement-seed-audit-history.v1';
  readonly collection: 'biomarkers';
  readonly hashAlgorithm: 'sha256(stable-json-v1)';
  readonly scope: 'seed-owned-fields-only';
  readonly revisions: readonly CoreMeasurementHistoryManifestRevision[];
}

export interface CoreMeasurementHistoryPreflightResult {
  readonly disposition: 'clean-database' | 'matched-audit-history';
  readonly rowsChecked: number;
  readonly revisionHashes: Readonly<Record<string, string>>;
}

export interface CoreMeasurementRevisionIdentity {
  readonly key: string;
  readonly revision: number;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJsonStringify(value)).digest('hex');
}

function isHistoryRevision(
  value: number,
): value is (typeof CORE_MEASUREMENT_HISTORY_REVISIONS)[number] {
  return CORE_MEASUREMENT_HISTORY_REVISIONS.some((revision) => revision === value);
}

function sortedRecordHashes(
  rows: readonly StoredCoreMeasurementRevisionContent[],
): CoreMeasurementHistoryManifestRecord[] {
  return rows
    .map((row) => ({ key: row.key, contentHash: hashCoreMeasurementRevisionContent(row) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function hashCoreMeasurementHistoryRevision(
  revision: number,
  records: readonly CoreMeasurementHistoryManifestRecord[],
): string {
  return sha256({
    revision,
    records: [...records].sort((left, right) => left.key.localeCompare(right.key)),
  });
}

/** Build a candidate from a read-only Atlas query. This function never writes it. */
export function buildCoreMeasurementHistoryManifest(
  rows: readonly StoredCoreMeasurementRevisionContent[],
): CoreMeasurementHistoryManifest {
  const revisions = CORE_MEASUREMENT_HISTORY_REVISIONS.map((revision) => {
    const revisionRows = rows.filter((row) => row.revision === revision);
    const records = sortedRecordHashes(revisionRows);
    if (records.length !== 40) {
      throw new Error(
        `Cannot capture audit history revision ${revision}: expected 40 rows, found ${records.length}.`,
      );
    }
    if (new Set(records.map((record) => record.key)).size !== records.length) {
      throw new Error(`Cannot capture audit history revision ${revision}: duplicate keys found.`);
    }
    return {
      revision,
      recordCount: 40 as const,
      revisionHash: hashCoreMeasurementHistoryRevision(revision, records),
      records,
    };
  });
  const unexpected = rows.filter((row) => !isHistoryRevision(row.revision));
  if (unexpected.length > 0) {
    throw new Error('Audit history capture received rows outside revisions 1 and 2.');
  }
  return {
    schemaVersion: 'core-measurement-seed-audit-history.v1',
    collection: 'biomarkers',
    hashAlgorithm: 'sha256(stable-json-v1)',
    scope: 'seed-owned-fields-only',
    revisions,
  };
}

export function readCheckedCoreMeasurementHistoryManifest(): CoreMeasurementHistoryManifest {
  if (!existsSync(CORE_MEASUREMENT_HISTORY_MANIFEST_PATH)) {
    throw new Error(
      `The checked audit-history manifest is missing: ${CORE_MEASUREMENT_HISTORY_MANIFEST_PATH}`,
    );
  }
  return JSON.parse(
    readFileSync(CORE_MEASUREMENT_HISTORY_MANIFEST_PATH, 'utf8'),
  ) as CoreMeasurementHistoryManifest;
}

export function validateCoreMeasurementHistoryManifest(
  manifest: CoreMeasurementHistoryManifest,
  expectedKeys: readonly string[],
): readonly string[] {
  const findings: string[] = [];
  if (manifest.schemaVersion !== 'core-measurement-seed-audit-history.v1') {
    findings.push('schemaVersion must be core-measurement-seed-audit-history.v1.');
  }
  if (manifest.collection !== 'biomarkers') findings.push('collection must be biomarkers.');
  if (manifest.hashAlgorithm !== 'sha256(stable-json-v1)') {
    findings.push('hashAlgorithm must be sha256(stable-json-v1).');
  }
  if (manifest.scope !== 'seed-owned-fields-only') {
    findings.push('scope must be seed-owned-fields-only.');
  }
  if (manifest.revisions.length !== CORE_MEASUREMENT_HISTORY_REVISIONS.length) {
    findings.push('manifest must contain exactly revisions 1 and 2.');
  }
  const sortedExpectedKeys = [...expectedKeys].sort();
  for (const revision of CORE_MEASUREMENT_HISTORY_REVISIONS) {
    const entry = manifest.revisions.find((candidate) => candidate.revision === revision);
    if (!entry) {
      findings.push(`revision ${revision} is missing.`);
      continue;
    }
    if (entry.recordCount !== 40 || entry.records.length !== 40) {
      findings.push(`revision ${revision} must contain exactly 40 records.`);
    }
    const keys = entry.records.map((record) => record.key);
    if (new Set(keys).size !== keys.length) {
      findings.push(`revision ${revision} contains duplicate keys.`);
    }
    if (stableJsonStringify([...keys].sort()) !== stableJsonStringify(sortedExpectedKeys)) {
      findings.push(`revision ${revision} key set does not match the checked revision-3 seed.`);
    }
    if (entry.records.some((record) => !/^[a-f0-9]{64}$/u.test(record.contentHash))) {
      findings.push(`revision ${revision} contains an invalid record content hash.`);
    }
    const calculated = hashCoreMeasurementHistoryRevision(revision, entry.records);
    if (entry.revisionHash !== calculated) {
      findings.push(`revision ${revision} whole-revision hash does not match its records.`);
    }
  }
  return findings;
}

/**
 * Require the historical v1/v2 rows to be either wholly absent or exactly equal
 * to the checked read-only Atlas capture. Partial or drifted history is unsafe.
 */
export function preflightCoreMeasurementHistory(
  rows: readonly StoredCoreMeasurementRevisionContent[],
  manifest: CoreMeasurementHistoryManifest,
  expectedKeys: readonly string[],
): CoreMeasurementHistoryPreflightResult {
  const manifestFindings = validateCoreMeasurementHistoryManifest(manifest, expectedKeys);
  if (manifestFindings.length > 0) {
    throw new Error(`Invalid checked audit-history manifest: ${manifestFindings.join(' ')}`);
  }
  if (rows.length === 0) {
    return { disposition: 'clean-database', rowsChecked: 0, revisionHashes: {} };
  }
  const unexpected = rows.filter((row) => !isHistoryRevision(row.revision));
  if (unexpected.length > 0) {
    throw new Error('Audit-history preflight received rows outside revisions 1 and 2.');
  }
  const expectedRows = manifest.revisions.reduce((sum, revision) => sum + revision.recordCount, 0);
  if (rows.length !== expectedRows) {
    throw new Error(
      `Refusing seed apply: historical revisions 1/2 are partial (${rows.length}/${expectedRows} rows).`,
    );
  }

  const revisionHashes: Record<string, string> = {};
  for (const expectedRevision of manifest.revisions) {
    const revisionRows = rows.filter((row) => row.revision === expectedRevision.revision);
    const actualRecords = sortedRecordHashes(revisionRows);
    if (actualRecords.length !== expectedRevision.recordCount) {
      throw new Error(
        `Refusing seed apply: revision ${expectedRevision.revision} is partial (${actualRecords.length}/${expectedRevision.recordCount} rows).`,
      );
    }
    const expectedByKey = new Map(
      expectedRevision.records.map((record) => [record.key, record.contentHash]),
    );
    for (const actual of actualRecords) {
      const expectedHash = expectedByKey.get(actual.key);
      if (!expectedHash) {
        throw new Error(
          `Refusing seed apply: revision ${expectedRevision.revision} contains unexpected key ${actual.key}.`,
        );
      }
      if (actual.contentHash !== expectedHash) {
        throw new Error(
          `Refusing seed apply: historical content drift at ${actual.key}@${expectedRevision.revision}.`,
        );
      }
    }
    const actualRevisionHash = hashCoreMeasurementHistoryRevision(
      expectedRevision.revision,
      actualRecords,
    );
    if (actualRevisionHash !== expectedRevision.revisionHash) {
      throw new Error(
        `Refusing seed apply: whole-revision hash drift at revision ${expectedRevision.revision}.`,
      );
    }
    revisionHashes[String(expectedRevision.revision)] = actualRevisionHash;
  }
  return {
    disposition: 'matched-audit-history',
    rowsChecked: rows.length,
    revisionHashes,
  };
}

/** A later revision may never exist while this seed's revision 3 is absent. */
export function findCoreMeasurementChronologyConflicts(
  rows: readonly CoreMeasurementRevisionIdentity[],
  expectedKeys: readonly string[],
): readonly string[] {
  const expected = new Set(expectedKeys);
  const revisionsByKey = new Map<string, Set<number>>();
  for (const row of rows) {
    if (!expected.has(row.key)) continue;
    const revisions = revisionsByKey.get(row.key) ?? new Set<number>();
    revisions.add(row.revision);
    revisionsByKey.set(row.key, revisions);
  }
  return [...revisionsByKey.entries()]
    .filter(([, revisions]) => {
      const hasTarget = revisions.has(CORE_MEASUREMENT_SEED_REVISION);
      const hasLater = [...revisions].some((revision) => revision > CORE_MEASUREMENT_SEED_REVISION);
      return !hasTarget && hasLater;
    })
    .map(([key]) => key)
    .sort();
}
