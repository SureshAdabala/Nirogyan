import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertAnalyticsSourceWindowComplete,
  buildAnalyticsDailyRollups,
  decodeAnalyticsDimension,
  decodeScoreBucket,
  encodeScoreBucket,
  rollupAnalyticsDay,
  scoreBucketBounds,
  summarizeAnalyticsEvents,
  upsertAnalyticsDailyRollups,
  type AnalyticsDailyRollup,
  type AnalyticsRollupEvent,
} from './rollup';
import { AnalyticsDailyModel } from '../persistence/models/analytics-daily';
import { AnalyticsEventModel } from '../persistence/models/analytics-event';
import { AnonymousVisitorModel } from '../persistence/models/anonymous-visitor';
import { AssessmentModel } from '../persistence/models/assessment';
import { CalculatorModel } from '../persistence/models/calculator';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { LeadModel } from '../persistence/models/lead';
import { ResultModel } from '../persistence/models/result';

afterEach(() => vi.restoreAllMocks());

function event(
  type: AnalyticsRollupEvent['type'],
  occurredAt: string,
  values: Partial<AnalyticsRollupEvent> = {},
): AnalyticsRollupEvent {
  return {
    type,
    occurredAt: new Date(occurredAt),
    sessionIdHash: 'a'.repeat(64),
    visitorIdHash: 'b'.repeat(64),
    calculatorSlug: 'synthetic-calculator',
    ...values,
  };
}

describe('analytics daily rollup', () => {
  it('calculates session, funnel, search, unit, and duration metrics without raw identities', () => {
    const summary = summarizeAnalyticsEvents(
      [
        event('page_view', '2026-08-28T00:00:00.000Z', {
          path: '/c/synthetic-calculator',
          referrerHost: 'search.example',
          utmSource: 'newsletter',
          utmMedium: 'email',
          utmCampaign: 'august-health',
        }),
        event('calc_start', '2026-08-28T00:00:01.000Z'),
        event('step_view', '2026-08-28T00:00:02.000Z', { step: 'labs', stepIndex: 0 }),
        event('search', '2026-08-28T00:00:03.000Z', { query: 'cholesterol', zeroResults: true }),
        event('unit_switch', '2026-08-28T00:00:04.000Z', { unit: 'mmol/L' }),
        event('unit_switch', '2026-08-28T00:00:04.500Z', { unit: 'mmol/L' }),
        event('result_view', '2026-08-28T00:00:05.000Z'),
        event('page_view', '2026-08-28T00:00:03.000Z', {
          sessionIdHash: 'c'.repeat(64),
          visitorIdHash: 'd'.repeat(64),
          path: '/',
        }),
      ],
      true,
    );
    expect(summary).toMatchObject({
      visitors: 2,
      sessions: 2,
      pageViews: 2,
      sourceEventCount: 8,
      sessionDurationTotalMs: 5_000,
      sessionDurationSamples: 2,
      funnel: { page_view: 2, calc_start: 1, result_view: 1 },
    });
    const decoded = (map: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(map).map(([key, value]) => [decodeAnalyticsDimension(key), value]),
      );
    expect(decoded(summary.breakdowns.searches ?? {})).toEqual({ cholesterol: 1 });
    expect(decoded(summary.breakdowns.zeroResultSearches ?? {})).toEqual({ cholesterol: 1 });
    expect(decoded(summary.breakdowns.units ?? {})).toEqual({ 'mmol/L': 1 });
    expect(decoded(summary.breakdowns.referrers ?? {})).toEqual({ 'search.example': 1 });
    expect(decoded(summary.breakdowns.utmSources ?? {})).toEqual({ newsletter: 1 });
    expect(decoded(summary.breakdowns.utmMediums ?? {})).toEqual({ email: 1 });
    expect(decoded(summary.breakdowns.utmCampaigns ?? {})).toEqual({ 'august-health': 1 });
    expect(Object.keys(summary.stepViews).map(decodeAnalyticsDimension)).toEqual(['000\u0000labs']);
    expect(JSON.stringify(summary)).not.toContain('visitorIdHash');
    expect(JSON.stringify(summary)).not.toContain('sessionIdHash');
  });

  it('uses deterministic replace-upserts for idempotent reconciliation', async () => {
    const bulk = vi.spyOn(AnalyticsDailyModel, 'bulkWrite').mockResolvedValue({} as never);
    const rollup = {
      day: '2026-08-28',
      timezone: 'Asia/Kolkata',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      visitors: 1,
      sessions: 1,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 0,
      results: 0,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 1,
      pageViews: 0,
      breakdowns: {},
      funnel: {},
      stepViews: {},
      scoreBuckets: {},
      categoryCounts: {},
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
      sourceEventCount: 0,
      rolledUpAt: new Date('2026-08-29T00:00:00.000Z'),
    } satisfies AnalyticsDailyRollup;
    await upsertAnalyticsDailyRollups([rollup], { sourceWindowVerified: true });
    await upsertAnalyticsDailyRollups([rollup], { sourceWindowVerified: true });
    expect(bulk).toHaveBeenCalledTimes(2);
    expect(bulk.mock.calls[0]?.[0]).toEqual([
      {
        updateOne: {
          filter: {
            day: '2026-08-28',
            timezone: 'Asia/Kolkata',
            scope: 'global',
            scopeKey: 'global',
            identityBasis: 'session',
            identityKeyVersion: 'v1',
          },
          update: { $set: rollup },
          upsert: true,
        },
      },
      {
        deleteMany: {
          filter: {
            day: '2026-08-28',
            timezone: 'Asia/Kolkata',
            identityKeyVersion: 'v1',
            $nor: [{ scope: 'global', scopeKey: 'global', identityBasis: 'session' }],
          },
        },
      },
    ]);
  });

  it('preserves permanent rollups when any TTL-bound source window is incomplete', async () => {
    const findEvents = vi.spyOn(AnalyticsEventModel, 'find');
    const bulk = vi.spyOn(AnalyticsDailyModel, 'bulkWrite');
    await expect(
      rollupAnalyticsDay({
        day: '2026-08-26',
        timezone: 'UTC',
        visitorPersistenceEnabled: false,
        sourceRetentionDays: { events: 1, assessments: 1, leads: 1 },
        now: new Date('2026-08-28T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/existing permanent rollups were preserved/);
    expect(findEvents).not.toHaveBeenCalled();
    expect(bulk).not.toHaveBeenCalled();

    await expect(
      rollupAnalyticsDay({
        day: '2026-08-28',
        timezone: 'UTC',
        visitorPersistenceEnabled: true,
        sourceRetentionDays: { events: 30, assessments: 30, leads: 30 },
        now: new Date('2026-08-28T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/visitors retention must be explicitly configured/);
    expect(bulk).not.toHaveBeenCalled();

    expect(() =>
      assertAnalyticsSourceWindowComplete({
        day: '2026-08-28',
        timezone: 'UTC',
        visitorPersistenceEnabled: false,
        visitorSourceRequired: true,
        retentionDays: { events: 30, assessments: 30, leads: 30 },
        now: new Date('2026-08-28T12:00:00.000Z'),
      }),
    ).toThrow(/visitors retention must be explicitly configured/);
  });

  it('uses exact retention instants across 25-hour and 23-hour reporting days', () => {
    expect(() =>
      assertAnalyticsSourceWindowComplete({
        day: '2026-11-01',
        timezone: 'America/New_York',
        visitorPersistenceEnabled: false,
        retentionDays: { events: 1, assessments: 1, leads: 1 },
        now: new Date('2026-11-02T04:30:00.000Z'),
      }),
    ).toThrow(/existing permanent rollups were preserved/);

    expect(() =>
      assertAnalyticsSourceWindowComplete({
        day: '2026-03-08',
        timezone: 'America/New_York',
        visitorPersistenceEnabled: false,
        retentionDays: { events: 1, assessments: 1, leads: 1 },
        now: new Date('2026-03-09T04:30:00.000Z'),
      }),
    ).not.toThrow();
  });

  it('logically excludes expired events before the asynchronous TTL monitor runs', async () => {
    let eventFilter: unknown;
    vi.spyOn(AnalyticsEventModel, 'find').mockImplementation(((filter: unknown) => {
      eventFilter = filter;
      return {
        sort: () => ({
          select: () => ({
            lean: () => ({ cursor: () => ({ async *[Symbol.asyncIterator]() {} }) }),
          }),
        }),
      };
    }) as never);
    const emptyCursor = () => ({ async *[Symbol.asyncIterator]() {} });
    vi.spyOn(AssessmentModel, 'find').mockReturnValue({
      select: () => ({ lean: () => ({ cursor: emptyCursor }) }),
    } as never);
    vi.spyOn(ResultModel, 'find').mockReturnValue({
      select: () => ({ lean: () => ({ cursor: emptyCursor }) }),
    } as never);
    vi.spyOn(LeadModel, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(CalculatorModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [] }),
    } as never);
    vi.spyOn(CalculatorVersionModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [] }),
    } as never);
    const now = new Date('2026-08-29T00:00:00.000Z');
    await buildAnalyticsDailyRollups({
      day: '2026-08-28',
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      now,
    });
    expect(eventFilter).toMatchObject({ expiresAt: { $gt: now } });
    expect(AssessmentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: { $gt: now } }),
    );
  });

  it('logically excludes expired visitor state from new/returning classification', async () => {
    const cursor = <T>(values: readonly T[]) => ({
      async *[Symbol.asyncIterator]() {
        for (const value of values) yield value;
      },
    });
    const now = new Date('2026-08-28T12:00:00.000Z');
    const visitorIdHash = 'b'.repeat(64);
    const expiredVisitorIdHash = 'd'.repeat(64);
    vi.spyOn(AnalyticsEventModel, 'find').mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: () => ({
            cursor: () =>
              cursor([
                event('page_view', '2026-08-28T10:00:00.000Z', {
                  visitorIdHash,
                  path: '/',
                  calculatorSlug: undefined,
                }),
                event('page_view', '2026-08-28T10:01:00.000Z', {
                  visitorIdHash: expiredVisitorIdHash,
                  sessionIdHash: 'e'.repeat(64),
                  path: '/',
                  calculatorSlug: undefined,
                }),
                event('page_view', '2026-08-28T10:02:00.000Z', {
                  visitorIdHash: undefined,
                  sessionIdHash: 'c'.repeat(64),
                  path: '/',
                  calculatorSlug: undefined,
                }),
              ]),
          }),
        }),
      }),
    } as never);
    const visitorFind = vi.spyOn(AnonymousVisitorModel, 'find').mockReturnValue({
      select: () => ({
        lean: async () => [
          {
            visitorIdHash,
            firstSeenAt: new Date('2026-08-27T10:00:00.000Z'),
          },
        ],
      }),
    } as never);
    const emptyCursor = () => cursor([]);
    vi.spyOn(AssessmentModel, 'find').mockReturnValue({
      select: () => ({ lean: () => ({ cursor: emptyCursor }) }),
    } as never);
    vi.spyOn(ResultModel, 'find').mockReturnValue({
      select: () => ({ lean: () => ({ cursor: emptyCursor }) }),
    } as never);
    vi.spyOn(LeadModel, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(CalculatorModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [] }),
    } as never);
    vi.spyOn(CalculatorVersionModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [] }),
    } as never);

    const rollups = await buildAnalyticsDailyRollups({
      day: '2026-08-28',
      timezone: 'UTC',
      visitorPersistenceEnabled: true,
      now,
    });

    expect(visitorFind).toHaveBeenCalledWith({
      visitorIdHash: { $in: [visitorIdHash, expiredVisitorIdHash] },
      expiresAt: { $gt: now },
    });
    const visitorRollup = rollups.find(
      (rollup) => rollup.scope === 'global' && rollup.identityBasis === 'visitor',
    );
    const sessionRollup = rollups.find(
      (rollup) => rollup.scope === 'global' && rollup.identityBasis === 'session',
    );
    expect(visitorRollup).toMatchObject({
      visitors: 2,
      sessions: 2,
      sourceEventCount: 2,
      newVisitors: 0,
      returningVisitors: 1,
    });
    expect(sessionRollup).toMatchObject({
      visitors: 1,
      sessions: 1,
      sourceEventCount: 1,
      newVisitors: 0,
      returningVisitors: 0,
    });
    expect(rollups.filter((rollup) => rollup.scope === 'global')).toHaveLength(2);
    expect(
      rollups
        .filter((rollup) => rollup.scope === 'global')
        .reduce((total, rollup) => total + rollup.sourceEventCount, 0),
    ).toBe(3);

    const afterDisable = await buildAnalyticsDailyRollups({
      day: '2026-08-28',
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      now,
    });
    expect(visitorFind).toHaveBeenCalledTimes(2);
    expect(
      afterDisable
        .filter((rollup) => rollup.scope === 'global')
        .map((rollup) => ({
          basis: rollup.identityBasis,
          events: rollup.sourceEventCount,
        })),
    ).toEqual([
      { basis: 'visitor', events: 2 },
      { basis: 'session', events: 1 },
    ]);
    expect(
      afterDisable
        .filter((rollup) => rollup.scope === 'global')
        .reduce((total, rollup) => total + rollup.sourceEventCount, 0),
    ).toBe(3);
    expect(
      afterDisable.find(
        (rollup) => rollup.scope === 'global' && rollup.identityBasis === 'visitor',
      ),
    ).toMatchObject({ newVisitors: 0, returningVisitors: 1 });
  });

  it('creates self-describing score buckets for small, negative, and large scales', () => {
    const fractional = scoreBucketBounds(0.42, { min: 0, max: 1 });
    const negative = scoreBucketBounds(-12.5);
    const large = scoreBucketBounds(1_250_000);
    expect(fractional).toEqual({ min: 0.4, max: 0.5 });
    expect(negative).toEqual({ min: -13, max: -12 });
    expect(large).toEqual({ min: 1_200_000, max: 1_300_000 });
    expect(decodeScoreBucket(encodeScoreBucket(fractional!))).toEqual(fractional);
  });

  it('counts sensitive dimensions by distinct session rather than repeat events', () => {
    const summary = summarizeAnalyticsEvents(
      Array.from({ length: 10 }, (_, index) =>
        event('search', `2026-08-28T00:00:${String(index).padStart(2, '0')}.000Z`, {
          query: 'repeat-query',
          zeroResults: false,
          device: 'mobile',
          referrerHost: index === 0 ? 'first.example' : 'ignored.example',
          utmSource: index === 0 ? 'first-source' : 'ignored-source',
        }),
      ),
      false,
    );
    const decoded = Object.fromEntries(
      Object.entries(summary.breakdowns.searches ?? {}).map(([key, count]) => [
        decodeAnalyticsDimension(key),
        count,
      ]),
    );
    expect(decoded).toEqual({ 'repeat-query': 1 });
    expect(Object.values(summary.breakdowns.devices ?? {})).toEqual([1]);
    expect(Object.keys(summary.breakdowns.referrers ?? {}).map(decodeAnalyticsDimension)).toEqual([
      'first.example',
    ]);
    expect(Object.keys(summary.breakdowns.utmSources ?? {}).map(decodeAnalyticsDimension)).toEqual([
      'first-source',
    ]);
  });

  it('does not promote low-frequency search or clinical cells into forever-retained rollups', async () => {
    const cursor = <T>(values: readonly T[]) => ({
      async *[Symbol.asyncIterator]() {
        for (const value of values) yield value;
      },
    });
    const occurredAt = new Date('2026-08-28T12:00:00.000Z');
    const events = Array.from({ length: 4 }, (_, index) =>
      event('search', occurredAt.toISOString(), {
        sessionIdHash: String(index + 1).repeat(64),
        visitorIdHash: undefined,
        query: 'rare-query',
        zeroResults: true,
      }),
    );
    events.push(
      event('calc_start', occurredAt.toISOString(), {
        sessionIdHash: '9'.repeat(64),
        visitorIdHash: undefined,
        calculatorSlug: 'attacker-invented-calculator',
      }),
    );
    events.push(
      ...Array.from({ length: 4 }, (_, index) =>
        event('unit_switch', occurredAt.toISOString(), {
          sessionIdHash: `u${index}`.padEnd(64, String(index)),
          visitorIdHash: undefined,
          unit: 'rare-unit',
        }),
      ),
    );
    vi.spyOn(AnalyticsEventModel, 'find').mockReturnValue({
      sort: () => ({
        select: () => ({ lean: () => ({ cursor: () => cursor(events) }) }),
      }),
    } as never);
    vi.spyOn(ResultModel, 'find').mockReturnValue({
      select: () => ({
        lean: () => ({
          cursor: () =>
            cursor(
              Array.from({ length: 5 }, () => ({
                calculatorSlug: 'synthetic-calculator',
                score: 0.42,
                category: { label: 'rare-category' },
                computeMs: 10,
              })),
            ),
        }),
      }),
    } as never);
    vi.spyOn(AssessmentModel, 'find').mockReturnValue({
      select: () => ({
        lean: () => ({
          cursor: () =>
            cursor(
              Array.from({ length: 4 }, () => ({
                calculatorSlug: 'synthetic-calculator',
                omittedParameters: ['rare-marker'],
                inputsEntered: { marker: { unit: 'rare-unit' } },
              })),
            ),
        }),
      }),
    } as never);
    vi.spyOn(CalculatorVersionModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [] }),
    } as never);
    vi.spyOn(LeadModel, 'countDocuments').mockResolvedValue(0);
    vi.spyOn(CalculatorModel, 'find').mockReturnValue({
      select: () => ({ lean: async () => [{ slug: 'synthetic-calculator' }] }),
    } as never);
    const rollups = await buildAnalyticsDailyRollups({
      day: '2026-08-28',
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      minimumCohortSize: 5,
      now: new Date('2026-08-28T23:00:00.000Z'),
    });
    const global = rollups.find((record) => record.scope === 'global');
    const calculator = rollups.find((record) => record.scope === 'calculator');
    expect(CalculatorModel.find).toHaveBeenCalledWith({
      status: { $in: ['published', 'retired'] },
    });
    expect(
      rollups.find((record) => record.calculatorSlug === 'attacker-invented-calculator'),
    ).toBeUndefined();
    expect(global?.breakdowns.searches).toEqual({});
    expect(global?.breakdowns.zeroResultSearches).toEqual({});
    expect(global?.breakdowns.units).toEqual({});
    expect(calculator).toMatchObject({
      results: 5,
      assessments: 4,
      scoreBuckets: {},
      categoryCounts: {},
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
    });
  });
});
