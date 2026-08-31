export {
  assertBackfillWithinRetention,
  assertCompletedBackfillRange,
  configuredAnalyticsSourceRetention,
  runAnalyticsRollupCli,
} from '../apps/server/src/ops/analytics-rollup-cli';

import { runAnalyticsRollupCli } from '../apps/server/src/ops/analytics-rollup-cli';

if (require.main === module) {
  void runAnalyticsRollupCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Analytics rollup failed.');
    process.exitCode = 1;
  });
}
