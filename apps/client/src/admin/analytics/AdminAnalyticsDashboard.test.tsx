// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AnalyticsEngagementResponse,
  AnalyticsFunnelResponse,
  AnalyticsLeadsResponse,
  AnalyticsOpsResponse,
  AnalyticsOverviewResponse,
  AnalyticsScoresResponse,
  AnalyticsSecurityResponse,
} from '@niro/contracts/analytics-api';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import React, { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../api';
import { AdminAnalyticsDashboard, defaultAnalyticsRange } from './AdminAnalyticsDashboard';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    analyticsOverview: vi.fn(),
    analyticsEngagement: vi.fn(),
    analyticsFunnel: vi.fn(),
    analyticsScores: vi.fn(),
    analyticsLeads: vi.fn(),
    analyticsSecurity: vi.fn(),
    analyticsOperations: vi.fn(),
    auditRecords: vi.fn(),
    calculators: vi.fn(),
    downloadAnalyticsExport: vi.fn(),
  };
});

let role: 'admin' | 'editor' | 'medical-reviewer' = 'admin';
const logout = vi.fn(async () => undefined);

vi.mock('../auth/AdminSessionProvider', () => ({
  useAdminSession: () => ({
    admin: { id: 'admin-id', email: 'admin@example.test', role },
    loading: false,
    login: vi.fn(),
    logout,
    refresh: vi.fn(),
  }),
}));

const range = { from: '2026-08-01', to: '2026-08-30', timezone: 'Asia/Kolkata' };
const summary = {
  visitors: 5,
  sessions: 7,
  assessments: 3,
  results: 3,
  leads: 1,
  topCalculator: 'heart-risk',
};
const overview: AnalyticsOverviewResponse = {
  range,
  identityBasis: 'session',
  identityNotice: 'Persistent visitor identity is disabled; uniques use sessions.',
  today: summary,
  sevenDays: summary,
  thirtyDays: summary,
  active: { dau: 4, wau: 5, mau: 6 },
  newVsReturning: { new: 0, returning: 0 },
  liveNow: 2,
  growth: [
    { day: '2026-08-29', visitors: 3, sessions: 3, assessments: 1, results: 1, leads: 0 },
    { day: '2026-08-30', visitors: 5, sessions: 5, assessments: 2, results: 2, leads: 1 },
  ],
};
const engagement: AnalyticsEngagementResponse = {
  range,
  averageSessionDurationMs: 90_000,
  pagesPerSession: 2.5,
  calculators: [
    {
      calculatorSlug: 'heart-risk',
      starts: 10,
      completions: 7,
      completionRate: 0.7,
      dropOffStep: 'labs',
    },
  ],
  pages: [{ key: '/c/heart-risk', count: 12 }],
  searches: [{ key: 'cholesterol', count: 3, zeroResults: 1 }],
  searchPrivacyNotice: 'Zero-result cells below the privacy threshold are unavailable.',
  devices: [{ key: 'desktop', count: 7 }],
  browsers: [{ key: 'Chrome', count: 7 }],
  operatingSystems: [{ key: 'Windows', count: 7 }],
  locales: [{ key: 'en-IN', count: 7 }],
  referrers: [{ key: 'search.example', count: 4 }],
  utmSources: [{ key: 'newsletter', count: 4 }],
  utmMediums: [{ key: 'email', count: 4 }],
  utmCampaigns: [{ key: 'prevention-launch', count: 4 }],
  shareOpens: 2,
  retakes: 1,
  retakeRate: 0.125,
};
const funnel: AnalyticsFunnelResponse = {
  calculatorSlug: 'heart-risk',
  range,
  stages: [
    { stage: 'page_view', count: 12 },
    { stage: 'result_view', count: 7 },
  ],
  steps: [{ key: 'labs', count: 8 }],
  dropOffStep: 'labs',
  completionRate: 0.7,
};
const scores: AnalyticsScoresResponse = {
  calculatorSlug: 'heart-risk',
  range,
  suppressed: false,
  sampleSize: 8,
  successfulAssessments: 10,
  scoreHistogram: [{ lowerInclusive: 0, upperExclusive: 10, count: 3 }],
  categories: [{ key: 'Low', count: 3 }],
  categoryTrend: [
    {
      day: '2026-08-29',
      suppressed: false,
      categories: [{ key: 'Low', count: 3 }],
    },
    { day: '2026-08-30', suppressed: true, categories: [] },
  ],
  omittedParameters: [{ key: 'hdl', count: 2 }],
  units: [{ key: 'mg/dL', count: 4 }],
  averageComputeMs: 12,
  versionAdoption: [{ key: 'version-id', count: 3 }],
  assessmentErrors: 1,
  assessmentErrorRate: 0.1,
  assessmentErrorRateBasis: 'client-telemetry-observed-v1',
};
const leads: AnalyticsLeadsResponse = {
  range,
  total: 1,
  resultViews: 3,
  conversionRate: 1 / 3,
  trend: [{ day: '2026-08-30', leads: 1 }],
  calculatorAttribution: 'unavailable-unlinked-v1',
};
const security: AnalyticsSecurityResponse = {
  range,
  successfulLogins: 4,
  failedLogins: 2,
  logouts: 3,
  activeLockouts: 0,
  rateLimitTrips: 1,
  rateLimitScope: 'public-endpoints-current-instance-since-start',
  failedLoginTrend: [{ day: '2026-08-30', count: 2 }],
  failedAttemptGroups: [{ kind: 'account', label: 'account:84f9c7', count: 2 }],
  adminActivity: [{ actorId: 'actor-id', actions: 5, lastActivityAt: '2026-08-30T10:00:00Z' }],
};
const operations: AnalyticsOpsResponse = {
  checkedAt: '2026-08-30T12:00:00Z',
  health: 'ok',
  metricsScope: 'current-instance-since-start',
  latencyScope: 'current-instance-rolling-last-5000',
  database: 'ready',
  requestLatencyMs: { p50: 20, p95: 80 },
  errorRate: 0.01,
  cache: { hits: 9, misses: 1, hitRate: 0.9 },
  cacheInvalidations: { pending: 0, failed: 0, oldestPendingAgeMs: null },
  eventIngest: { accepted: 20, rejected: 1, filteredBots: 2, lagMs: 500 },
  publishesLast30Days: 1,
  jobs: [{ job: 'analytics-rollup', scheduledFor: '2026-08-30', status: 'succeeded', attempt: 1 }],
  collections: [{ name: 'analytics_events', documents: 20, storageBytes: 2_048 }],
};

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDashboard() {
  return render(<AdminAnalyticsDashboard />, { wrapper: Wrapper });
}

beforeEach(() => {
  role = 'admin';
  vi.mocked(api.calculators).mockResolvedValue([
    { id: 'calculator-id', slug: 'heart-risk', name: 'Heart Risk', status: 'draft' },
  ]);
  vi.mocked(api.analyticsOverview).mockResolvedValue(overview);
  vi.mocked(api.analyticsEngagement).mockResolvedValue(engagement);
  vi.mocked(api.analyticsFunnel).mockResolvedValue(funnel);
  vi.mocked(api.analyticsScores).mockResolvedValue(scores);
  vi.mocked(api.analyticsLeads).mockResolvedValue(leads);
  vi.mocked(api.analyticsSecurity).mockResolvedValue(security);
  vi.mocked(api.analyticsOperations).mockResolvedValue(operations);
  vi.mocked(api.auditRecords).mockResolvedValue([
    {
      id: 'audit-id',
      actorId: 'actor-id',
      action: 'calculator.version.publish',
      entityType: 'CalculatorVersion',
      entityId: 'version-id',
      createdAt: '2026-08-30T10:00:00Z',
    },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminAnalyticsDashboard', () => {
  it('contains wide analytics content inside local scrollers at narrow widths', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/admin/admin.css'), 'utf8').replace(
      /\s+/g,
      ' ',
    );
    expect(css).toContain('.analytics-panel-stack > * { max-width: 100%; min-width: 0; }');
    expect(css).toContain(
      '.analytics-table-wrap { max-width: 100%; min-width: 0; overflow-x: auto; width: 100%; }',
    );
    expect(css).toContain(
      '.analytics-tabs { display: flex; gap: 0.45rem; margin: 1rem 0; max-width: 100%; overflow-x: auto;',
    );
  });

  it('labels session fallback honestly and renders an accessible overview', async () => {
    const { container } = renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Traffic and outcomes' })).toBeVisible();
    expect(screen.getByText(/Persistent visitor identity is disabled/)).toBeVisible();
    expect(screen.getAllByText('Unavailable without persistent visitor identity')).toHaveLength(2);
    expect(screen.getByText(/daily session-based uniques/)).toBeVisible();
    expect(
      (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it('covers all six panels, enforces export RBAC, and exposes audit detail only to admins', async () => {
    role = 'editor';
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: 'Traffic and outcomes' });

    await user.click(screen.getByRole('button', { name: 'Engagement' }));
    expect(await screen.findByRole('heading', { name: /Calculator funnel/ })).toBeVisible();
    expect(screen.getByText('12.5%')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'UTM sources' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'UTM media' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'UTM campaigns' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Assessment intelligence' }));
    expect(
      await screen.findByRole('heading', { name: /Assessment intelligence: heart-risk/ }),
    ).toBeVisible();
    expect(screen.getByText('Successful persisted assessments')).toBeVisible();
    expect(screen.getByText('Telemetry-observed assessment errors')).toBeVisible();
    expect(screen.getByText(/can undercount when public analytics is disabled/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Category mix over time' })).toBeVisible();
    expect(screen.getByText(/daily cohort below privacy threshold/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Admin only/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Leads' }));
    expect(await screen.findByRole('heading', { name: 'Opt-in leads' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Admin only/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Security & audit' }));
    expect(await screen.findByText(/Detailed audit records are restricted/)).toBeVisible();
    expect(screen.getByText('Public endpoint rate-limit trips')).toBeVisible();
    expect(screen.getByText('Account key account:84f9c7')).toBeVisible();
    expect(screen.getByText(/Admin ID actor-id/)).toBeVisible();
    expect(api.auditRecords).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Operational health' }));
    expect(await screen.findByRole('heading', { name: 'Runtime and data health' })).toBeVisible();
    expect(screen.getByText('Service health · dependency-aware')).toBeVisible();
    expect(screen.queryByText('/healthz')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /latency percentiles separately cover the current instance rolling last 5000/,
      ),
    ).toBeVisible();
    expect(screen.getByText('API p50 · rolling 5,000')).toBeVisible();
  });

  it('uses a timezone-aware inclusive 90-day growth window', () => {
    expect(defaultAnalyticsRange(new Date('2026-08-30T12:00:00Z'))).toEqual({
      from: '2026-06-02',
      to: '2026-08-30',
    });
    expect(defaultAnalyticsRange(new Date('2026-08-30T20:00:00Z'), 'Asia/Kolkata')).toEqual({
      from: '2026-06-03',
      to: '2026-08-31',
    });
  });

  it('renders suppressed zero-result search cells as unavailable instead of false zeroes', async () => {
    vi.mocked(api.analyticsEngagement).mockResolvedValue({
      ...engagement,
      searches: [{ key: 'cholesterol', count: 3, zeroResults: null }],
      searchPrivacyNotice: 'Zero-result cells below five searches are unavailable.',
    });
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: 'Traffic and outcomes' });
    await user.click(screen.getByRole('button', { name: 'Engagement' }));

    expect(await screen.findByText('3 · zero-result unavailable')).toBeVisible();
    expect(
      screen.getByText('Zero-result cells below five searches are unavailable.'),
    ).toBeVisible();
    expect(screen.queryByText(/0 zero-result/)).not.toBeInTheDocument();
  });

  it('shows an explicit privacy state instead of zero-valued score distributions', async () => {
    vi.mocked(api.analyticsScores).mockResolvedValue({
      ...scores,
      suppressed: true,
      suppressionNotice: 'Hidden until at least five assessments are available.',
      sampleSize: 2,
      scoreHistogram: [],
      categories: [],
      omittedParameters: [],
      units: [],
      versionAdoption: [],
      averageComputeMs: 0,
    });
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: 'Traffic and outcomes' });
    await user.click(screen.getByRole('button', { name: 'Assessment intelligence' }));
    expect(
      await screen.findByText('Hidden until at least five assessments are available.'),
    ).toBeVisible();
    expect(screen.getByText('Below privacy threshold')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Score distribution' })).not.toBeInTheDocument();
  });

  it('shows the bounded audit trail to administrators and validates filters locally', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('heading', { name: 'Traffic and outcomes' });
    await user.click(screen.getByRole('button', { name: 'Security & audit' }));
    expect(await screen.findByText('calculator.version.publish')).toBeVisible();
    expect(api.auditRecords).toHaveBeenCalled();
    await user.type(screen.getByLabelText('Actor ID'), 'invalid');
    expect(
      await screen.findByText('Actor ID must be a 24-character MongoDB identifier.'),
    ).toBeVisible();
  });
});
