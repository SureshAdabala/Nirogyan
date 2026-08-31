import { randomUUID } from 'node:crypto';

import { analyticsPartialBucket, runAnalyticsRollupWithLease } from '../analytics/scheduler';
import {
  addReportingDays,
  enumerateReportingDays,
  reportingDay,
  reportingDayBounds,
} from '../analytics/time';
import type { AnalyticsSourceRetentionDays } from '../analytics/rollup';
import { loadEnvironment, loadProjectEnvironment, type AppEnvironment } from '../config/env';
import { assertProductionJobEnvironment } from '../config/production';
import { connectDatabase, disconnectDatabase } from '../db/connection';

interface CliOptions {
  readonly allowWrite: boolean;
  readonly expectedDbName?: string;
  readonly expectedNodeEnv?: string;
  readonly from?: string;
  readonly to?: string;
  readonly revision?: string;
  readonly currentDayPartial: boolean;
}

export function assertBackfillWithinRetention(options: {
  readonly from: string;
  readonly today: string;
  readonly retentionDays: number;
}): string {
  const earliestRetainedDay = addReportingDays(options.today, -(options.retentionDays - 1));
  if (options.from < earliestRetainedDay) {
    throw new Error(
      `Backfill starts before the logically retained event window (${earliestRetainedDay}); existing historical rollups will not be overwritten.`,
    );
  }
  return earliestRetainedDay;
}

export function assertCompletedBackfillRange(options: {
  readonly from: string;
  readonly to: string;
  readonly today: string;
}): void {
  enumerateReportingDays(options.from, options.to);
  if (options.to >= options.today) {
    throw new Error('Analytics backfills may include completed reporting days only.');
  }
}

export function configuredAnalyticsSourceRetention(
  environment: Pick<
    AppEnvironment,
    | 'analyticsEventsRetentionDays'
    | 'assessmentRetentionDays'
    | 'leadRetentionDays'
    | 'analyticsVisitorPersistenceEnabled'
    | 'analyticsVisitorRetentionDays'
  >,
): AnalyticsSourceRetentionDays {
  if (environment.assessmentRetentionDays === undefined) {
    throw new Error(
      'ASSESSMENT_RETENTION_DAYS must be configured before permanent analytics rollups can be replaced.',
    );
  }
  if (environment.leadRetentionDays === undefined) {
    throw new Error(
      'LEAD_RETENTION_DAYS must be configured before permanent analytics rollups can be replaced.',
    );
  }
  if (
    environment.analyticsVisitorPersistenceEnabled &&
    environment.analyticsVisitorRetentionDays === undefined
  ) {
    throw new Error(
      'ANALYTICS_VISITOR_RETENTION_DAYS must be configured while visitor persistence is enabled.',
    );
  }
  return {
    events: environment.analyticsEventsRetentionDays,
    assessments: environment.assessmentRetentionDays,
    leads: environment.leadRetentionDays,
    ...(environment.analyticsVisitorRetentionDays === undefined
      ? {}
      : { visitors: environment.analyticsVisitorRetentionDays }),
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  const value = (prefix: string) =>
    argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const known = argv.every(
    (argument) =>
      argument === '--allow-analytics-write' ||
      argument === '--current-day-partial' ||
      ['--expected-db-name=', '--expected-node-env=', '--from=', '--to=', '--revision='].some(
        (prefix) => argument.startsWith(prefix),
      ),
  );
  if (!known) throw new Error('Unsupported analytics rollup argument.');
  return {
    allowWrite: argv.includes('--allow-analytics-write'),
    expectedDbName: value('--expected-db-name='),
    expectedNodeEnv: value('--expected-node-env='),
    from: value('--from='),
    to: value('--to='),
    revision: value('--revision='),
    currentDayPartial: argv.includes('--current-day-partial'),
  };
}

export async function runAnalyticsRollupCli(argv = process.argv.slice(2)): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (environment.nodeEnv === 'production') {
    assertProductionJobEnvironment(process.env, environment, 'analytics');
  }
  const cli = parseArgs(argv);
  if (!cli.allowWrite) throw new Error('Pass --allow-analytics-write to authorize rollup upserts.');
  if (!cli.expectedDbName || cli.expectedDbName !== environment.mongoDbName) {
    throw new Error('--expected-db-name must exactly match MONGODB_DB_NAME.');
  }
  if (!cli.expectedNodeEnv || cli.expectedNodeEnv !== environment.nodeEnv) {
    throw new Error('--expected-node-env must exactly match NODE_ENV.');
  }
  if (!environment.mongoUri) throw new Error('MONGODB_URI is required for analytics rollup.');
  if ((cli.from && !cli.to) || (!cli.from && cli.to)) {
    throw new Error('--from and --to must be supplied together.');
  }
  if (cli.currentDayPartial && (cli.from || cli.to)) {
    throw new Error('--current-day-partial cannot be combined with --from/--to.');
  }
  await connectDatabase({ environment });
  try {
    const today = reportingDay(new Date(), environment.analyticsReportingTimezone);
    const sourceRetentionDays = configuredAnalyticsSourceRetention(environment);
    if (cli.from) {
      if (!cli.to) throw new Error('--from and --to must be supplied together.');
      assertCompletedBackfillRange({ from: cli.from, to: cli.to, today });
      const shortestSourceRetentionDays = Math.min(
        sourceRetentionDays.events,
        sourceRetentionDays.assessments,
        sourceRetentionDays.leads,
        ...(sourceRetentionDays.visitors === undefined ? [] : [sourceRetentionDays.visitors]),
      );
      assertBackfillWithinRetention({
        from: cli.from,
        today,
        retentionDays: shortestSourceRetentionDays,
      });
    }
    const invocationNow = new Date();
    const invocation = reportingDayBounds(today, environment.analyticsReportingTimezone).start;
    const work = cli.currentDayPartial
      ? [
          {
            day: today,
            job: 'analytics.daily.partial',
            scheduledFor: analyticsPartialBucket(invocationNow),
          },
        ]
      : cli.from && cli.to
        ? enumerateReportingDays(cli.from, cli.to).map((day) => ({
            day,
            job: 'analytics.daily.backfill',
            scheduledFor: reportingDayBounds(day, environment.analyticsReportingTimezone).start,
          }))
        : [
            {
              day: addReportingDays(today, -1),
              job: 'analytics.daily.rollup',
              scheduledFor: reportingDayBounds(
                addReportingDays(today, -1),
                environment.analyticsReportingTimezone,
              ).start,
            },
            {
              day: addReportingDays(today, -2),
              job: 'analytics.daily.reconcile',
              scheduledFor: invocation,
            },
          ];
    const owner = `analytics-cli:${randomUUID()}`;
    const outcomes = [];
    for (const item of work) {
      outcomes.push({
        day: item.day,
        ...(await runAnalyticsRollupWithLease({
          ...item,
          timezone: environment.analyticsReportingTimezone,
          visitorPersistenceEnabled: environment.analyticsVisitorPersistenceEnabled,
          identityKeyVersion: environment.analyticsIdentityKeyVersion,
          minimumCohortSize: environment.analyticsMinimumCohortSize,
          sourceRetentionDays,
          runRevision: cli.revision,
          leaseSeconds: environment.analyticsJobLeaseSeconds,
          owner,
        })),
      });
    }
    console.log(
      JSON.stringify({
        status: 'ok',
        database: environment.mongoDbName,
        timezone: environment.analyticsReportingTimezone,
        outcomes,
      }),
    );
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  void runAnalyticsRollupCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Analytics rollup failed.');
    process.exitCode = 1;
  });
}
