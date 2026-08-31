import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyticsDashboardService,
  createAdminAnalyticsRouter,
  formatAnalyticsCsv,
} from './dashboard';
import { OperationalMetrics } from './metrics';
import { createIdentitySketch } from './hll';
import { encodeAnalyticsDimension } from './rollup';
import type { AuthService } from '../auth/service';
import { AnalyticsDailyModel } from '../persistence/models/analytics-daily';
import { AnalyticsEventModel } from '../persistence/models/analytics-event';
import { AuditLogModel } from '../persistence/models/audit-log';
import { AssessmentModel } from '../persistence/models/assessment';
import { LeadModel } from '../persistence/models/lead';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

function auth(role: 'admin' | 'editor'): AuthService {
  const user = {
    id: role === 'admin' ? '507f1f77bcf86cd799439011' : '507f1f77bcf86cd799439012',
    email: `${role}@example.invalid`,
    role,
  } as const;
  return {
    verifyAccess: () => user,
    verifyRequest: async () => user,
  } as unknown as AuthService;
}

async function setup(role: 'admin' | 'editor') {
  const app = express();
  app.use(
    '/analytics',
    createAdminAnalyticsRouter(auth(role), {
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    }),
  );
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server unavailable');
  return `http://127.0.0.1:${address.port}/analytics`;
}

describe('admin analytics dashboard boundary', () => {
  it('uses durable materialized rows for today without scanning raw source collections', async () => {
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [] } as never);
    vi.spyOn(AnalyticsEventModel, 'distinct').mockResolvedValue([]);
    const rawEventScan = vi.spyOn(AnalyticsEventModel, 'find');
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const request = { query: { from: '2026-08-30', to: '2026-08-30' } } as never;

    await service.overview(request);
    expect(rawEventScan).not.toHaveBeenCalled();
  });

  it('returns the stable overview DTO from persisted aggregate rows', async () => {
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 2,
      sessions: 2,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 1,
      results: 1,
      leads: 1,
      eventCounts: { result_view: 1 },
      sessionDurationTotalMs: 5_000,
      sessionDurationSamples: 2,
      pageViews: 3,
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
      sourceEventCount: 5,
      rolledUpAt: new Date('2026-08-29T00:00:00.000Z'),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    vi.spyOn(AnalyticsEventModel, 'distinct').mockResolvedValue([]);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.overview({
      query: { from: '2026-08-28', to: '2026-08-28' },
    } as never);
    expect(result.range).toEqual({ from: '2026-08-28', to: '2026-08-28', timezone: 'UTC' });
    expect(result.thirtyDays).toMatchObject({ sessions: 2, assessments: 1, results: 1, leads: 1 });
    expect(result.identityBasis).toBe('session');
    expect(result.identityNotice).toContain('estimates');
  });

  it('preserves history across identity-key rotation without merging sketches or double-counting product rows', async () => {
    const base = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'session' as const,
      visitors: 1,
      sessions: 1,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 1,
      results: 1,
      leads: 1,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 1,
      pageViews: 1,
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
      sourceEventCount: 1,
    };
    const rows = [
      { ...base, identityKeyVersion: 'v1', rolledUpAt: new Date('2026-08-29T00:00:00Z') },
      { ...base, identityKeyVersion: 'v2', rolledUpAt: new Date('2026-08-29T01:00:00Z') },
    ];
    const find = vi
      .spyOn(AnalyticsDailyModel, 'find')
      .mockReturnValue({ lean: async () => rows } as never);
    vi.spyOn(AnalyticsEventModel, 'distinct').mockResolvedValue([]);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v2',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.overview({
      query: { from: '2026-08-28', to: '2026-08-28' },
    } as never);
    expect(find).toHaveBeenCalledWith({
      day: { $gte: '2026-07-30', $lte: '2026-08-28' },
      timezone: 'UTC',
    });
    expect(result.thirtyDays).toMatchObject({
      sessions: 2,
      assessments: 1,
      results: 1,
      leads: 1,
    });
    expect(result.identityNotice).toContain('upper-bound');
  });

  it('counts a returning visitor once across a multi-day window', async () => {
    const identitySketch = createIdentitySketch(['a'.repeat(64)]);
    const row = (day: string) => ({
      day,
      timezone: 'UTC',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'visitor',
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      visitors: 1,
      sessions: 1,
      newVisitors: 0,
      returningVisitors: 1,
      identitySketch,
      assessments: 0,
      results: 0,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 1,
      pageViews: 1,
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
      sourceEventCount: 1,
      rolledUpAt: new Date(`${day}T23:59:00.000Z`),
    });
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({
      lean: async () => [row('2026-08-27'), row('2026-08-28')],
    } as never);
    vi.spyOn(AnalyticsEventModel, 'distinct').mockResolvedValue([]);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: true,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.overview({
      query: { from: '2026-08-27', to: '2026-08-28' },
    } as never);
    expect(result.newVsReturning).toEqual({ new: 0, returning: 1 });
  });

  it('suppresses health distributions below the configured cohort threshold', async () => {
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'calculator',
      scopeKey: 'calculator:synthetic-calculator',
      calculatorSlug: 'synthetic-calculator',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 4,
      sessions: 4,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 4,
      results: 4,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 4,
      pageViews: 0,
      breakdowns: {},
      funnel: {},
      stepViews: {},
      scoreBuckets: { v_NDA: 4 },
      categoryCounts: { v_SGlnaA: 4 },
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 20,
      computeMsSamples: 4,
      sourceEventCount: 0,
      rolledUpAt: new Date(),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.scores(
      { query: { from: '2026-08-28', to: '2026-08-28' } } as never,
      'synthetic-calculator',
    );
    expect(result).toMatchObject({
      suppressed: true,
      sampleSize: 4,
      successfulAssessments: 4,
      scoreHistogram: [],
      categories: [],
      categoryTrend: [{ day: '2026-08-28', suppressed: true, categories: [] }],
      omittedParameters: [],
      units: [],
      versionAdoption: [],
      averageComputeMs: 0,
      assessmentErrorRateBasis: 'client-telemetry-observed-v1',
    });
    expect(result.suppressionNotice).toContain('at least 5');
  });

  it('suppresses a daily category trend unless both result and assessment cohorts qualify', async () => {
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'calculator',
      scopeKey: 'calculator:synthetic-calculator',
      calculatorSlug: 'synthetic-calculator',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 5,
      sessions: 5,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 4,
      results: 5,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 5,
      pageViews: 0,
      breakdowns: {},
      funnel: {},
      stepViews: {},
      scoreBuckets: {},
      categoryCounts: { [encodeAnalyticsDimension('high')]: 5 },
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
      sourceEventCount: 0,
      rolledUpAt: new Date(),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.scores(
      { query: { from: '2026-08-28', to: '2026-08-28' } } as never,
      'synthetic-calculator',
    );
    expect(result.categoryTrend).toEqual([{ day: '2026-08-28', suppressed: true, categories: [] }]);
  });

  it('does not report a drop-off step when no transition has a positive drop', async () => {
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'calculator',
      scopeKey: 'calculator:synthetic-calculator',
      calculatorSlug: 'synthetic-calculator',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 5,
      sessions: 5,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 5,
      results: 5,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 5,
      pageViews: 5,
      breakdowns: {},
      funnel: { calc_start: 5, result_view: 5 },
      stepViews: {
        [encodeAnalyticsDimension(`0\u0000first`)]: 5,
        [encodeAnalyticsDimension(`1\u0000second`)]: 5,
      },
      scoreBuckets: {},
      categoryCounts: {},
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
      sourceEventCount: 0,
      rolledUpAt: new Date(),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.funnel(
      { query: { from: '2026-08-28', to: '2026-08-28' } } as never,
      'synthetic-calculator',
    );
    expect(result.dropOffStep).toBeUndefined();
  });

  it('aggregates poisoned legacy dimension keys without prototype collisions', async () => {
    const encodedSafePath = `v_${Buffer.from('/safe', 'utf8').toString('base64url')}`;
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'global',
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 1,
      sessions: 1,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 0,
      results: 0,
      leads: 0,
      eventCounts: JSON.parse('{"constructor":5,"share_open":1}') as Record<string, number>,
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 1,
      pageViews: 1,
      breakdowns: {
        paths: JSON.parse(`{"constructor":2,"${encodedSafePath}":3}`) as Record<string, number>,
        searches: { v_c2FmZS1xdWVyeQ: 5 },
        zeroResultSearches: { v_c2FmZS1xdWVyeQ: 2 },
      },
      funnel: JSON.parse('{"constructor":4}') as Record<string, number>,
      stepViews: JSON.parse('{"constructor":3}') as Record<string, number>,
      scoreBuckets: {},
      categoryCounts: { v_c2FmZS1jYXRlZ29yeQ: 5 },
      omittedParameterCounts: {},
      unitCounts: {},
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
      sourceEventCount: 1,
      rolledUpAt: new Date(),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });

    const result = await service.engagement({
      query: { from: '2026-08-28', to: '2026-08-28' },
    } as never);
    expect(result.shareOpens).toBe(1);
    expect(result.pages).toEqual(
      expect.arrayContaining([
        { key: '/safe', count: 3 },
        { key: 'constructor', count: 2 },
      ]),
    );
    expect(result.searches).toEqual([{ key: 'safe-query', count: 5, zeroResults: null }]);
    expect(result.searchPrivacyNotice).toContain('null zero-result count means unavailable');
    expect(result.searchPrivacyNotice).toContain('Page-path');
    expect(result.searchPrivacyNotice).toContain('referrer, and UTM source, medium, and campaign');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('discloses permanent small-cell omission policy on unsuppressed score responses', async () => {
    const row = {
      day: '2026-08-28',
      timezone: 'UTC',
      scope: 'calculator',
      scopeKey: 'calculator:synthetic-calculator',
      calculatorSlug: 'synthetic-calculator',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
      visitors: 5,
      sessions: 5,
      newVisitors: 0,
      returningVisitors: 0,
      identitySketch: Array.from({ length: 64 }, () => 0),
      assessments: 5,
      results: 5,
      leads: 0,
      eventCounts: {},
      sessionDurationTotalMs: 0,
      sessionDurationSamples: 5,
      pageViews: 0,
      breakdowns: {},
      funnel: {},
      stepViews: {},
      scoreBuckets: {},
      categoryCounts: { 'safe-category': 5 },
      omittedParameterCounts: { v_bG93LWNvdW50: 2 },
      unitCounts: { v_bG93LXVuaXQ: 2 },
      versionCounts: {},
      computeMsTotal: 0,
      computeMsSamples: 0,
      sourceEventCount: 0,
      rolledUpAt: new Date(),
    };
    vi.spyOn(AnalyticsDailyModel, 'find').mockReturnValue({ lean: async () => [row] } as never);
    const service = new AnalyticsDashboardService({
      timezone: 'UTC',
      visitorPersistenceEnabled: false,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      metrics: new OperationalMetrics(),
      databaseReady: () => true,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    });
    const result = await service.scores(
      { query: { from: '2026-08-28', to: '2026-08-28' } } as never,
      'synthetic-calculator',
    );
    expect(result.suppressed).toBe(false);
    expect(result.categoryTrend).toEqual([
      {
        day: '2026-08-28',
        suppressed: false,
        categories: [{ key: 'safe-category', count: 5 }],
      },
    ]);
    expect(result.omittedParameters).toEqual([]);
    expect(result.units).toEqual([]);
    expect(result.suppressionNotice).toContain('may have been permanently omitted');
    expect(result.suppressionNotice).toContain('omission, unit, or version');
  });

  it('rejects unknown query fields before touching persistence', async () => {
    const base = await setup('editor');
    for (const path of ['overview', 'ops', 'metrics']) {
      const response = await fetch(`${base}/${path}?unexpected=value`, {
        headers: { authorization: 'Bearer test-token' },
      });
      expect(response.status, path).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_QUERY' } });
    }
  });

  it('rejects duplicate range and export filter parameters before persistence', async () => {
    const editor = await setup('editor');
    for (const path of [
      'overview',
      'engagement',
      'funnel/synthetic-calculator',
      'scores/synthetic-calculator',
      'leads',
      'security',
    ]) {
      const response = await fetch(`${editor}/${path}?from=2026-08-28&from=2026-08-29`, {
        headers: { authorization: 'Bearer test-token' },
      });
      expect(response.status, path).toBe(422);
    }

    const leadFind = vi.spyOn(LeadModel, 'find');
    const assessmentFind = vi.spyOn(AssessmentModel, 'find');
    const admin = await setup('admin');
    expect(
      (
        await fetch(`${admin}/exports/leads.csv?from=2026-08-28&from=2026-08-29`, {
          headers: { authorization: 'Bearer test-token' },
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await fetch(`${admin}/exports/assessments.csv?calculator=one&calculator=two`, {
          headers: { authorization: 'Bearer test-token' },
        })
      ).status,
    ).toBe(422);
    expect(leadFind).not.toHaveBeenCalled();
    expect(assessmentFind).not.toHaveBeenCalled();
  });

  it('keeps sensitive exports admin-only and audits successful export metadata', async () => {
    const editor = await setup('editor');
    expect(
      (
        await fetch(`${editor}/exports/leads.csv?from=2026-08-28&to=2026-08-28`, {
          headers: { authorization: 'Bearer test-token' },
        })
      ).status,
    ).toBe(403);

    const query = {
      select: () => query,
      sort: () => query,
      limit: () => query,
      lean: async () => [
        {
          createdAt: new Date('2026-08-28T00:00:00.000Z'),
          email: 'lead@example.invalid',
          consentVersion: 'privacy-v1',
          expiresAt: new Date('2026-09-28T00:00:00.000Z'),
        },
      ],
    };
    vi.spyOn(LeadModel, 'find').mockReturnValue(query as never);
    const audit = vi.spyOn(AuditLogModel, 'create').mockResolvedValue({} as never);
    const admin = await setup('admin');
    const response = await fetch(`${admin}/exports/leads.csv?from=2026-08-28&to=2026-08-28`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('lead@example.invalid');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'analytics.export.leads',
        diffSummary: { from: '2026-08-28', to: '2026-08-28', count: 1 },
      }),
    );
    expect(JSON.stringify(audit.mock.calls)).not.toContain('lead@example.invalid');
  });

  it('neutralizes spreadsheet formulas in legacy/corrupt CSV rows and preserves quoting', () => {
    const csv = formatAnalyticsCsv([
      ['value'],
      ['=HYPERLINK("https://evil.invalid")'],
      ['  =SUM(1,1)'],
      ['\t@IMPORTDATA("https://evil.invalid")'],
      ['\r-2+3'],
      ['normal,quoted'],
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'  =SUM");
    expect(csv).toContain("'\t@IMPORTDATA");
    expect(csv).toContain("'\r-2+3");
    expect(csv).toContain('"normal,quoted"');
  });
});
