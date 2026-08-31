import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { validateCalculatorVersion } from '../packages/contracts/src/index';

const root = join(process.cwd(), 'data', 'fixtures', 'config-samples');
const files = readdirSync(root)
  .filter((file) => file.endsWith('.config.json'))
  .sort();
const expectedDiagnostics: Readonly<
  Record<
    string,
    {
      readonly structural: boolean;
      readonly semantic: boolean;
      readonly clinical: boolean;
      readonly publish: boolean;
      readonly errors: number;
      readonly warnings: number;
    }
  >
> = {
  'covid-risk.config.json': {
    structural: true,
    semantic: false,
    clinical: false,
    publish: false,
    errors: 21,
    warnings: 0,
  },
  'diabetes-risk.config.json': {
    structural: true,
    semantic: false,
    clinical: false,
    publish: false,
    errors: 16,
    warnings: 0,
  },
  'heart-risk.config.json': {
    structural: true,
    semantic: false,
    clinical: false,
    publish: false,
    errors: 16,
    warnings: 0,
  },
  'hypothyroid-risk.config.json': {
    structural: true,
    semantic: false,
    clinical: false,
    publish: false,
    errors: 19,
    warnings: 0,
  },
  'niro-cws.config.json': {
    structural: true,
    semantic: false,
    clinical: false,
    publish: false,
    errors: 33,
    warnings: 0,
  },
};
const report = files.map((file) => {
  const config = JSON.parse(readFileSync(join(root, file), 'utf8')) as Record<string, unknown>;
  const result = validateCalculatorVersion(config, file);
  return {
    file,
    structural: result.structural.passed,
    semantic: result.semantic.passed,
    clinical: result.clinical.passed,
    publish: result.publish.passed,
    errors: result.errorCount,
    warnings: result.warningCount,
  };
});

console.log(JSON.stringify({ count: report.length, report }, null, 2));
const diagnosticDrift = report.some((item) => {
  const expected = expectedDiagnostics[item.file];
  return (
    !expected ||
    item.structural !== expected.structural ||
    item.semantic !== expected.semantic ||
    item.clinical !== expected.clinical ||
    item.publish !== expected.publish ||
    item.errors !== expected.errors ||
    item.warnings !== expected.warnings
  );
});
if (
  report.length !== Object.keys(expectedDiagnostics).length ||
  files.some((file) => !(file in expectedDiagnostics)) ||
  diagnosticDrift
) {
  console.error('Immutable fixture validation diagnostics drifted from the reviewed P8 baseline.');
  process.exitCode = 1;
}
