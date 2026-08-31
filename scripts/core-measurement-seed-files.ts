import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  CORE_MEASUREMENT_SOURCE_PATH,
  CORE_SCORING_RESEARCH_PATH,
  migrateCoreMeasurementSeed,
  stableJsonStringify,
  validateCoreMeasurementSeed,
  validateMeasurementDefinitionStructure,
  type CoreMeasurementConfigInput,
  type CoreMeasurementSeed,
  type JsonObject,
} from '../packages/contracts/src/index';

export const PROJECT_ROOT = resolve(__dirname, '..');
export const CORE_MEASUREMENT_SEED_PATH = join(
  PROJECT_ROOT,
  'data',
  'seeds',
  'core-measurements.v1.seed.json',
);

interface LoadedSeedInputs {
  readonly legacy: JsonObject;
  readonly configs: readonly CoreMeasurementConfigInput[];
  readonly sourceSha256: string;
}

export interface CoreSeedValidationReport {
  readonly valid: boolean;
  readonly deterministic: boolean;
  readonly structuralErrors: readonly {
    readonly key: string;
    readonly instancePath: string;
    readonly message: string;
  }[];
  readonly integrity: ReturnType<typeof validateCoreMeasurementSeed>;
  readonly expected: CoreMeasurementSeed;
}

function parseObject(path: string): JsonObject {
  const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }
  return value as JsonObject;
}

export function loadCoreSeedInputs(): LoadedSeedInputs {
  const sourcePath = join(PROJECT_ROOT, ...CORE_MEASUREMENT_SOURCE_PATH.split('/'));
  const scoringResearchPath = join(PROJECT_ROOT, ...CORE_SCORING_RESEARCH_PATH.split('/'));
  if (!existsSync(scoringResearchPath)) {
    throw new Error(
      `Required corrected scoring research provenance is missing: ${scoringResearchPath}`,
    );
  }
  const sourceBytes = readFileSync(sourcePath);
  const fixtureDirectory = join(PROJECT_ROOT, 'data', 'fixtures', 'config-samples');
  const configFiles = readdirSync(fixtureDirectory)
    .filter((file) => file.endsWith('.config.json'))
    .sort();
  return {
    legacy: JSON.parse(sourceBytes.toString('utf8')) as JsonObject,
    configs: configFiles.map((file) => ({
      path: `data/fixtures/config-samples/${file}`,
      value: parseObject(join(fixtureDirectory, file)),
    })),
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  };
}

export function generateCoreMeasurementSeed(): CoreMeasurementSeed {
  const inputs = loadCoreSeedInputs();
  return migrateCoreMeasurementSeed(inputs.legacy, inputs.configs, inputs.sourceSha256);
}

export function readCheckedCoreMeasurementSeed(): CoreMeasurementSeed {
  if (!existsSync(CORE_MEASUREMENT_SEED_PATH)) {
    throw new Error(
      'The checked-in core measurement seed is missing. Run npm run measurements:seed:generate.',
    );
  }
  return parseObject(CORE_MEASUREMENT_SEED_PATH) as unknown as CoreMeasurementSeed;
}

export function writeCoreMeasurementSeed(seed: CoreMeasurementSeed): void {
  mkdirSync(dirname(CORE_MEASUREMENT_SEED_PATH), { recursive: true });
  writeFileSync(CORE_MEASUREMENT_SEED_PATH, stableJsonStringify(seed), 'utf8');
}

function structuralErrors(seed: CoreMeasurementSeed): CoreSeedValidationReport['structuralErrors'] {
  const errors: Array<{ key: string; instancePath: string; message: string }> = [];
  for (const record of seed.records) {
    const result = validateMeasurementDefinitionStructure(record.definition);
    for (const finding of result.findings) {
      errors.push({
        key: record.definition.key,
        instancePath: finding.instancePath,
        message: finding.message,
      });
    }
  }
  return errors;
}

export function validateCheckedCoreMeasurementSeed(
  seed = readCheckedCoreMeasurementSeed(),
): CoreSeedValidationReport {
  const inputs = loadCoreSeedInputs();
  const expected = migrateCoreMeasurementSeed(inputs.legacy, inputs.configs, inputs.sourceSha256);
  const structural = structuralErrors(seed);
  const integrity = validateCoreMeasurementSeed(seed, inputs.legacy, inputs.configs);
  const deterministic = stableJsonStringify(seed) === stableJsonStringify(expected);
  return {
    valid: structural.length === 0 && integrity.valid && deterministic,
    deterministic,
    structuralErrors: structural,
    integrity,
    expected,
  };
}
