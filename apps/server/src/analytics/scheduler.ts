import { reportingDayBounds } from './time';
import { runLeasedJob, withAnalyticsMaterializationLease } from './jobs';
import { rollupAnalyticsDay, type AnalyticsSourceRetentionDays } from './rollup';

const ANALYTICS_ROLLUP_SCHEMA_VERSION = 'v1';

export function analyticsPartialBucket(now: Date, intervalMinutes = 5): Date {
  if (!Number.isSafeInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 60) {
    throw new Error('Analytics partial interval must be an integer from 1 to 60 minutes.');
  }
  const intervalMs = intervalMinutes * 60_000;
  return new Date(Math.floor(now.getTime() / intervalMs) * intervalMs);
}

export function analyticsRollupJobIdentity(options: {
  readonly job: string;
  readonly timezone: string;
  readonly visitorPersistenceEnabled: boolean;
  readonly identityKeyVersion?: string;
  readonly minimumCohortSize?: number;
  readonly sourceRetentionDays: AnalyticsSourceRetentionDays;
  readonly runRevision?: string;
}): string {
  const keyVersion = options.identityKeyVersion ?? 'v1';
  const basis = options.visitorPersistenceEnabled ? 'visitor' : 'session';
  return [
    options.job,
    `schema-${ANALYTICS_ROLLUP_SCHEMA_VERSION}`,
    `timezone-${options.timezone}`,
    `basis-${basis}`,
    `key-${keyVersion}`,
    `cohort-${options.minimumCohortSize ?? 5}`,
    `retention-events-${options.sourceRetentionDays.events}`,
    `retention-assessments-${options.sourceRetentionDays.assessments}`,
    `retention-leads-${options.sourceRetentionDays.leads}`,
    ...(options.sourceRetentionDays.visitors === undefined
      ? []
      : [`retention-visitors-${options.sourceRetentionDays.visitors}`]),
    ...(options.runRevision ? [`revision-${options.runRevision}`] : []),
  ].join('|');
}

export async function runAnalyticsRollupWithLease(options: {
  readonly day: string;
  readonly timezone: string;
  readonly visitorPersistenceEnabled: boolean;
  readonly identityKeyVersion?: string;
  readonly minimumCohortSize?: number;
  readonly sourceRetentionDays: AnalyticsSourceRetentionDays;
  readonly runRevision?: string;
  readonly job?: string;
  readonly scheduledFor?: Date;
  readonly leaseSeconds?: number;
  readonly owner?: string;
}): Promise<
  | { readonly status: 'skipped' }
  | {
      readonly status: 'succeeded';
      readonly metadata: {
        readonly day: string;
        readonly timezone: string;
        readonly documents: number;
        readonly sourceEvents: number;
      };
    }
> {
  const scheduledFor =
    options.scheduledFor ?? reportingDayBounds(options.day, options.timezone).start;
  return runLeasedJob({
    job: analyticsRollupJobIdentity({
      job: options.job ?? 'analytics.daily.rollup',
      timezone: options.timezone,
      visitorPersistenceEnabled: options.visitorPersistenceEnabled,
      identityKeyVersion: options.identityKeyVersion,
      minimumCohortSize: options.minimumCohortSize,
      sourceRetentionDays: options.sourceRetentionDays,
      runRevision: options.runRevision,
    }),
    scheduledFor,
    leaseSeconds: options.leaseSeconds,
    owner: options.owner,
    work: async (lease) => {
      const result = await withAnalyticsMaterializationLease({
        key: `analytics-day:${options.timezone}:${options.day}`,
        owner: `${lease.owner}:${lease.runId}`,
        leaseSeconds: options.leaseSeconds,
        work: (dayLease) =>
          rollupAnalyticsDay({
            day: options.day,
            timezone: options.timezone,
            visitorPersistenceEnabled: options.visitorPersistenceEnabled,
            identityKeyVersion: options.identityKeyVersion,
            minimumCohortSize: options.minimumCohortSize,
            sourceRetentionDays: options.sourceRetentionDays,
            heartbeat: async () => {
              await lease.heartbeat();
              await dayLease.heartbeat();
            },
          }),
      });
      return { day: options.day, timezone: options.timezone, ...result };
    },
  });
}
