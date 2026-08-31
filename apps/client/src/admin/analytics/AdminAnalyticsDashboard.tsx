'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AnalyticsEngagementResponse,
  AnalyticsFunnelResponse,
  AnalyticsLeadsResponse,
  AnalyticsOpsResponse,
  AnalyticsOverviewResponse,
  AnalyticsRankedValue,
  AnalyticsScoresResponse,
  AnalyticsSecurityResponse,
  AnalyticsTrendPoint,
} from '@niro/contracts/analytics-api';
import Link from 'next/link';
import React from 'react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import {
  analyticsEngagement,
  analyticsFunnel,
  analyticsLeads,
  analyticsOperations,
  analyticsOverview,
  analyticsScores,
  analyticsSecurity,
  auditRecords,
  calculators,
  downloadAnalyticsExport,
  type AnalyticsDateRange,
  type AnalyticsExportKind,
  type AdminAuditFilters,
  type AdminAuditRecord,
} from '../api';
import { useAdminSession } from '../auth/AdminSessionProvider';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'assessments', label: 'Assessment intelligence' },
  { key: 'leads', label: 'Leads' },
  { key: 'security', label: 'Security & audit' },
  { key: 'operations', label: 'Operational health' },
] as const;

type DashboardTab = (typeof TABS)[number]['key'];

function datePart(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (value.year && value.month && value.day) return `${value.year}-${value.month}-${value.day}`;
  } catch {
    // The server response remains authoritative if a browser lacks this IANA timezone.
  }
  return date.toISOString().slice(0, 10);
}

export function defaultAnalyticsRange(
  now = new Date(),
  timeZone = process.env.NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE ?? 'Asia/Kolkata',
): AnalyticsDateRange {
  const toPart = datePart(now, timeZone);
  const to = new Date(`${toPart}T12:00:00.000Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 89);
  return { from: datePart(from, 'UTC'), to: toPart };
}

function number(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(value);
}

function percent(value: number): string {
  return `${number(value * 100, 1)}%`;
}

function adminIdLabel(actorId: string): string {
  return actorId.length > 14
    ? `Admin ID ${actorId.slice(0, 8)}…${actorId.slice(-4)}`
    : `Admin ID ${actorId}`;
}

function duration(value: number): string {
  if (value < 1_000) return `${number(value)} ms`;
  const seconds = value / 1_000;
  if (seconds < 60) return `${number(seconds, 1)} sec`;
  return `${number(seconds / 60, 1)} min`;
}

function bytes(value: number | null): string {
  if (value === null) return 'Unavailable';
  if (value < 1_024) return `${number(value)} B`;
  if (value < 1_048_576) return `${number(value / 1_024, 1)} KiB`;
  if (value < 1_073_741_824) return `${number(value / 1_048_576, 1)} MiB`;
  return `${number(value / 1_073_741_824, 1)} GiB`;
}

function empty(value: readonly unknown[] | undefined): boolean {
  return !value?.length;
}

function MetricGrid({
  metrics,
}: Readonly<{ metrics: readonly { readonly label: string; readonly value: ReactNode }[] }>) {
  return (
    <dl className="analytics-metric-grid">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RankedList({
  title,
  values,
  emptyText = 'No data in this reporting window.',
}: Readonly<{
  title: string;
  values: readonly AnalyticsRankedValue[];
  emptyText?: string;
}>) {
  const maximum = Math.max(1, ...values.map((item) => item.count));
  return (
    <section className="analytics-ranked" aria-label={title}>
      <h3>{title}</h3>
      {empty(values) ? (
        <p className="analytics-empty">{emptyText}</p>
      ) : (
        <ol>
          {values.map((item) => (
            <li key={item.key}>
              <span title={item.key}>{item.key}</span>
              <span
                className="analytics-bar"
                style={{ '--analytics-width': `${(item.count / maximum) * 100}%` } as CSSProperties}
              />
              <strong>{number(item.count)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function GrowthChart({
  points,
  identityLabel,
}: Readonly<{ points: readonly AnalyticsTrendPoint[]; identityLabel: string }>) {
  if (empty(points)) return <p className="analytics-empty">No daily growth data yet.</p>;
  const width = 720;
  const height = 180;
  const padding = 18;
  const maximum = Math.max(1, ...points.map((point) => point.visitors));
  const line = points
    .map((point, index) => {
      const x =
        padding + (index / Math.max(1, points.length - 1)) * Math.max(1, width - padding * 2);
      const y = height - padding - (point.visitors / maximum) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <figure className="analytics-chart">
      <svg
        role="img"
        aria-labelledby="visitor-growth-title visitor-growth-description"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id="visitor-growth-title">Daily {identityLabel} growth</title>
        <desc id="visitor-growth-description">
          Daily {identityLabel} from {points[0]?.day} to {points.at(-1)?.day}; peak {maximum}.
        </desc>
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
      <figcaption>
        {points[0]?.day}–{points.at(-1)?.day} · peak {number(maximum)} daily {identityLabel}
      </figcaption>
    </figure>
  );
}

function QueryState({
  pending,
  error,
  children,
}: Readonly<{ pending: boolean; error: unknown; children: ReactNode }>) {
  if (pending) return <p role="status">Loading analytics…</p>;
  if (error)
    return (
      <p className="admin-alert admin-alert--error" role="alert">
        {error instanceof Error ? error.message : 'Analytics could not be loaded.'}
      </p>
    );
  return children;
}

function RangeLabel({
  range,
}: Readonly<{ range: { from: string; to: string; timezone: string } }>) {
  return (
    <p className="analytics-range-label">
      {range.from}–{range.to} · reporting timezone <strong>{range.timezone}</strong>
    </p>
  );
}

function OverviewPanel({ data }: Readonly<{ data: AnalyticsOverviewResponse }>) {
  const identityHeading =
    data.identityBasis === 'visitor'
      ? 'Visitor-based identity'
      : data.identityBasis === 'session'
        ? 'Session fallback'
        : 'Mixed identity policies';
  const windowIdentityLabel =
    data.identityBasis === 'visitor'
      ? 'Unique visitors'
      : data.identityBasis === 'session'
        ? 'Session-based uniques'
        : 'Policy-partitioned uniques';
  const windows = [
    { name: 'Selected end day', value: data.today },
    { name: '7 days ending on selected date', value: data.sevenDays },
    { name: '30 days ending on selected date', value: data.thirtyDays },
  ];
  return (
    <div className="analytics-panel-stack">
      <RangeLabel range={data.range} />
      <div className="admin-alert admin-alert--warning" role="note">
        <strong>{identityHeading}:</strong> {data.identityNotice}
      </div>
      <section aria-labelledby="overview-windows-heading">
        <h2 id="overview-windows-heading">Traffic and outcomes</h2>
        <div className="analytics-window-grid">
          {windows.map(({ name, value }) => (
            <article key={name}>
              <h3>{name}</h3>
              <MetricGrid
                metrics={[
                  {
                    label: windowIdentityLabel,
                    value: number(value.visitors),
                  },
                  { label: 'Sessions', value: number(value.sessions) },
                  { label: 'Assessments', value: number(value.assessments) },
                  { label: 'Persisted results', value: number(value.results) },
                  { label: 'Leads', value: number(value.leads) },
                  { label: 'Top calculator', value: value.topCalculator ?? '—' },
                ]}
              />
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="active-audience-heading">
        <h2 id="active-audience-heading">Active audience</h2>
        <MetricGrid
          metrics={[
            { label: 'DAU', value: number(data.active.dau) },
            { label: 'WAU', value: number(data.active.wau) },
            { label: 'MAU', value: number(data.active.mau) },
            { label: 'Live now (5 min)', value: number(data.liveNow) },
            {
              label:
                data.identityBasis === 'mixed'
                  ? 'New visitors (persistent cohort)'
                  : 'New visitors',
              value:
                data.identityBasis === 'session'
                  ? 'Unavailable without persistent visitor identity'
                  : number(data.newVsReturning.new),
            },
            {
              label:
                data.identityBasis === 'mixed'
                  ? 'Returning visitors (persistent cohort)'
                  : 'Returning visitors',
              value:
                data.identityBasis === 'session'
                  ? 'Unavailable without persistent visitor identity'
                  : number(data.newVsReturning.returning),
            },
          ]}
        />
        <RankedList
          title="DAU / WAU / MAU"
          values={[
            { key: 'DAU', count: data.active.dau },
            { key: 'WAU', count: data.active.wau },
            { key: 'MAU', count: data.active.mau },
          ]}
        />
      </section>
      <section aria-labelledby="visitor-growth-heading">
        <h2 id="visitor-growth-heading">Audience growth</h2>
        <GrowthChart
          points={data.growth}
          identityLabel={
            data.identityBasis === 'visitor'
              ? 'unique visitors'
              : data.identityBasis === 'session'
                ? 'session-based uniques'
                : 'policy-partitioned uniques'
          }
        />
      </section>
    </div>
  );
}

function FunnelPanel({ data }: Readonly<{ data: AnalyticsFunnelResponse }>) {
  return (
    <section aria-labelledby="funnel-heading">
      <h2 id="funnel-heading">Calculator funnel: {data.calculatorSlug}</h2>
      <MetricGrid
        metrics={[
          { label: 'Completion rate', value: percent(data.completionRate) },
          { label: 'Largest step drop-off', value: data.dropOffStep ?? 'Not enough data' },
        ]}
      />
      <div className="analytics-ranked-grid">
        <RankedList
          title="Funnel stages"
          values={data.stages.map((item) => ({ key: item.stage, count: item.count }))}
        />
        <RankedList title="Step views" values={data.steps} />
      </div>
    </section>
  );
}

function SearchList({
  searches,
  searchPrivacyNotice,
}: Pick<AnalyticsEngagementResponse, 'searches' | 'searchPrivacyNotice'>) {
  return (
    <section className="analytics-ranked" aria-label="Search terms">
      <h3>Search terms</h3>
      {empty(searches) ? (
        <p className="analytics-empty">No privacy-safe search terms in this window.</p>
      ) : (
        <ol>
          {searches.map((item) => (
            <li key={item.key}>
              <span>{item.key}</span>
              <span />
              <strong>
                {number(item.count)} ·{' '}
                {item.zeroResults === null
                  ? 'zero-result unavailable'
                  : `${number(item.zeroResults)} zero-result`}
              </strong>
            </li>
          ))}
        </ol>
      )}
      <p className="muted" role="note">
        {searchPrivacyNotice}
      </p>
    </section>
  );
}

function EngagementPanel({
  data,
  funnel,
}: Readonly<{ data: AnalyticsEngagementResponse; funnel?: AnalyticsFunnelResponse }>) {
  return (
    <div className="analytics-panel-stack">
      <RangeLabel range={data.range} />
      <MetricGrid
        metrics={[
          { label: 'Average session duration', value: duration(data.averageSessionDurationMs) },
          { label: 'Pages per session', value: number(data.pagesPerSession, 2) },
          { label: 'Share-link opens', value: number(data.shareOpens) },
          { label: 'Retakes', value: number(data.retakes) },
          { label: 'Retake rate', value: percent(data.retakeRate) },
        ]}
      />
      <section aria-labelledby="calculator-engagement-heading">
        <h2 id="calculator-engagement-heading">Calculator use</h2>
        {empty(data.calculators) ? (
          <p className="analytics-empty">No calculator funnel activity in this window.</p>
        ) : (
          <div className="analytics-table-wrap">
            <table>
              <caption className="calculator-visually-hidden">Calculator engagement</caption>
              <thead>
                <tr>
                  <th scope="col">Calculator</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Completions</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {data.calculators.map((item) => (
                  <tr key={item.calculatorSlug}>
                    <th scope="row">{item.calculatorSlug}</th>
                    <td>{number(item.starts)}</td>
                    <td>{number(item.completions)}</td>
                    <td>{percent(item.completionRate)}</td>
                    <td>{item.dropOffStep ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {funnel ? <FunnelPanel data={funnel} /> : null}
      <div className="analytics-ranked-grid">
        <RankedList title="Most-viewed pages" values={data.pages} />
        <SearchList searches={data.searches} searchPrivacyNotice={data.searchPrivacyNotice} />
        <RankedList title="Devices" values={data.devices} />
        <RankedList title="Browsers" values={data.browsers} />
        <RankedList title="Operating systems" values={data.operatingSystems} />
        <RankedList title="Locales" values={data.locales} />
        <RankedList title="Referrers" values={data.referrers} />
        <RankedList title="UTM sources" values={data.utmSources} />
        <RankedList title="UTM media" values={data.utmMediums} />
        <RankedList title="UTM campaigns" values={data.utmCampaigns} />
      </div>
    </div>
  );
}

function ScoreHistogram({ data }: Readonly<{ data: AnalyticsScoresResponse }>) {
  const values = data.scoreHistogram.map((bucket) => ({
    key: `${number(bucket.lowerInclusive, 2)}–<${number(bucket.upperExclusive, 2)}`,
    count: bucket.count,
  }));
  return <RankedList title="Score distribution" values={values} />;
}

function CategoryTrend({ data }: Readonly<{ data: AnalyticsScoresResponse }>) {
  return (
    <section aria-labelledby="category-trend-heading">
      <h3 id="category-trend-heading">Category mix over time</h3>
      {empty(data.categoryTrend) ? (
        <p className="analytics-empty">No daily category trend is available in this window.</p>
      ) : (
        <div className="analytics-table-wrap analytics-trend-table">
          <table>
            <caption className="calculator-visually-hidden">
              Daily privacy-safe result category counts
            </caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Reportable category mix</th>
              </tr>
            </thead>
            <tbody>
              {data.categoryTrend.map((point) => (
                <tr key={point.day}>
                  <th scope="row">{point.day}</th>
                  <td>
                    {point.suppressed
                      ? 'Suppressed — daily cohort below privacy threshold'
                      : point.categories.length
                        ? point.categories
                            .map((item) => `${item.key}: ${number(item.count)}`)
                            .join(' · ')
                        : 'No reportable category cells'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AssessmentPanel({
  data,
  exporting,
  canExport,
  onExport,
}: Readonly<{
  data: AnalyticsScoresResponse;
  exporting: boolean;
  canExport: boolean;
  onExport: () => void;
}>) {
  return (
    <div className="analytics-panel-stack">
      <RangeLabel range={data.range} />
      <div className="analytics-section-heading">
        <div>
          <h2>Assessment intelligence: {data.calculatorSlug}</h2>
          <p className="muted">
            Aggregated clinical outputs only; no individual health values are shown.
          </p>
        </div>
        <button
          className="admin-secondary-button"
          disabled={exporting || !canExport}
          onClick={onExport}
          title={canExport ? undefined : 'CSV exports are restricted to administrators.'}
          type="button"
        >
          {!canExport
            ? 'CSV export · Admin only'
            : exporting
              ? 'Preparing CSV…'
              : 'Export assessments CSV'}
        </button>
      </div>
      {data.suppressionNotice ? (
        <p className="admin-alert admin-alert--warning" role="note">
          {data.suppressionNotice}
        </p>
      ) : data.suppressed ? (
        <p className="admin-alert admin-alert--warning" role="note">
          Assessment distributions are hidden until the privacy-safe minimum cohort is reached.
        </p>
      ) : null}
      <p className="muted">
        Assessment error count and rate are telemetry-observed. They can undercount when public
        analytics is disabled, blocked, or unavailable.
      </p>
      {data.suppressed ? (
        <>
          <MetricGrid
            metrics={[
              { label: 'Cohort', value: 'Below privacy threshold' },
              {
                label: 'Telemetry-observed assessment errors',
                value: number(data.assessmentErrors),
              },
              {
                label: 'Telemetry-observed assessment error rate',
                value: percent(data.assessmentErrorRate),
              },
              { label: 'Average compute time', value: 'Suppressed with cohort' },
            ]}
          />
        </>
      ) : (
        <>
          <MetricGrid
            metrics={[
              { label: 'Persisted results in cohort', value: number(data.sampleSize) },
              {
                label: 'Successful persisted assessments',
                value: number(data.successfulAssessments),
              },
              { label: 'Average compute time', value: duration(data.averageComputeMs) },
              {
                label: 'Telemetry-observed assessment errors',
                value: number(data.assessmentErrors),
              },
              {
                label: 'Telemetry-observed assessment error rate',
                value: percent(data.assessmentErrorRate),
              },
            ]}
          />
          <div className="analytics-ranked-grid">
            <ScoreHistogram data={data} />
            <RankedList title="Category mix" values={data.categories} />
            <RankedList title="Frequently omitted parameters" values={data.omittedParameters} />
            <RankedList title="Units used" values={data.units} />
            <RankedList title="Version adoption" values={data.versionAdoption} />
          </div>
          <CategoryTrend data={data} />
        </>
      )}
    </div>
  );
}

function LeadsPanel({
  data,
  exporting,
  canExport,
  onExport,
}: Readonly<{
  data: AnalyticsLeadsResponse;
  exporting: boolean;
  canExport: boolean;
  onExport: () => void;
}>) {
  return (
    <div className="analytics-panel-stack">
      <RangeLabel range={data.range} />
      <div className="analytics-section-heading">
        <div>
          <h2>Opt-in leads</h2>
          <p className="muted">Email addresses are excluded from dashboard analytics.</p>
        </div>
        <button
          className="admin-secondary-button"
          disabled={exporting || !canExport}
          onClick={onExport}
          title={canExport ? undefined : 'CSV exports are restricted to administrators.'}
          type="button"
        >
          {!canExport
            ? 'CSV export · Admin only'
            : exporting
              ? 'Preparing CSV…'
              : 'Export leads CSV'}
        </button>
      </div>
      <MetricGrid
        metrics={[
          { label: 'Leads captured', value: number(data.total) },
          { label: 'Results viewed', value: number(data.resultViews) },
          { label: 'Conversion rate', value: percent(data.conversionRate) },
        ]}
      />
      <RankedList
        title="Lead trend"
        values={data.trend.map((point) => ({ key: point.day, count: point.leads }))}
      />
      <p className="admin-alert admin-alert--warning" role="note">
        Per-calculator attribution is unavailable in the current unlinked lead schema. This panel
        does not infer attribution.
      </p>
    </div>
  );
}

function SecurityPanel({
  data,
  canViewAudit,
  audit,
  auditPending,
  auditError,
  auditFilterError,
  auditFilters,
  calculatorOptions,
  onAuditFilterChange,
}: Readonly<{
  data: AnalyticsSecurityResponse;
  canViewAudit: boolean;
  audit?: readonly AdminAuditRecord[];
  auditPending: boolean;
  auditError: unknown;
  auditFilterError?: string;
  auditFilters: AdminAuditFilters;
  calculatorOptions: readonly {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
  }[];
  onAuditFilterChange: (filters: AdminAuditFilters) => void;
}>) {
  return (
    <div className="analytics-panel-stack">
      <RangeLabel range={data.range} />
      <h2>Authentication and administrative activity</h2>
      <MetricGrid
        metrics={[
          { label: 'Successful logins', value: number(data.successfulLogins) },
          { label: 'Failed logins', value: number(data.failedLogins) },
          { label: 'Logouts', value: number(data.logouts) },
          { label: 'Active lockouts', value: number(data.activeLockouts) },
          { label: 'Public endpoint rate-limit trips', value: number(data.rateLimitTrips) },
        ]}
      />
      <p className="muted">
        Public endpoint rate-limit trips are scoped to the{' '}
        {data.rateLimitScope.replaceAll('-', ' ')} and reset when that API instance restarts.
      </p>
      <div className="analytics-ranked-grid">
        <RankedList
          title="Failed login trend"
          values={data.failedLoginTrend.map((point) => ({ key: point.day, count: point.count }))}
        />
        <RankedList
          title="Failed attempts by privacy-safe key"
          values={data.failedAttemptGroups.map((item) => ({
            key: `${item.kind === 'account' ? 'Account' : 'Network'} key ${item.label}`,
            count: item.count,
          }))}
        />
        <RankedList
          title="Per-admin activity"
          values={data.adminActivity.map((item) => ({
            key: `${adminIdLabel(item.actorId)} · last ${item.lastActivityAt}`,
            count: item.actions,
          }))}
        />
      </div>
      <section aria-labelledby="audit-trail-heading">
        <h3 id="audit-trail-heading">Recent administrative audit trail</h3>
        <p className="muted">
          This bounded trail shows up to 200 most recent matching records and is independent of the
          analytics reporting-date filter above.
        </p>
        {!canViewAudit ? (
          <p className="admin-alert admin-alert--warning" role="note">
            Detailed audit records are restricted to administrators. Aggregate per-admin activity
            remains visible above.
          </p>
        ) : (
          <>
            <div className="analytics-audit-filters">
              <label className="admin-field">
                <span>Actor ID</span>
                <input
                  placeholder="All actors"
                  value={auditFilters.actor ?? ''}
                  onChange={(event) =>
                    onAuditFilterChange({ ...auditFilters, actor: event.currentTarget.value })
                  }
                />
              </label>
              <label className="admin-field">
                <span>Exact action</span>
                <input
                  placeholder="All actions"
                  value={auditFilters.action ?? ''}
                  onChange={(event) =>
                    onAuditFilterChange({ ...auditFilters, action: event.currentTarget.value })
                  }
                />
              </label>
              <label className="admin-field">
                <span>Calculator</span>
                <select
                  value={auditFilters.slug ?? ''}
                  onChange={(event) =>
                    onAuditFilterChange({ ...auditFilters, slug: event.currentTarget.value })
                  }
                >
                  <option value="">All calculators</option>
                  {calculatorOptions.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {auditFilterError ? (
              <p className="admin-alert admin-alert--error" role="alert">
                {auditFilterError}
              </p>
            ) : null}
            {auditPending && !auditFilterError ? <p role="status">Loading audit records…</p> : null}
            {auditError ? (
              <p className="admin-alert admin-alert--error" role="alert">
                {auditError instanceof Error
                  ? auditError.message
                  : 'Audit records could not be loaded.'}
              </p>
            ) : null}
            {!auditFilterError && !auditPending && !auditError && empty(audit) ? (
              <p className="analytics-empty">No audit records match these filters.</p>
            ) : null}
            {!auditFilterError && !auditPending && !auditError && !empty(audit) ? (
              <div className="analytics-table-wrap">
                <table>
                  <caption className="calculator-visually-hidden">
                    Up to 200 most recent matching audit records
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit?.map((record) => (
                      <tr key={record.id}>
                        <td>{record.createdAt}</td>
                        <td>{record.actorId ?? 'system'}</td>
                        <td>{record.action}</td>
                        <td>
                          {record.entityType}
                          {record.entityId ? ` · ${record.entityId}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>
      <p className="muted">
        Raw passwords, access tokens, and public visitor health values are never displayed. IP
        addresses are used transiently by security controls and are not exposed here.
      </p>
    </div>
  );
}

function OperationsPanel({ data }: Readonly<{ data: AnalyticsOpsResponse }>) {
  return (
    <div className="analytics-panel-stack">
      <p className="analytics-range-label">Checked {data.checkedAt}</p>
      <p className="admin-alert admin-alert--warning" role="note">
        API error-rate, cache, and ingest metrics cover the {data.metricsScope.replaceAll('-', ' ')}
        ; latency percentiles separately cover the {data.latencyScope.replaceAll('-', ' ')}. Neither
        scope is a fleet-wide historical total.
      </p>
      <h2>Runtime and data health</h2>
      <MetricGrid
        metrics={[
          { label: 'Service health · dependency-aware', value: data.health },
          { label: '/readyz · MongoDB', value: data.database },
          { label: 'API p50 · rolling 5,000', value: duration(data.requestLatencyMs.p50) },
          { label: 'API p95 · rolling 5,000', value: duration(data.requestLatencyMs.p95) },
          { label: 'API error rate', value: percent(data.errorRate) },
          { label: 'Cache hit rate', value: percent(data.cache.hitRate) },
          { label: 'Pending cache invalidations', value: number(data.cacheInvalidations.pending) },
          { label: 'Failed cache invalidations', value: number(data.cacheInvalidations.failed) },
          {
            label: 'Oldest pending invalidation',
            value:
              data.cacheInvalidations.oldestPendingAgeMs === null
                ? 'None pending'
                : duration(data.cacheInvalidations.oldestPendingAgeMs),
          },
          {
            label: 'Event ingest lag',
            value:
              data.eventIngest.lagMs === null
                ? 'No accepted events'
                : duration(data.eventIngest.lagMs),
          },
          { label: 'Publishes (30 days)', value: number(data.publishesLast30Days) },
        ]}
      />
      <section aria-labelledby="event-ingest-heading">
        <h3 id="event-ingest-heading">Privacy-safe event ingest</h3>
        <MetricGrid
          metrics={[
            { label: 'Accepted', value: number(data.eventIngest.accepted) },
            { label: 'Rejected', value: number(data.eventIngest.rejected) },
            { label: 'Filtered bots', value: number(data.eventIngest.filteredBots) },
          ]}
        />
      </section>
      <section aria-labelledby="jobs-heading">
        <h3 id="jobs-heading">Durable jobs</h3>
        {empty(data.jobs) ? (
          <p className="analytics-empty">No job runs recorded.</p>
        ) : (
          <div className="analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempt</th>
                  <th scope="col">Finished / error</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <tr key={`${job.job}-${job.scheduledFor}-${job.attempt}`}>
                    <th scope="row">{job.job}</th>
                    <td>{job.scheduledFor}</td>
                    <td>{job.status}</td>
                    <td>{job.attempt}</td>
                    <td>{job.finishedAt ?? job.errorCode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="collection-size-heading">
        <h3 id="collection-size-heading">MongoDB collection sizes</h3>
        {empty(data.collections) ? (
          <p className="analytics-empty">Collection statistics are unavailable.</p>
        ) : (
          <div className="analytics-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Storage</th>
                </tr>
              </thead>
              <tbody>
                {data.collections.map((item) => (
                  <tr key={item.name}>
                    <th scope="row">{item.name}</th>
                    <td>{number(item.documents)}</td>
                    <td>{bytes(item.storageBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AdminAnalyticsDashboard() {
  const { admin, logout } = useAdminSession();
  const initialRange = useMemo(() => defaultAnalyticsRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [calculatorSlug, setCalculatorSlug] = useState('');
  const [filterError, setFilterError] = useState<string>();
  const [exporting, setExporting] = useState<AnalyticsExportKind>();
  const [exportError, setExportError] = useState<string>();
  const [auditFilters, setAuditFilters] = useState<AdminAuditFilters>({});
  const auditFilterError =
    auditFilters.actor?.trim() && !/^[a-f\d]{24}$/i.test(auditFilters.actor.trim())
      ? 'Actor ID must be a 24-character MongoDB identifier.'
      : auditFilters.action?.trim() && !/^[a-z0-9.-]{1,120}$/.test(auditFilters.action.trim())
        ? 'Action must contain only lowercase letters, numbers, dots, and hyphens.'
        : undefined;

  const calculatorQuery = useQuery({
    queryKey: ['admin-calculators', 'analytics'],
    queryFn: calculators,
  });
  const calculatorOptions = calculatorQuery.data ?? [];
  const selectedCalculator = calculatorSlug || calculatorOptions[0]?.slug || '';
  const rangeKey = `${range.from}:${range.to}`;
  const overview = useQuery({
    queryKey: ['admin-analytics', 'overview', rangeKey],
    queryFn: () => analyticsOverview(range),
    enabled: activeTab === 'overview',
  });
  const engagement = useQuery({
    queryKey: ['admin-analytics', 'engagement', rangeKey],
    queryFn: () => analyticsEngagement(range),
    enabled: activeTab === 'engagement',
  });
  const funnel = useQuery({
    queryKey: ['admin-analytics', 'funnel', selectedCalculator, rangeKey],
    queryFn: () => analyticsFunnel(selectedCalculator, range),
    enabled: activeTab === 'engagement' && Boolean(selectedCalculator),
  });
  const scores = useQuery({
    queryKey: ['admin-analytics', 'scores', selectedCalculator, rangeKey],
    queryFn: () => analyticsScores(selectedCalculator, range),
    enabled: activeTab === 'assessments' && Boolean(selectedCalculator),
  });
  const leads = useQuery({
    queryKey: ['admin-analytics', 'leads', rangeKey],
    queryFn: () => analyticsLeads(range),
    enabled: activeTab === 'leads',
  });
  const security = useQuery({
    queryKey: ['admin-analytics', 'security', rangeKey],
    queryFn: () => analyticsSecurity(range),
    enabled: activeTab === 'security',
  });
  const audit = useQuery({
    queryKey: ['admin-audit', auditFilters],
    queryFn: () =>
      auditRecords({
        ...auditFilters,
        actor: auditFilters.actor?.trim() || undefined,
        action: auditFilters.action?.trim() || undefined,
        slug: auditFilters.slug || undefined,
      }),
    enabled: activeTab === 'security' && admin?.role === 'admin' && !auditFilterError,
  });
  const operations = useQuery({
    queryKey: ['admin-analytics', 'operations'],
    queryFn: analyticsOperations,
    enabled: activeTab === 'operations',
    refetchInterval: 60_000,
  });

  function applyRange() {
    setFilterError(undefined);
    const fromTime = Date.parse(`${draftRange.from}T00:00:00.000Z`);
    const toTime = Date.parse(`${draftRange.to}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draftRange.from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draftRange.to) ||
      !Number.isFinite(fromTime) ||
      !Number.isFinite(toTime) ||
      draftRange.from > draftRange.to
    ) {
      setFilterError('Choose a valid start date on or before the end date.');
      return;
    }
    if ((toTime - fromTime) / 86_400_000 > 366) {
      setFilterError('Choose a reporting window of 367 days or fewer.');
      return;
    }
    setRange(draftRange);
  }

  async function download(kind: AnalyticsExportKind) {
    setExportError(undefined);
    setExporting(kind);
    try {
      const file = await downloadAnalyticsExport(
        kind,
        range,
        kind === 'assessments' ? selectedCalculator : undefined,
      );
      triggerDownload(file.blob, file.filename);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'The CSV export failed.');
    } finally {
      setExporting(undefined);
    }
  }

  const needsCalculator = activeTab === 'engagement' || activeTab === 'assessments';
  const reportingTimezone =
    overview.data?.range.timezone ??
    engagement.data?.range.timezone ??
    scores.data?.range.timezone ??
    leads.data?.range.timezone ??
    security.data?.range.timezone ??
    process.env.NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE ??
    'Asia/Kolkata';
  return (
    <main className="admin-shell analytics-dashboard" id="main-content">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">Privacy-safe aggregate reporting</p>
          <h1>Analytics dashboard</h1>
        </div>
        <div className="admin-session-summary">
          <Link className="admin-secondary-button" href="/admin">
            Calculator Studio
          </Link>
          <span>{admin?.email}</span>
          <span className="admin-role-chip">{admin?.role}</span>
          <button className="admin-secondary-button" onClick={() => void logout()} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="analytics-filters" aria-labelledby="analytics-filters-heading">
        <div>
          <h2 id="analytics-filters-heading">Reporting window</h2>
          <p className="muted">
            Dates are inclusive. The API applies its configured reporting timezone and labels every
            response.
          </p>
        </div>
        <label className="admin-field">
          <span>From</span>
          <input
            type="date"
            value={draftRange.from}
            onChange={(event) =>
              setDraftRange((current) => ({ ...current, from: event.currentTarget.value }))
            }
          />
        </label>
        <label className="admin-field">
          <span>To</span>
          <input
            type="date"
            value={draftRange.to}
            onChange={(event) =>
              setDraftRange((current) => ({ ...current, to: event.currentTarget.value }))
            }
          />
        </label>
        <div className="admin-field analytics-timezone">
          <span>Reporting timezone · server-owned</span>
          <output>{reportingTimezone}</output>
        </div>
        {needsCalculator ? (
          <label className="admin-field">
            <span>Calculator</span>
            <select
              aria-label="Calculator"
              value={selectedCalculator}
              onChange={(event) => setCalculatorSlug(event.currentTarget.value)}
              disabled={calculatorQuery.isPending || !calculatorOptions.length}
            >
              {calculatorOptions.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name} ({item.slug})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="admin-primary-button" onClick={applyRange} type="button">
          Apply dates
        </button>
      </section>
      {filterError ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {filterError}
        </p>
      ) : null}
      {exportError ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {exportError}
        </p>
      ) : null}
      {needsCalculator && calculatorQuery.isError ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {calculatorQuery.error instanceof Error
            ? calculatorQuery.error.message
            : 'Calculator filters could not be loaded.'}
        </p>
      ) : null}

      <nav className="analytics-tabs" aria-label="Analytics sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="admin-panel analytics-content" aria-live="polite">
        {activeTab === 'overview' ? (
          <QueryState pending={overview.isPending} error={overview.error}>
            {overview.data ? <OverviewPanel data={overview.data} /> : null}
          </QueryState>
        ) : null}
        {activeTab === 'engagement' ? (
          !selectedCalculator && !calculatorQuery.isPending ? (
            <p className="analytics-empty">
              No calculator identity is available for funnel reporting.
            </p>
          ) : (
            <QueryState
              pending={engagement.isPending || (Boolean(selectedCalculator) && funnel.isPending)}
              error={engagement.error ?? funnel.error}
            >
              {engagement.data ? (
                <EngagementPanel data={engagement.data} funnel={funnel.data} />
              ) : null}
            </QueryState>
          )
        ) : null}
        {activeTab === 'assessments' ? (
          !selectedCalculator && !calculatorQuery.isPending ? (
            <p className="analytics-empty">
              No calculator identity is available for assessment reporting.
            </p>
          ) : (
            <QueryState pending={scores.isPending} error={scores.error}>
              {scores.data ? (
                <AssessmentPanel
                  data={scores.data}
                  exporting={exporting === 'assessments'}
                  canExport={admin?.role === 'admin'}
                  onExport={() => void download('assessments')}
                />
              ) : null}
            </QueryState>
          )
        ) : null}
        {activeTab === 'leads' ? (
          <QueryState pending={leads.isPending} error={leads.error}>
            {leads.data ? (
              <LeadsPanel
                data={leads.data}
                exporting={exporting === 'leads'}
                canExport={admin?.role === 'admin'}
                onExport={() => void download('leads')}
              />
            ) : null}
          </QueryState>
        ) : null}
        {activeTab === 'security' ? (
          <QueryState pending={security.isPending} error={security.error}>
            {security.data ? (
              <SecurityPanel
                data={security.data}
                canViewAudit={admin?.role === 'admin'}
                audit={audit.data}
                auditPending={audit.isPending && admin?.role === 'admin'}
                auditError={audit.error}
                auditFilterError={auditFilterError}
                auditFilters={auditFilters}
                calculatorOptions={calculatorOptions}
                onAuditFilterChange={setAuditFilters}
              />
            ) : null}
          </QueryState>
        ) : null}
        {activeTab === 'operations' ? (
          <QueryState pending={operations.isPending} error={operations.error}>
            {operations.data ? <OperationsPanel data={operations.data} /> : null}
          </QueryState>
        ) : null}
      </section>
    </main>
  );
}
