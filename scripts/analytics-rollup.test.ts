import { describe, expect, it } from 'vitest';

import {
  assertBackfillWithinRetention,
  assertCompletedBackfillRange,
  configuredAnalyticsSourceRetention,
} from './analytics-rollup';
import { analyticsPartialBucket } from '../apps/server/src/analytics/scheduler';

describe('analytics historical backfill safety', () => {
  it('refuses to overwrite forever-retained daily rows after source events expired', () => {
    expect(
      assertBackfillWithinRetention({
        from: '2026-08-20',
        today: '2026-08-28',
        retentionDays: 10,
      }),
    ).toBe('2026-08-19');
    expect(() =>
      assertBackfillWithinRetention({
        from: '2026-08-18',
        today: '2026-08-28',
        retentionDays: 10,
      }),
    ).toThrow(/will not be overwritten/);
  });

  it('accepts completed days only and rejects today/future empty rollups', () => {
    expect(() =>
      assertCompletedBackfillRange({
        from: '2026-08-20',
        to: '2026-08-27',
        today: '2026-08-28',
      }),
    ).not.toThrow();
    expect(() =>
      assertCompletedBackfillRange({
        from: '2026-08-20',
        to: '2026-08-28',
        today: '2026-08-28',
      }),
    ).toThrow(/completed reporting days only/);
  });

  it('fails closed when any TTL-bound product source retention is unknown', () => {
    const base = {
      analyticsEventsRetentionDays: 180,
      assessmentRetentionDays: 90,
      leadRetentionDays: 365,
      analyticsVisitorPersistenceEnabled: false,
      analyticsVisitorRetentionDays: undefined,
    };
    expect(configuredAnalyticsSourceRetention(base)).toEqual({
      events: 180,
      assessments: 90,
      leads: 365,
    });
    expect(
      configuredAnalyticsSourceRetention({ ...base, analyticsVisitorRetentionDays: 90 }),
    ).toEqual({ events: 180, assessments: 90, leads: 365, visitors: 90 });
    expect(() =>
      configuredAnalyticsSourceRetention({ ...base, assessmentRetentionDays: undefined }),
    ).toThrow(/ASSESSMENT_RETENTION_DAYS/);
    expect(() =>
      configuredAnalyticsSourceRetention({ ...base, leadRetentionDays: undefined }),
    ).toThrow(/LEAD_RETENTION_DAYS/);
  });

  it('uses repeatable five-minute identities for schedulable current-day partials', () => {
    expect(analyticsPartialBucket(new Date('2026-08-28T10:04:59.999Z'))).toEqual(
      new Date('2026-08-28T10:00:00.000Z'),
    );
    expect(analyticsPartialBucket(new Date('2026-08-28T10:05:00.000Z'))).toEqual(
      new Date('2026-08-28T10:05:00.000Z'),
    );
    expect(() => analyticsPartialBucket(new Date(), 0)).toThrow(/1 to 60/);
  });
});
