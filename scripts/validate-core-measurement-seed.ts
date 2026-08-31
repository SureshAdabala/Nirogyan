import {
  CORE_MEASUREMENT_SEED_PATH,
  validateCheckedCoreMeasurementSeed,
} from './core-measurement-seed-files';

const report = validateCheckedCoreMeasurementSeed();
console.log(
  JSON.stringify(
    {
      status: report.valid ? 'ok' : 'failed',
      path: CORE_MEASUREMENT_SEED_PATH,
      deterministic: report.deterministic,
      ...report.integrity.counts,
      structuralErrors: report.structuralErrors,
      integrityFindings: report.integrity.findings,
    },
    null,
    2,
  ),
);

if (!report.valid) process.exitCode = 1;
