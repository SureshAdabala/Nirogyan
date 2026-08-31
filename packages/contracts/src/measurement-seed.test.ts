import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';

import {
  CORE_MEASUREMENT_SOURCE_PATH,
  CORE_SCORING_CONFIG_PATH,
  CORE_SCORING_RESEARCH_PATH,
  migrateCoreMeasurementSeed,
  stableJsonStringify,
  validateCoreMeasurementSeed,
  type CoreMeasurementConfigInput,
  type CoreMeasurementSeed,
  type JsonObject,
} from './measurement-seed';

const projectRoot = resolve(__dirname, '..', '..', '..');

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(join(projectRoot, path), 'utf8')) as JsonObject;
}

function sourceInputs(): {
  legacy: JsonObject;
  configs: CoreMeasurementConfigInput[];
  hash: string;
} {
  const sourceBytes = readFileSync(join(projectRoot, CORE_MEASUREMENT_SOURCE_PATH));
  const fixtureDirectory = join(projectRoot, 'data', 'fixtures', 'config-samples');
  const configFiles = readdirSync(fixtureDirectory)
    .filter((file) => file.endsWith('.config.json'))
    .sort();
  return {
    legacy: JSON.parse(sourceBytes.toString('utf8')) as JsonObject,
    configs: configFiles.map((file) => ({
      path: `data/fixtures/config-samples/${file}`,
      value: JSON.parse(readFileSync(join(fixtureDirectory, file), 'utf8')) as JsonObject,
    })),
    hash: createHash('sha256').update(sourceBytes).digest('hex'),
  };
}

function makeSeed(): {
  seed: CoreMeasurementSeed;
  legacy: JsonObject;
  configs: CoreMeasurementConfigInput[];
} {
  const { legacy, configs, hash } = sourceInputs();
  return { seed: migrateCoreMeasurementSeed(legacy, configs, hash), legacy, configs };
}

describe('P6 core measurement seed migration', () => {
  it('deterministically migrates exactly the reviewed 40-record core scope', () => {
    const first = makeSeed();
    const second = makeSeed();

    expect(stableJsonStringify(first.seed)).toBe(stableJsonStringify(second.seed));
    expect(first.seed.records).toHaveLength(40);
    expect(first.seed.records.map((record) => record.definition.key)).toEqual(
      [...first.seed.records.map((record) => record.definition.key)].sort(),
    );
    expect(first.seed.records.every((record) => record.definition.version === 3)).toBe(true);
    expect(first.seed.migrationPolicy).toMatchObject({
      recordCount: 40,
      originalSourceObjectCount: 117,
      calculatorConfigCount: 5,
      calculatorMeasurementReferenceCount: 45,
      lifecycle: 'draft-only',
      catalogExtensionImported: false,
    });
  });

  it('preserves all original source objects and stale scoring metadata while correcting provenance', () => {
    const { seed, legacy } = makeSeed();
    const originalSources = seed.records.flatMap((record) => {
      const sources = record.provenance.legacyRecord.sources;
      return Array.isArray(sources) ? sources : [];
    });

    expect(originalSources).toHaveLength(117);
    expect(seed.records.every((record) => record.provenance.legacyNiroScoring !== null)).toBe(true);
    expect(seed.scoringProvenance.staleLegacyNote).toContain('NOT present');
    expect(seed.scoringProvenance.correctedSource).toMatchObject({
      path: CORE_SCORING_CONFIG_PATH,
      researchPath: CORE_SCORING_RESEARCH_PATH,
      calculatorSlug: 'niro-cws',
      calculatorVersion: 2,
    });
    expect(
      seed.records.every(
        (record) =>
          record.provenance.correctedScoringProvenance.researchPath === CORE_SCORING_RESEARCH_PATH,
      ),
    ).toBe(true);
    for (const record of seed.records) {
      expect(record.provenance.legacyRecord).toEqual(
        (legacy.biomarkers as JsonObject[])[record.provenance.legacyIndex],
      );
    }
    expect(
      seed.records.every(
        (record) =>
          record.definition.sources.length ===
          (Array.isArray(record.provenance.legacyRecord.sources)
            ? record.provenance.legacyRecord.sources.length
            : 0),
      ),
    ).toBe(true);
  });

  it('keeps every canonical record draft, unreviewed, and explicitly publish-blocked', () => {
    const { seed } = makeSeed();
    for (const record of seed.records) {
      expect(record.definition.status).toBe('draft');
      expect(record.provenance.revisionHistory).toMatchObject({
        supersededRevisions: [
          {
            revision: 1,
            disposition: 'audit-rejected-draft',
            reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1',
            issue: 'inferred-canonical-claims-and-unreviewed-unit-conversions',
          },
          {
            revision: 2,
            disposition: 'audit-rejected-draft',
            reasonCode: 'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2',
            issue: 'empty-object-persistence-loss',
          },
        ],
      });
      expect(record.definition.governance).toMatchObject({
        reviewStatus: 'unreviewed',
        reviewedAt: null,
        reviewerId: null,
      });
      expect(record.definition.governance.publishBlockers).toEqual(
        expect.arrayContaining([
          'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V1',
          'P6-SUPERSEDES-AUDIT-REJECTED-DRAFT-V2',
          'P6-PER-VALUE-SOURCE-MAPPING-REQUIRED',
          'P6-UNIT-CONVERSION-REVIEW-REQUIRED',
          'P6-RANGE-INCLUSIVITY-REVIEW-REQUIRED',
          'P6-INPUT-BOUND-HARD-SOFT-REVIEW-REQUIRED',
          'P6-REFERENCE-RANGE-STRUCTURING-REQUIRED',
          'P6-MEDICAL-REVIEW-REQUIRED',
        ]),
      );
      expect(record.definition.referenceRanges).toEqual([]);
    }
  });

  it('does not promote unresolved alternate units or infer canonical per-value claims', () => {
    const { seed } = makeSeed();
    let preservedLegacyConversionCount = 0;
    for (const record of seed.records) {
      expect(record.definition.acceptedUnits).toEqual([record.definition.canonicalUnit]);
      expect(record.definition).not.toHaveProperty('conversions');
      expect(record.definition.sources.every((source) => source.claimIds === undefined)).toBe(true);
      const legacyUnit = record.provenance.legacyRecord.unit;
      if (legacyUnit && !Array.isArray(legacyUnit) && typeof legacyUnit === 'object') {
        preservedLegacyConversionCount += Array.isArray(legacyUnit.conversions)
          ? legacyUnit.conversions.length
          : 0;
      }
      if (record.definition.derived) {
        expect(record.definition.derived).not.toHaveProperty('sourceClaimIds');
      }
      for (const tag of record.provenance.valueTags) {
        expect(tag.mappingStatus).toBe('unresolved-per-value-authority');
        expect(tag.candidateSourceIds.length).toBeGreaterThan(0);
      }
    }
    expect(preservedLegacyConversionCount).toBe(29);
  });

  it('passes the canonical JSON Schema structurally for all 40 definitions', () => {
    const { seed } = makeSeed();
    const schema = readJson('packages/contracts/schemas/measurement-definition.v1.schema.json');
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const validate = ajv.compile(schema);

    for (const record of seed.records) {
      expect(validate(record.definition), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('passes preservation, reference, tag, unit, inversion, claim, NFC, and DAG integrity', () => {
    const { seed, legacy, configs } = makeSeed();
    const result = validateCoreMeasurementSeed(seed, legacy, configs);

    expect(result).toMatchObject({
      valid: true,
      counts: {
        records: 40,
        originalSources: 117,
        configReferences: 45,
      },
    });
    expect(result.counts).toEqual({
      records: 40,
      originalSources: 117,
      configReferences: 45,
      valueTags: 565,
      rawConversions: 29,
      canonicalConversions: 0,
      canonicalClaimLinks: 0,
    });
    expect(result.findings).toEqual([]);
  });

  it('detects scope, value-tag, claim, conversion, and derivation corruption', () => {
    const { seed, legacy, configs } = makeSeed();
    const corrupted = structuredClone(seed) as CoreMeasurementSeed;
    const mutable = corrupted as unknown as {
      records: Array<{
        definition: {
          key: string;
          canonicalUnit: { code: string };
          conversions?: Array<{
            kind: 'affine';
            fromUnit: string;
            toUnit: string;
            factor: number;
            offset: number;
            sourceClaimIds?: string[];
          }>;
          derived?: { dependsOn: string[] };
        };
        provenance: {
          legacyRecord: {
            unit?: { conversions?: Array<{ code?: string; toCanonical?: number }> };
          };
          valueTags: Array<{ candidateSourceIds: string[] }>;
        };
      }>;
    };
    mutable.records.pop();
    const converted = mutable.records.find(
      (record) => (record.provenance.legacyRecord.unit?.conversions?.length ?? 0) > 0,
    );
    const legacyConversion = converted?.provenance.legacyRecord.unit?.conversions?.[0];
    if (!converted || !legacyConversion) throw new Error('Expected a legacy conversion fixture.');
    legacyConversion.toCanonical = 0;
    converted.definition.conversions = [
      {
        kind: 'affine',
        fromUnit: legacyConversion.code ?? 'unreviewed-unit',
        toUnit: converted.definition.canonicalUnit.code,
        factor: 1,
        offset: 0,
        sourceClaimIds: ['missing-claim'],
      },
    ];
    const tagged = mutable.records.find((record) => record.provenance.valueTags.length > 0);
    if (!tagged?.provenance.valueTags[0]) throw new Error('Expected a value-tag fixture.');
    tagged.provenance.valueTags[0].candidateSourceIds = ['missing-source'];
    const eag = mutable.records.find((record) => record.definition.key === 'eag');
    if (!eag?.definition.derived) throw new Error('Expected the eAG fixture.');
    eag.definition.derived.dependsOn = ['eag'];

    const codes = new Set(
      validateCoreMeasurementSeed(corrupted, legacy, configs).findings.map(
        (finding) => finding.code,
      ),
    );
    expect(codes.has('SEED_RECORD_COUNT')).toBe(true);
    expect(codes.has('SEED_QUARANTINE_SCOPE')).toBe(true);
    expect(codes.has('SEED_VALUE_TAG_SOURCE')).toBe(true);
    expect(codes.has('SEED_LEGACY_CONVERSION_FINITE')).toBe(true);
    expect(codes.has('SEED_LEGACY_RECORD_PRESERVATION')).toBe(true);
    expect(codes.has('SEED_UNREVIEWED_CANONICAL_CONVERSION')).toBe(true);
    expect(codes.has('SEED_CLAIM_RESOLUTION')).toBe(true);
    expect(codes.has('SEED_INFERRED_CLAIM_ATTRIBUTION')).toBe(true);
    expect(codes.has('SEED_DERIVATION_CYCLE')).toBe(true);
  });
});
