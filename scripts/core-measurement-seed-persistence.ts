import { createHash } from 'node:crypto';

import {
  stableJsonStringify,
  type CoreMeasurementSeedRecord,
} from '../packages/contracts/src/measurement-seed';

export interface StoredCoreMeasurementRevisionContent {
  readonly key: string;
  readonly revision: number;
  readonly status: string;
  readonly displayName: string;
  readonly kind: string;
  readonly canonicalUnit?: string;
  readonly definitionHash: string;
  readonly definition: unknown;
  readonly sources: unknown;
  readonly migrationProvenance?: unknown;
}

export const CORE_MEASUREMENT_SEED_REVISION = 3 as const;

export type CoreMeasurementSeedContentMismatch =
  | 'none'
  | 'key-field'
  | 'revision-field'
  | 'status-field'
  | 'display-name-field'
  | 'kind-field'
  | 'canonical-unit-field'
  | 'definition-hash-field'
  | 'definition-content'
  | 'sources-content'
  | 'migration-provenance-content';

export interface CoreMeasurementRevisionContentComparison {
  readonly matches: boolean;
  readonly expectedDefinitionHash: string;
  readonly expectedSeedContentHash: string;
  readonly actualSeedContentHash: string;
  readonly mismatch: CoreMeasurementSeedContentMismatch;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJsonStringify(value)).digest('hex');
}

export function expectedCoreMeasurementRevisionContent(
  record: CoreMeasurementSeedRecord,
): StoredCoreMeasurementRevisionContent {
  const definition = record.definition;
  return {
    key: definition.key,
    revision: definition.version,
    status: 'draft',
    displayName: definition.displayName,
    kind: definition.kind === 'derived-measurement' ? 'derived' : 'biomarker',
    canonicalUnit: definition.canonicalUnit.code,
    definitionHash: sha256(definition),
    definition,
    sources: definition.sources,
    migrationProvenance: record.provenance,
  };
}

function persistedSeedContent(
  stored: StoredCoreMeasurementRevisionContent,
): StoredCoreMeasurementRevisionContent {
  return {
    key: stored.key,
    revision: stored.revision,
    status: stored.status,
    displayName: stored.displayName,
    kind: stored.kind,
    canonicalUnit: stored.canonicalUnit,
    definitionHash: stored.definitionHash,
    definition: stored.definition,
    sources: stored.sources,
    migrationProvenance: stored.migrationProvenance,
  };
}

/** Hash every field owned by the core-measurement seed for one persisted row. */
export function hashCoreMeasurementRevisionContent(
  stored: StoredCoreMeasurementRevisionContent,
): string {
  return sha256(persistedSeedContent(stored));
}

/**
 * Compare all seed-owned immutable content, including the required draft
 * lifecycle state. Reviewer identities, timestamps, and other non-seed
 * persistence metadata are intentionally outside this comparison.
 */
export function compareCoreMeasurementRevisionContent(
  record: CoreMeasurementSeedRecord,
  stored: StoredCoreMeasurementRevisionContent,
): CoreMeasurementRevisionContentComparison {
  const expected = expectedCoreMeasurementRevisionContent(record);
  const expectedDefinition = stableJsonStringify(record.definition);
  const actualDefinition = stableJsonStringify(stored.definition);
  const expectedSources = stableJsonStringify(record.definition.sources);
  const actualSources = stableJsonStringify(stored.sources);
  const expectedProvenance = stableJsonStringify(record.provenance);
  const actualProvenance = stableJsonStringify(stored.migrationProvenance);
  const expectedDefinitionHash = expected.definitionHash;
  const expectedSeedContentHash = hashCoreMeasurementRevisionContent(expected);
  const actualSeedContentHash = hashCoreMeasurementRevisionContent(stored);

  const mismatch =
    stored.key !== expected.key
      ? ('key-field' as const)
      : stored.revision !== expected.revision
        ? ('revision-field' as const)
        : stored.status !== expected.status
          ? ('status-field' as const)
          : stored.displayName !== expected.displayName
            ? ('display-name-field' as const)
            : stored.kind !== expected.kind
              ? ('kind-field' as const)
              : stored.canonicalUnit !== expected.canonicalUnit
                ? ('canonical-unit-field' as const)
                : stored.definitionHash !== expectedDefinitionHash
                  ? ('definition-hash-field' as const)
                  : actualDefinition !== expectedDefinition
                    ? ('definition-content' as const)
                    : actualSources !== expectedSources
                      ? ('sources-content' as const)
                      : actualProvenance !== expectedProvenance
                        ? ('migration-provenance-content' as const)
                        : ('none' as const);

  return {
    matches: mismatch === 'none' && actualSeedContentHash === expectedSeedContentHash,
    expectedDefinitionHash,
    expectedSeedContentHash,
    actualSeedContentHash,
    mismatch,
  };
}
