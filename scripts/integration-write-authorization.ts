import type { AppEnvironment } from '../apps/server/src/config/env';

export const TEMPORARY_DATABASE_WRITE_OPT_IN = '--allow-temporary-database-write';

type WriteEnvironment = Pick<AppEnvironment, 'nodeEnv'>;

/**
 * Fail closed before an integration harness opens a database connection. The
 * opt-in is deliberately per invocation so a configured Atlas URI alone never
 * authorizes writes.
 */
export function authorizeTemporaryDatabaseWrite(
  environment: WriteEnvironment,
  args: readonly string[],
  harnessName: string,
): void {
  if (environment.nodeEnv === 'production') {
    throw new Error(`${harnessName} temporary database writes are forbidden in production.`);
  }
  if (!args.includes(TEMPORARY_DATABASE_WRITE_OPT_IN)) {
    throw new Error(
      `${harnessName} requires the explicit ${TEMPORARY_DATABASE_WRITE_OPT_IN} opt-in.`,
    );
  }
}
