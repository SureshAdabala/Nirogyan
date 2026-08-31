import { deserialize, serialize } from 'bson';
import { describe, expect, it } from 'vitest';

import { MeasurementRevisionModel } from '../apps/server/src/persistence/models/measurement-revision';
import { generateCoreMeasurementSeed } from './core-measurement-seed-files';
import {
  compareCoreMeasurementRevisionContent,
  expectedCoreMeasurementRevisionContent,
  type CoreMeasurementSeedContentMismatch,
} from './core-measurement-seed-persistence';

function storedFromFirstRecord(): {
  record: ReturnType<typeof generateCoreMeasurementSeed>['records'][number];
  stored: {
    key: string;
    revision: number;
    status: string;
    displayName: string;
    kind: string;
    canonicalUnit?: string;
    definitionHash: string;
    definition: unknown;
    sources: unknown;
    migrationProvenance: unknown;
  };
} {
  const record = generateCoreMeasurementSeed().records[0];
  if (!record) throw new Error('Expected a core measurement seed record.');
  const expected = expectedCoreMeasurementRevisionContent(record);
  return {
    record,
    stored: {
      ...expected,
      definition: structuredClone(record.definition),
      sources: structuredClone(record.definition.sources),
      migrationProvenance: structuredClone(record.provenance),
    },
  };
}

describe('P6 seed persistence content comparison', () => {
  it('accepts only an exact seed-owned content match', () => {
    const { record, stored } = storedFromFirstRecord();
    expect(compareCoreMeasurementRevisionContent(record, stored)).toMatchObject({
      matches: true,
      mismatch: 'none',
    });
  });

  it('rejects changed persisted definitions even when the hash field is forged to match', () => {
    const { record, stored } = storedFromFirstRecord();
    const changed = structuredClone(stored) as typeof stored & {
      definition: { displayName?: string };
    };
    changed.definition.displayName = 'Changed persisted display name';

    expect(compareCoreMeasurementRevisionContent(record, changed)).toMatchObject({
      matches: false,
      mismatch: 'definition-content',
    });
  });

  it.each<{
    field: 'key' | 'revision' | 'status' | 'displayName' | 'kind' | 'canonicalUnit';
    value: string | number;
    mismatch: CoreMeasurementSeedContentMismatch;
  }>([
    { field: 'key', value: 'different-key', mismatch: 'key-field' },
    { field: 'revision', value: 99, mismatch: 'revision-field' },
    { field: 'status', value: 'verified', mismatch: 'status-field' },
    {
      field: 'displayName',
      value: 'Different display name',
      mismatch: 'display-name-field',
    },
    { field: 'kind', value: 'demographic', mismatch: 'kind-field' },
    { field: 'canonicalUnit', value: 'different-unit', mismatch: 'canonical-unit-field' },
  ])('rejects $field drift', ({ field, value, mismatch }) => {
    const { record, stored } = storedFromFirstRecord();
    Object.assign(stored, { [field]: value });
    expect(compareCoreMeasurementRevisionContent(record, stored)).toMatchObject({
      matches: false,
      mismatch,
    });
  });

  it('rejects definition-hash field drift', () => {
    const { record, stored } = storedFromFirstRecord();
    stored.definitionHash = '0'.repeat(64);
    expect(compareCoreMeasurementRevisionContent(record, stored)).toMatchObject({
      matches: false,
      mismatch: 'definition-hash-field',
    });
  });

  it('rejects source or migration-provenance drift independently of definitionHash', () => {
    const sourceDrift = storedFromFirstRecord();
    sourceDrift.stored.sources = [];
    expect(
      compareCoreMeasurementRevisionContent(sourceDrift.record, sourceDrift.stored),
    ).toMatchObject({ matches: false, mismatch: 'sources-content' });

    const provenanceDrift = storedFromFirstRecord();
    provenanceDrift.stored.migrationProvenance = { altered: true };
    expect(
      compareCoreMeasurementRevisionContent(provenanceDrift.record, provenanceDrift.stored),
    ).toMatchObject({ matches: false, mismatch: 'migration-provenance-content' });
  });

  it('round-trips provenance empty objects through Mongoose and BSON without content loss', () => {
    const record = generateCoreMeasurementSeed().records.find(
      (candidate) => candidate.definition.key === 'eag',
    );
    if (!record) throw new Error('Expected the eAG core measurement seed record.');
    const expected = compareCoreMeasurementRevisionContent(record, {
      ...expectedCoreMeasurementRevisionContent(record),
      definitionHash: '',
    });
    const document = new MeasurementRevisionModel({
      key: record.definition.key,
      revision: record.definition.version,
      status: 'draft',
      displayName: record.definition.displayName,
      kind: 'derived',
      canonicalUnit: record.definition.canonicalUnit.code,
      definition: record.definition,
      definitionHash: expected.expectedDefinitionHash,
      sources: record.definition.sources,
      migrationProvenance: record.provenance,
    });

    expect(MeasurementRevisionModel.schema.get('minimize')).toBe(false);
    const mongooseSerialized = document.toObject();
    const roundTripped = deserialize(serialize(mongooseSerialized)) as Record<string, unknown>;
    const provenance = roundTripped.migrationProvenance as {
      legacyRecord: { validation?: Record<string, never> };
    };
    expect(provenance.legacyRecord.validation).toEqual({});
    expect(
      compareCoreMeasurementRevisionContent(record, {
        key: roundTripped.key as string,
        revision: roundTripped.revision as number,
        status: roundTripped.status as string,
        displayName: roundTripped.displayName as string,
        kind: roundTripped.kind as string,
        canonicalUnit: roundTripped.canonicalUnit as string,
        definitionHash: roundTripped.definitionHash as string,
        definition: roundTripped.definition,
        sources: roundTripped.sources,
        migrationProvenance: roundTripped.migrationProvenance,
      }),
    ).toMatchObject({ matches: true, mismatch: 'none' });
  });

  it('detects loss of a meaningful empty object in persisted provenance', () => {
    const record = generateCoreMeasurementSeed().records.find(
      (candidate) => candidate.definition.key === 'eag',
    );
    if (!record) throw new Error('Expected the eAG core measurement seed record.');
    const alteredProvenance = structuredClone(record.provenance) as typeof record.provenance & {
      legacyRecord: { validation?: Record<string, never> };
    };
    delete alteredProvenance.legacyRecord.validation;
    const expected = compareCoreMeasurementRevisionContent(record, {
      ...expectedCoreMeasurementRevisionContent(record),
      definitionHash: '',
    });

    expect(
      compareCoreMeasurementRevisionContent(record, {
        ...expectedCoreMeasurementRevisionContent(record),
        definitionHash: expected.expectedDefinitionHash,
        migrationProvenance: alteredProvenance,
      }),
    ).toMatchObject({ matches: false, mismatch: 'migration-provenance-content' });
  });
});
