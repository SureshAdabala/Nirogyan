import {
  CORE_MEASUREMENT_SEED_PATH,
  generateCoreMeasurementSeed,
  validateCheckedCoreMeasurementSeed,
  writeCoreMeasurementSeed,
} from './core-measurement-seed-files';

const seed = generateCoreMeasurementSeed();
writeCoreMeasurementSeed(seed);
const report = validateCheckedCoreMeasurementSeed(seed);

console.log(
  JSON.stringify(
    {
      status: report.valid ? 'ok' : 'failed',
      action: 'generated',
      path: CORE_MEASUREMENT_SEED_PATH,
      ...report.integrity.counts,
      structuralErrors: report.structuralErrors.length,
      deterministic: report.deterministic,
    },
    null,
    2,
  ),
);

if (!report.valid) process.exitCode = 1;
