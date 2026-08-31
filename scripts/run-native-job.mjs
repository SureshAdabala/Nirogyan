import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jobName = process.argv[2];

if (
  process.argv.length !== 3 ||
  !['analytics-partial', 'analytics-final', 'cache'].includes(jobName)
) {
  throw new Error(
    'Usage: node scripts/run-native-job.mjs <analytics-partial|analytics-final|cache>',
  );
}

const analyticsEntry = resolve(workspaceRoot, 'apps/server/dist/ops/analytics-rollup-cli.js');
const cacheEntry = resolve(workspaceRoot, 'apps/server/dist/ops/cache-invalidation-cli.js');
const entry = jobName === 'cache' ? cacheEntry : analyticsEntry;
if (!existsSync(entry)) {
  throw new Error(`Compiled native job entry point is missing: ${entry}`);
}

const argumentsForJob = [];
if (jobName !== 'cache') {
  const expectedDatabase = process.env.MONGODB_DB_NAME?.trim();
  const expectedNodeEnvironment = process.env.NODE_ENV?.trim();
  if (!expectedDatabase || !expectedNodeEnvironment) {
    throw new Error('MONGODB_DB_NAME and NODE_ENV are required for a native analytics job.');
  }
  argumentsForJob.push(
    '--allow-analytics-write',
    `--expected-db-name=${expectedDatabase}`,
    `--expected-node-env=${expectedNodeEnvironment}`,
  );
  if (jobName === 'analytics-partial') argumentsForJob.push('--current-day-partial');
}

const result = spawnSync(process.execPath, [entry, ...argumentsForJob], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`Native job terminated by signal ${result.signal}.`);
process.exitCode = result.status ?? 1;
