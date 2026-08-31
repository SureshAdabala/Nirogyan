import { describe, expect, it } from 'vitest';

import { createIdentitySketch, estimateIdentitySketch, mergeIdentitySketches } from './hll';
import { addReportingDays, enumerateReportingDays, reportingDay, reportingDayBounds } from './time';
import { parseUserAgent, primaryLocale } from './ua';
import { OperationalMetrics } from './metrics';
import { createCachedCatalogSource } from '../modules/public';

describe('analytics time and privacy-safe utilities', () => {
  it('uses reporting-timezone calendar bounds without a fixed UTC assumption', () => {
    expect(reportingDay(new Date('2026-08-27T19:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-08-28');
    expect(reportingDayBounds('2026-08-28', 'Asia/Kolkata')).toEqual({
      start: new Date('2026-08-27T18:30:00.000Z'),
      end: new Date('2026-08-28T18:30:00.000Z'),
    });
    expect(addReportingDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(enumerateReportingDays('2026-08-27', '2026-08-29')).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('handles 23-hour and 25-hour DST reporting days', () => {
    const spring = reportingDayBounds('2026-03-08', 'America/New_York');
    const autumn = reportingDayBounds('2026-11-01', 'America/New_York');
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3_600_000);
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 3_600_000);
  });

  it('uses the first real instant when a timezone skips local midnight', () => {
    const santiago = reportingDayBounds('2026-09-06', 'America/Santiago');
    const havana = reportingDayBounds('2026-03-08', 'America/Havana');
    expect(santiago.start).toEqual(new Date('2026-09-06T04:00:00.000Z'));
    expect(havana.start).toEqual(new Date('2026-03-08T05:00:00.000Z'));
    expect(reportingDay(santiago.start, 'America/Santiago')).toBe('2026-09-06');
    expect(reportingDay(havana.start, 'America/Havana')).toBe('2026-03-08');
    expect(reportingDay(new Date(santiago.start.getTime() - 1), 'America/Santiago')).toBe(
      '2026-09-05',
    );
    expect(reportingDay(new Date(havana.start.getTime() - 1), 'America/Havana')).toBe('2026-03-07');
  });

  it('merges non-reversible HLL sketches for cross-day unique estimates', () => {
    const first = createIdentitySketch(['a'.repeat(64), 'b'.repeat(64)]);
    const second = createIdentitySketch(['b'.repeat(64), 'c'.repeat(64)]);
    const estimate = estimateIdentitySketch(mergeIdentitySketches([first, second]));
    expect(estimate).toBeGreaterThanOrEqual(2);
    expect(estimate).toBeLessThanOrEqual(4);
    expect(first).toHaveLength(64);
    expect(estimateIdentitySketch([...first.slice(0, 63), 66])).toBe(0);
  });

  it('uses interpolated latency percentiles and actual catalog-cache observations', async () => {
    const metrics = new OperationalMetrics();
    metrics.observeRequest('GET', '/one', 200, 10);
    metrics.observeRequest('GET', '/two', 200, 110);
    expect(metrics.snapshot().requestLatencyMs).toEqual({ p50: 60, p95: 105 });
    let loads = 0;
    const catalog = createCachedCatalogSource(
      {
        listPublished: async () => {
          loads += 1;
          return [];
        },
        getPublished: async () => undefined,
      },
      10_000,
      metrics,
    );
    await catalog.listPublished();
    await catalog.listPublished();
    expect(loads).toBe(1);
    expect(metrics.snapshot().cache).toEqual({ hits: 1, misses: 1, hitRate: 0.5 });
  });

  it('keeps request latency percentiles to the documented rolling 5000-sample window', () => {
    const metrics = new OperationalMetrics();
    for (let value = 0; value <= 5_000; value += 1) {
      metrics.observeRequest('GET', '/bounded-latency', 200, value);
    }
    expect(metrics.snapshot().requestLatencyMs).toEqual({ p50: 2500.5, p95: 4750.05 });
  });

  it('scopes security rate-limit evidence to public endpoints without route labels', () => {
    const metrics = new OperationalMetrics();
    metrics.observeRequest('POST', '/api/v1/events', 429, 2);
    metrics.observeRequest('POST', '/api/v1/admin/auth/login', 429, 2);
    expect(metrics.snapshot()).toMatchObject({
      rateLimitTrips: 2,
      publicRateLimitTrips: 1,
    });
  });

  it('coarsens UA versions, identifies bots, and bounds locale', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) Version/17.6 Mobile Safari/604.1',
      ),
    ).toMatchObject({ device: 'mobile', browser: 'Safari 17', os: 'iOS 17', isBot: false });
    expect(parseUserAgent('Googlebot/2.1').isBot).toBe(true);
    expect(primaryLocale('en-IN,en;q=0.9')).toBe('en-IN');
    expect(primaryLocale('invalid locale')).toBe('unknown');
  });
});
