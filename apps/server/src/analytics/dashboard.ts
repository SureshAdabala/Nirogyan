import type {
  AnalyticsEngagementResponse,
  AnalyticsFunnelResponse,
  AnalyticsLeadsResponse,
  AnalyticsOpsResponse,
  AnalyticsOverviewResponse,
  AnalyticsRankedValue,
  AnalyticsScoresResponse,
  AnalyticsSecurityResponse,
  AnalyticsWindowSummary,
} from '@niro/contracts';
import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

import { estimateIdentitySketch, mergeIdentitySketches } from './hll';
import { OperationalMetrics } from './metrics';
import { addReportingDays, enumerateReportingDays, reportingDay, reportingDayBounds } from './time';
import type { AnalyticsDailyRollup } from './rollup';
import { decodeAnalyticsDimension, decodeScoreBucket } from './rollup';
import { requireAdmin, type AuthenticatedRequest } from '../auth/http';
import type { AuthService } from '../auth/service';
import { AdminUserModel } from '../persistence/models/admin-user';
import { AnalyticsDailyModel } from '../persistence/models/analytics-daily';
import { AnalyticsEventModel } from '../persistence/models/analytics-event';
import { AssessmentModel } from '../persistence/models/assessment';
import { AuditLogModel } from '../persistence/models/audit-log';
import { CacheInvalidationEventModel } from '../persistence/models/cache-invalidation-event';
import { JobRunModel } from '../persistence/models/job-run';
import { LeadModel } from '../persistence/models/lead';
import { LoginAttemptModel } from '../persistence/models/login-attempt';
import { ResultModel } from '../persistence/models/result';

type CountMap = Record<string, number>;

function emptyDashboardMap(): CountMap {
  return Object.create(null) as CountMap;
}

interface DateRange {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  readonly start: Date;
  readonly end: Date;
}

export class AnalyticsQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsQueryError';
  }
}

function parseRange(
  request: Request,
  timezone: string,
  now: Date,
  defaultDays = 30,
  allowedExtraQuery: readonly string[] = [],
): DateRange {
  const unknown = Object.keys(request.query).filter(
    (key) => !['from', 'to', ...allowedExtraQuery].includes(key),
  );
  if (unknown.length > 0) throw new AnalyticsQueryError('unsupported query field');
  for (const key of ['from', 'to'] as const) {
    if (key in request.query && typeof request.query[key] !== 'string') {
      throw new AnalyticsQueryError(`${key} must be supplied exactly once`);
    }
  }
  const to = typeof request.query.to === 'string' ? request.query.to : reportingDay(now, timezone);
  const from =
    typeof request.query.from === 'string'
      ? request.query.from
      : addReportingDays(to, -(defaultDays - 1));
  try {
    enumerateReportingDays(from, to);
  } catch (error) {
    throw new AnalyticsQueryError(error instanceof Error ? error.message : 'Invalid date range.');
  }
  const { start } = reportingDayBounds(from, timezone);
  const { end } = reportingDayBounds(to, timezone);
  return { from, to, timezone, start, end };
}

function validateSlug(value: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) {
    throw new AnalyticsQueryError('calculator slug is invalid');
  }
  return value;
}

function addMaps(target: CountMap, source: unknown): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return;
  for (const [key, raw] of Object.entries(source as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      target[key] = (target[key] ?? 0) + raw;
    }
  }
}

function ranked(source: CountMap, limit = 20, minimumCount = 1): AnalyticsRankedValue[] {
  return Object.entries(source)
    .filter(([, count]) => count >= minimumCount)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, limit);
}

function rankedDimensions(source: CountMap, limit = 20, minimumCount = 1): AnalyticsRankedValue[] {
  return ranked(source, limit, minimumCount).map((item) => ({
    key: decodeAnalyticsDimension(item.key),
    count: item.count,
  }));
}

function orderedStepCounts(source: CountMap): AnalyticsRankedValue[] {
  return Object.entries(source)
    .map(([encoded, count]) => {
      const decoded = decodeAnalyticsDimension(encoded);
      const separator = decoded.indexOf('\u0000');
      return {
        order: separator >= 0 ? Number(decoded.slice(0, separator)) : Number.MAX_SAFE_INTEGER,
        key: separator >= 0 ? decoded.slice(separator + 1) : decoded,
        count,
      };
    })
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
    .map(({ key, count }) => ({ key, count }));
}

function largestStepDrop(source: CountMap, completions: number): string | undefined {
  const steps = orderedStepCounts(source);
  let selected: string | undefined;
  let largest = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];
    if (!current) continue;
    const next = steps[index + 1]?.count ?? completions;
    const drop = current.count - next;
    if (drop > largest) {
      largest = drop;
      selected = current.key;
    }
  }
  return selected;
}

function sum(records: readonly AnalyticsDailyRollup[], key: keyof AnalyticsDailyRollup): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

function productRecordKey(record: AnalyticsDailyRollup): string {
  return `${record.day}\u0000${record.scopeKey}`;
}

/**
 * Identity policy/key rotations can create multiple rollup partitions for one
 * day. Product persistence metrics are repeated in those partitions, so select
 * one deterministic, most-recent copy per day/scope before summing them.
 */
function canonicalProductRecords(records: readonly AnalyticsDailyRollup[]): AnalyticsDailyRollup[] {
  const selected = new Map<string, AnalyticsDailyRollup>();
  for (const record of records) {
    const key = productRecordKey(record);
    const prior = selected.get(key);
    const priorTime = prior?.rolledUpAt ? new Date(prior.rolledUpAt).getTime() : 0;
    const nextTime = record.rolledUpAt ? new Date(record.rolledUpAt).getTime() : 0;
    if (
      !prior ||
      nextTime > priorTime ||
      (nextTime === priorTime &&
        `${record.identityBasis}:${record.identityKeyVersion}`.localeCompare(
          `${prior.identityBasis}:${prior.identityKeyVersion}`,
        ) > 0)
    ) {
      selected.set(key, record);
    }
  }
  return [...selected.values()];
}

function productSum(
  records: readonly AnalyticsDailyRollup[],
  key: 'assessments' | 'results' | 'leads',
): number {
  return sum(canonicalProductRecords(records), key);
}

function uniqueEstimate(records: readonly AnalyticsDailyRollup[]): number {
  const partitions = new Map<string, AnalyticsDailyRollup[]>();
  for (const record of records) {
    const key = `${record.identityBasis ?? 'legacy'}:${record.identityKeyVersion ?? 'legacy'}`;
    const partition = partitions.get(key) ?? [];
    partition.push(record);
    partitions.set(key, partition);
  }
  let estimate = 0;
  for (const partition of partitions.values()) {
    const sketches = partition
      .map((record) => record.identitySketch)
      .filter((sketch) => Array.isArray(sketch) && sketch.length === 64);
    estimate +=
      sketches.length > 0
        ? estimateIdentitySketch(mergeIdentitySketches(sketches))
        : sum(partition, 'visitors');
  }
  return estimate;
}

function summary(
  globalRecords: readonly AnalyticsDailyRollup[],
  calculatorRecords: readonly AnalyticsDailyRollup[],
): AnalyticsWindowSummary {
  const canonicalCalculators = canonicalProductRecords(calculatorRecords);
  const calculatorResults = new Map<string, number>();
  for (const record of canonicalCalculators) {
    if (record.calculatorSlug) {
      calculatorResults.set(
        record.calculatorSlug,
        (calculatorResults.get(record.calculatorSlug) ?? 0) + record.results,
      );
    }
  }
  const topCalculator = [...calculatorResults].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0]?.[0];
  return {
    visitors: uniqueEstimate(globalRecords),
    sessions: sum(globalRecords, 'sessions'),
    assessments: productSum(globalRecords, 'assessments'),
    results: productSum(globalRecords, 'results'),
    leads: productSum(globalRecords, 'leads'),
    topCalculator,
  };
}

function asRollup(value: unknown): AnalyticsDailyRollup {
  return value as AnalyticsDailyRollup;
}

export interface AnalyticsDashboardOptions {
  readonly timezone: string;
  readonly visitorPersistenceEnabled: boolean;
  readonly identityKeyVersion: string;
  readonly minimumCohortSize: number;
  readonly now?: () => Date;
  readonly metrics: OperationalMetrics;
  readonly databaseReady: () => boolean;
  readonly securityEvidence?: (
    domain: 'network' | 'account' | 'network-label',
    value: string,
  ) => string;
}

export class AnalyticsDashboardService {
  private readonly now: () => Date;

  constructor(private readonly options: AnalyticsDashboardOptions) {
    this.now = options.now ?? (() => new Date());
  }

  private async daily(from: string, to: string): Promise<AnalyticsDailyRollup[]> {
    const stored = (await AnalyticsDailyModel.find({
      day: { $gte: from, $lte: to },
      timezone: this.options.timezone,
    }).lean()) as unknown as AnalyticsDailyRollup[];
    // Dashboard panels consume only durable materialized rows. A request must
    // never trigger a full event/result/assessment scan. The separately scoped
    // active-session query below is the only bounded live-window read.
    return stored.map(asRollup);
  }

  async overview(request: Request): Promise<AnalyticsOverviewResponse> {
    const now = this.now();
    const range = parseRange(request, this.options.timezone, now, 90);
    const earliest =
      range.from < addReportingDays(range.to, -29) ? range.from : addReportingDays(range.to, -29);
    const records = await this.daily(earliest, range.to);
    const global = records.filter((record) => record.scope === 'global');
    const calculators = records.filter((record) => record.scope === 'calculator');
    const window = (days: number) => {
      const start = addReportingDays(range.to, -(days - 1));
      return {
        global: global.filter((record) => record.day >= start && record.day <= range.to),
        calculators: calculators.filter((record) => record.day >= start && record.day <= range.to),
      };
    };
    const today = window(1);
    const seven = window(7);
    const thirty = window(30);
    const growthRecords = global.filter(
      (record) => record.day >= range.from && record.day <= range.to,
    );
    const thirtyUnique = uniqueEstimate(thirty.global);
    const visitorRecords = thirty.global.filter((record) => record.identityBasis === 'visitor');
    const newVisitors = sum(visitorRecords, 'newVisitors');
    const returningVisitors = Math.max(0, uniqueEstimate(visitorRecords) - newVisitors);
    const identityBases = new Set(global.map((record) => record.identityBasis));
    const identityKeys = new Set(global.map((record) => record.identityKeyVersion));
    const identityBasis =
      identityBases.size > 1
        ? 'mixed'
        : (identityBases.values().next().value ??
          (this.options.visitorPersistenceEnabled ? 'visitor' : 'session'));
    const partitionNotice =
      identityBases.size > 1 || identityKeys.size > 1
        ? ' Identity policy/key rotations are kept in separate sketches and summed as a conservative upper-bound estimate; sketches are never merged across keys or identity classes.'
        : '';
    const liveSince = new Date(now.getTime() - 5 * 60_000);
    const liveSessions = await AnalyticsEventModel.distinct('sessionIdHash', {
      occurredAt: { $gte: liveSince, $lte: now },
      expiresAt: { $gt: now },
    });
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      identityBasis,
      identityNotice:
        (identityBasis === 'visitor'
          ? 'Window unique counts are HLL estimates over approved retention-window pseudonymous visitors.'
          : identityBasis === 'session'
            ? 'Persistent visitor analytics is disabled for this data; window unique counts are HLL session estimates and new/returning is unavailable.'
            : 'The range spans visitor and session identity policies; unique counts are HLL estimates and new/returning covers visitor-policy rows only.') +
        partitionNotice,
      today: summary(today.global, today.calculators),
      sevenDays: summary(seven.global, seven.calculators),
      thirtyDays: summary(thirty.global, thirty.calculators),
      active: {
        dau: uniqueEstimate(today.global),
        wau: uniqueEstimate(seven.global),
        mau: thirtyUnique,
      },
      newVsReturning:
        identityBasis === 'session'
          ? { new: 0, returning: 0 }
          : { new: newVisitors, returning: returningVisitors },
      liveNow: liveSessions.length,
      growth: enumerateReportingDays(range.from, range.to).map((day) => {
        const dayRecords = growthRecords.filter((candidate) => candidate.day === day);
        return {
          day,
          visitors: uniqueEstimate(dayRecords),
          sessions: sum(dayRecords, 'sessions'),
          assessments: productSum(dayRecords, 'assessments'),
          results: productSum(dayRecords, 'results'),
          leads: productSum(dayRecords, 'leads'),
        };
      }),
    };
  }

  async engagement(request: Request): Promise<AnalyticsEngagementResponse> {
    const range = parseRange(request, this.options.timezone, this.now());
    const records = await this.daily(range.from, range.to);
    const global = records.filter((record) => record.scope === 'global');
    const calculators = records.filter((record) => record.scope === 'calculator');
    const breakdowns: Record<string, CountMap> = Object.create(null) as Record<string, CountMap>;
    const events: CountMap = emptyDashboardMap();
    for (const record of global) {
      addMaps(events, record.eventCounts);
      for (const [key, values] of Object.entries(record.breakdowns ?? {})) {
        breakdowns[key] ??= emptyDashboardMap();
        addMaps(breakdowns[key] ?? emptyDashboardMap(), values);
      }
    }
    const calculatorMap = new Map<
      string,
      { starts: number; completions: number; stepViews: CountMap }
    >();
    for (const record of calculators) {
      if (!record.calculatorSlug) continue;
      const aggregate = calculatorMap.get(record.calculatorSlug) ?? {
        starts: 0,
        completions: 0,
        stepViews: emptyDashboardMap(),
      };
      aggregate.starts += record.funnel?.calc_start ?? 0;
      aggregate.completions += record.funnel?.result_view ?? 0;
      addMaps(aggregate.stepViews, record.stepViews);
      calculatorMap.set(record.calculatorSlug, aggregate);
    }
    const calculatorsResponse = [...calculatorMap].map(([calculatorSlug, value]) => {
      const dropOffStep = largestStepDrop(value.stepViews, value.completions);
      return {
        calculatorSlug,
        starts: value.starts,
        completions: value.completions,
        completionRate: value.starts ? value.completions / value.starts : 0,
        dropOffStep,
      };
    });
    const sessions = sum(global, 'sessionDurationSamples');
    const resultViewSessions = global.reduce(
      (total, record) => total + (record.funnel?.result_view ?? 0),
      0,
    );
    const retakes = global.reduce((total, record) => total + (record.funnel?.retake ?? 0), 0);
    const searches = rankedDimensions(
      breakdowns.searches ?? emptyDashboardMap(),
      20,
      this.options.minimumCohortSize,
    ).map((item) => {
      const zeroResultKey = Object.keys(breakdowns.zeroResultSearches ?? emptyDashboardMap()).find(
        (key) => decodeAnalyticsDimension(key) === item.key,
      );
      const zeroResults = zeroResultKey
        ? breakdowns.zeroResultSearches?.[zeroResultKey]
        : undefined;
      return {
        ...item,
        zeroResults:
          typeof zeroResults === 'number' && zeroResults >= this.options.minimumCohortSize
            ? zeroResults
            : null,
      };
    });
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      averageSessionDurationMs: sessions ? sum(global, 'sessionDurationTotalMs') / sessions : 0,
      pagesPerSession: sessions ? sum(global, 'pageViews') / sessions : 0,
      calculators: calculatorsResponse.sort(
        (left, right) =>
          right.starts - left.starts || left.calculatorSlug.localeCompare(right.calculatorSlug),
      ),
      pages: rankedDimensions(breakdowns.paths ?? emptyDashboardMap()),
      searches,
      searchPrivacyNotice: `Page-path, search, zero-result, referrer, and UTM source, medium, and campaign cells below ${this.options.minimumCohortSize} distinct sessions are permanently omitted; a null zero-result count means unavailable, not zero.`,
      devices: rankedDimensions(breakdowns.devices ?? emptyDashboardMap()),
      browsers: rankedDimensions(breakdowns.browsers ?? emptyDashboardMap()),
      operatingSystems: rankedDimensions(breakdowns.operatingSystems ?? emptyDashboardMap()),
      locales: rankedDimensions(breakdowns.locales ?? emptyDashboardMap()),
      referrers: rankedDimensions(
        breakdowns.referrers ?? emptyDashboardMap(),
        20,
        this.options.minimumCohortSize,
      ),
      utmSources: rankedDimensions(
        breakdowns.utmSources ?? emptyDashboardMap(),
        20,
        this.options.minimumCohortSize,
      ),
      utmMediums: rankedDimensions(
        breakdowns.utmMediums ?? emptyDashboardMap(),
        20,
        this.options.minimumCohortSize,
      ),
      utmCampaigns: rankedDimensions(
        breakdowns.utmCampaigns ?? breakdowns.campaigns ?? emptyDashboardMap(),
        20,
        this.options.minimumCohortSize,
      ),
      shareOpens: events.share_open ?? 0,
      retakes,
      retakeRate: resultViewSessions ? retakes / resultViewSessions : 0,
    };
  }

  async funnel(request: Request, slugInput: string): Promise<AnalyticsFunnelResponse> {
    const slug = validateSlug(slugInput);
    const range = parseRange(request, this.options.timezone, this.now());
    const records = (await this.daily(range.from, range.to)).filter(
      (record) => record.scope === 'calculator' && record.calculatorSlug === slug,
    );
    const funnel: CountMap = emptyDashboardMap();
    const steps: CountMap = emptyDashboardMap();
    for (const record of records) {
      addMaps(funnel, record.funnel);
      addMaps(steps, record.stepViews);
    }
    const orderedStages = ['page_view', 'calc_start', 'assess_submit', 'result_view'];
    const rankedSteps = orderedStepCounts(steps);
    const starts = funnel.calc_start ?? 0;
    const completions = funnel.result_view ?? 0;
    return {
      calculatorSlug: slug,
      range: { from: range.from, to: range.to, timezone: range.timezone },
      stages: orderedStages.map((stage) => ({ stage, count: funnel[stage] ?? 0 })),
      steps: rankedSteps,
      dropOffStep: largestStepDrop(steps, completions),
      completionRate: starts ? completions / starts : 0,
    };
  }

  async scores(request: Request, slugInput: string): Promise<AnalyticsScoresResponse> {
    const slug = validateSlug(slugInput);
    const range = parseRange(request, this.options.timezone, this.now());
    const allDaily = (await this.daily(range.from, range.to)).filter(
      (record) => record.scope === 'calculator' && record.calculatorSlug === slug,
    );
    const daily = canonicalProductRecords(allDaily);
    const scoreBuckets: CountMap = emptyDashboardMap();
    const categories: CountMap = emptyDashboardMap();
    const omitted: CountMap = emptyDashboardMap();
    const units: CountMap = emptyDashboardMap();
    const versions: CountMap = emptyDashboardMap();
    let computeTotal = 0;
    let computeSamples = 0;
    for (const record of daily) {
      addMaps(scoreBuckets, record.scoreBuckets);
      addMaps(categories, record.categoryCounts);
      addMaps(omitted, record.omittedParameterCounts);
      addMaps(units, record.unitCounts);
      addMaps(versions, record.versionCounts);
      computeTotal += record.computeMsTotal ?? 0;
      computeSamples += record.computeMsSamples ?? 0;
    }
    const sampleSize = productSum(daily, 'results');
    const assessmentSamples = productSum(daily, 'assessments');
    const suppressed =
      sampleSize < this.options.minimumCohortSize ||
      assessmentSamples < this.options.minimumCohortSize;
    const assessmentErrors = allDaily.reduce(
      (total, record) => total + (record.eventCounts?.assess_error ?? 0),
      0,
    );
    const bins = suppressed
      ? []
      : Object.entries(scoreBuckets)
          .filter(([, count]) => count >= this.options.minimumCohortSize)
          .map(([key, count]) => {
            const bounds = decodeScoreBucket(key);
            return bounds
              ? { lowerInclusive: bounds.min, upperExclusive: bounds.max, count }
              : undefined;
          })
          .filter((bin): bin is NonNullable<typeof bin> => bin !== undefined)
          .sort((left, right) => left.lowerInclusive - right.lowerInclusive);
    const categoryTrend = enumerateReportingDays(range.from, range.to).map((day) => {
      const dayRecords = daily.filter((record) => record.day === day);
      const daySampleSize = productSum(dayRecords, 'results');
      const dayAssessmentSamples = productSum(dayRecords, 'assessments');
      const dayCategories = emptyDashboardMap();
      for (const record of dayRecords) addMaps(dayCategories, record.categoryCounts);
      const daySuppressed =
        daySampleSize < this.options.minimumCohortSize ||
        dayAssessmentSamples < this.options.minimumCohortSize;
      return {
        day,
        suppressed: daySuppressed,
        categories: daySuppressed
          ? []
          : rankedDimensions(dayCategories, 20, this.options.minimumCohortSize),
      };
    });
    return {
      calculatorSlug: slug,
      range: { from: range.from, to: range.to, timezone: range.timezone },
      suppressed,
      suppressionNotice: suppressed
        ? `Distributions require at least ${this.options.minimumCohortSize} non-expired assessments and results.`
        : `Cells below ${this.options.minimumCohortSize} records may have been permanently omitted from score, category, omission, unit, or version distributions.`,
      sampleSize,
      successfulAssessments: assessmentSamples,
      scoreHistogram: bins,
      categories: suppressed
        ? []
        : rankedDimensions(categories, 20, this.options.minimumCohortSize),
      categoryTrend,
      omittedParameters: suppressed
        ? []
        : rankedDimensions(omitted, 20, this.options.minimumCohortSize),
      units: suppressed ? [] : rankedDimensions(units, 20, this.options.minimumCohortSize),
      averageComputeMs: !suppressed && computeSamples ? computeTotal / computeSamples : 0,
      versionAdoption: suppressed
        ? []
        : rankedDimensions(versions, 20, this.options.minimumCohortSize),
      assessmentErrors,
      assessmentErrorRate:
        assessmentSamples + assessmentErrors > 0
          ? assessmentErrors / (assessmentSamples + assessmentErrors)
          : 0,
      assessmentErrorRateBasis: 'client-telemetry-observed-v1',
    };
  }

  async leads(request: Request): Promise<AnalyticsLeadsResponse> {
    const range = parseRange(request, this.options.timezone, this.now());
    const allDaily = (await this.daily(range.from, range.to)).filter(
      (record) => record.scope === 'global',
    );
    const daily = canonicalProductRecords(allDaily);
    const total = productSum(daily, 'leads');
    const resultViews = allDaily.reduce(
      (count, record) => count + (record.eventCounts?.result_view ?? 0),
      0,
    );
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      total,
      resultViews,
      conversionRate: resultViews ? total / resultViews : 0,
      trend: enumerateReportingDays(range.from, range.to).map((day) => ({
        day,
        leads: productSum(
          daily.filter((record) => record.day === day),
          'leads',
        ),
      })),
      calculatorAttribution: 'unavailable-unlinked-v1',
    };
  }

  async security(request: Request): Promise<AnalyticsSecurityResponse> {
    const now = this.now();
    const range = parseRange(request, this.options.timezone, now);
    // Mongo TTL cleanup is asynchronous. Enforce the 90-day login-attempt
    // retention window logically so lagging TTL deletes never affect reports.
    const loginRetentionStart = new Date(now.getTime() - 90 * 86_400_000);
    const attemptStart = range.start > loginRetentionStart ? range.start : loginRetentionStart;
    const [attempts, audit, activeLockouts] = await Promise.all([
      LoginAttemptModel.find({ createdAt: { $gte: attemptStart, $lt: range.end } })
        .select('+email +accountHash ipHash success createdAt')
        .lean(),
      AuditLogModel.find({
        createdAt: { $gte: range.start, $lt: range.end },
        action: { $in: ['admin.login', 'admin.logout'] },
      })
        .select('actorId action createdAt')
        .lean(),
      AdminUserModel.countDocuments({ lockedUntil: { $gt: now } }),
    ]);
    const failedTrend: CountMap = emptyDashboardMap();
    const failedAccounts: CountMap = emptyDashboardMap();
    const failedNetworks: CountMap = emptyDashboardMap();
    for (const attempt of attempts) {
      if (!attempt.success) {
        incrementMap(failedTrend, reportingDay(attempt.createdAt, range.timezone));
        if (this.options.securityEvidence) {
          const accountEvidence =
            attempt.accountHash ??
            (attempt.email ? this.options.securityEvidence('account', attempt.email) : undefined);
          if (accountEvidence) {
            incrementMap(
              failedAccounts,
              this.options.securityEvidence('account', accountEvidence).slice(0, 15),
            );
          }
          if (attempt.ipHash) {
            incrementMap(
              failedNetworks,
              this.options.securityEvidence('network-label', attempt.ipHash).slice(0, 15),
            );
          }
        }
      }
    }
    const activity = await AuditLogModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      actions: number;
      lastActivityAt: Date;
    }>([
      { $match: { createdAt: { $gte: range.start, $lt: range.end }, actorId: { $exists: true } } },
      { $group: { _id: '$actorId', actions: { $sum: 1 }, lastActivityAt: { $max: '$createdAt' } } },
      { $sort: { actions: -1 } },
      { $limit: 20 },
    ]);
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      successfulLogins: attempts.filter((attempt) => attempt.success).length,
      failedLogins: attempts.filter((attempt) => !attempt.success).length,
      logouts: audit.filter((record) => record.action === 'admin.logout').length,
      activeLockouts,
      rateLimitTrips: this.options.metrics.snapshot().publicRateLimitTrips,
      rateLimitScope: 'public-endpoints-current-instance-since-start',
      failedLoginTrend: enumerateReportingDays(range.from, range.to).map((day) => ({
        day,
        count: failedTrend[day] ?? 0,
      })),
      failedAttemptGroups: [
        ...ranked(failedAccounts).map((item) => ({
          kind: 'account' as const,
          label: `account-${item.key}`,
          count: item.count,
        })),
        ...ranked(failedNetworks).map((item) => ({
          kind: 'network' as const,
          label: `network-${item.key}`,
          count: item.count,
        })),
      ],
      adminActivity: activity.map((record) => ({
        actorId: record._id.toString(),
        actions: record.actions,
        lastActivityAt: record.lastActivityAt.toISOString(),
      })),
    };
  }

  async ops(): Promise<AnalyticsOpsResponse> {
    const now = this.now();
    const snapshot = this.options.metrics.snapshot();
    const [
      latestEvent,
      jobs,
      publishesLast30Days,
      invalidationCounts,
      oldestPending,
      events,
      daily,
      assessments,
      results,
      leads,
    ] = await Promise.all([
      AnalyticsEventModel.findOne({ expiresAt: { $gt: now } })
        .sort({ occurredAt: -1 })
        .select('occurredAt')
        .lean(),
      JobRunModel.find().sort({ scheduledFor: -1 }).limit(20).lean(),
      AuditLogModel.countDocuments({
        action: { $in: ['calculator.version.publish', 'calculator.version.publish.rollback'] },
        createdAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) },
      }),
      CacheInvalidationEventModel.aggregate<{ _id: 'pending' | 'failed'; count: number }>([
        { $match: { status: { $in: ['pending', 'failed'] }, expiresAt: { $gt: now } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      CacheInvalidationEventModel.findOne({ status: 'pending', expiresAt: { $gt: now } })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean(),
      AnalyticsEventModel.countDocuments({ expiresAt: { $gt: now } }),
      AnalyticsDailyModel.estimatedDocumentCount(),
      AssessmentModel.countDocuments({ expiresAt: { $gt: now } }),
      ResultModel.countDocuments({ expiresAt: { $gt: now } }),
      LeadModel.countDocuments({ expiresAt: { $gt: now } }),
    ]);
    const collectionNames = [
      'analytics_events',
      'analytics_daily',
      'assessments',
      'results',
      'leads',
    ] as const;
    const storage = new Map<string, number | null>(
      await Promise.all(
        collectionNames.map(async (name) => {
          try {
            const stats = await mongoose.connection.db?.command({ collStats: name, scale: 1 });
            return [
              name,
              typeof stats?.storageSize === 'number' ? stats.storageSize : null,
            ] as const;
          } catch {
            // Some managed-database roles intentionally deny collStats. Counts
            // remain available and the nullable DTO reports that limitation.
            return [name, null] as const;
          }
        }),
      ),
    );
    return {
      checkedAt: now.toISOString(),
      health: this.options.databaseReady() ? 'ok' : 'degraded',
      metricsScope: 'current-instance-since-start',
      latencyScope: 'current-instance-rolling-last-5000',
      database: this.options.databaseReady() ? 'ready' : 'not-ready',
      requestLatencyMs: snapshot.requestLatencyMs,
      errorRate: snapshot.errorRate,
      cache: snapshot.cache,
      cacheInvalidations: {
        pending: invalidationCounts.find((item) => item._id === 'pending')?.count ?? 0,
        failed: invalidationCounts.find((item) => item._id === 'failed')?.count ?? 0,
        oldestPendingAgeMs: oldestPending
          ? Math.max(0, now.getTime() - oldestPending.createdAt.getTime())
          : null,
      },
      eventIngest: {
        accepted: snapshot.eventIngest.accepted,
        rejected: snapshot.eventIngest.rejected,
        filteredBots: snapshot.eventIngest.filteredBots,
        lagMs: latestEvent ? Math.max(0, now.getTime() - latestEvent.occurredAt.getTime()) : null,
      },
      publishesLast30Days,
      jobs: jobs.map((job) => ({
        job: job.job,
        scheduledFor: job.scheduledFor.toISOString(),
        status: job.status,
        attempt: job.attempt,
        startedAt: job.startedAt?.toISOString(),
        finishedAt: job.finishedAt?.toISOString(),
        errorCode: job.errorCode,
      })),
      collections: [
        {
          name: 'analytics_events',
          documents: events,
          storageBytes: storage.get('analytics_events') ?? null,
        },
        {
          name: 'analytics_daily',
          documents: daily,
          storageBytes: storage.get('analytics_daily') ?? null,
        },
        {
          name: 'assessments',
          documents: assessments,
          storageBytes: storage.get('assessments') ?? null,
        },
        { name: 'results', documents: results, storageBytes: storage.get('results') ?? null },
        { name: 'leads', documents: leads, storageBytes: storage.get('leads') ?? null },
      ],
    };
  }

  range(request: Request): DateRange {
    return parseRange(request, this.options.timezone, this.now());
  }

  rangeWithCalculator(request: Request): DateRange {
    return parseRange(request, this.options.timezone, this.now(), 30, ['calculator']);
  }
}

function incrementMap(target: CountMap, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function csvCell(value: unknown): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? '');
  if (/^[\t\r]|^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function formatAnalyticsCsv(rows: readonly (readonly unknown[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function sendCsv(response: Response, filename: string, rows: readonly unknown[][]): void {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.send(formatAnalyticsCsv(rows));
}

export function createAdminAnalyticsRouter(
  authService: AuthService | undefined,
  options: AnalyticsDashboardOptions,
): Router {
  const router = Router();
  const service = new AnalyticsDashboardService({
    ...options,
    securityEvidence: authService?.securityEvidence,
  });
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  if (!authService) {
    router.use((_request, response) => {
      response.status(503).json({
        error: { code: 'AUTH_NOT_CONFIGURED', message: 'Admin authentication is not configured.' },
      });
    });
    return router;
  }
  router.use(requireAdmin(authService, ['admin', 'editor']));

  const handle =
    (work: (request: Request) => Promise<unknown>) =>
    async (request: Request, response: Response, next: (error?: unknown) => void) => {
      try {
        response.json({ data: await work(request) });
      } catch (error) {
        if (error instanceof AnalyticsQueryError) {
          response.status(422).json({ error: { code: 'INVALID_QUERY', message: error.message } });
          return;
        }
        next(error);
      }
    };

  router.get(
    '/overview',
    handle((request) => service.overview(request)),
  );
  router.get(
    '/engagement',
    handle((request) => service.engagement(request)),
  );
  router.get(
    '/funnel/:slug',
    handle((request) =>
      service.funnel(request, typeof request.params.slug === 'string' ? request.params.slug : ''),
    ),
  );
  router.get(
    '/scores/:slug',
    handle((request) =>
      service.scores(request, typeof request.params.slug === 'string' ? request.params.slug : ''),
    ),
  );
  router.get(
    '/leads',
    handle((request) => service.leads(request)),
  );
  router.get(
    '/security',
    handle((request) => service.security(request)),
  );
  router.get(
    '/ops',
    handle((request) => {
      if (Object.keys(request.query).length > 0)
        throw new AnalyticsQueryError('unsupported query field');
      return service.ops();
    }),
  );
  router.get('/metrics', async (request, response, next) => {
    try {
      if (Object.keys(request.query).length > 0) {
        response.status(422).json({
          error: { code: 'INVALID_QUERY', message: 'unsupported query field' },
        });
        return;
      }
      response.setHeader('Content-Type', options.metrics.registry.contentType);
      response.send(await options.metrics.registry.metrics());
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/exports/leads.csv',
    requireAdmin(authService, ['admin']),
    async (request, response, next) => {
      try {
        const range = service.range(request);
        const records = await LeadModel.find({
          createdAt: { $gte: range.start, $lt: range.end },
          expiresAt: { $gt: new Date() },
        })
          .select('createdAt email consentVersion expiresAt')
          .sort({ createdAt: 1 })
          .limit(100_001)
          .lean();
        if (records.length > 100_000) {
          response.status(413).json({
            error: {
              code: 'EXPORT_TOO_LARGE',
              message: 'Export exceeds 100000 rows; request a narrower date range.',
            },
          });
          return;
        }
        await AuditLogModel.create({
          actorId: new mongoose.Types.ObjectId((request as AuthenticatedRequest).admin?.id),
          action: 'analytics.export.leads',
          entityType: 'AnalyticsExport',
          entityId: `${range.from}:${range.to}`,
          diffSummary: { from: range.from, to: range.to, count: records.length },
        });
        sendCsv(response, `niro-leads-${range.from}-${range.to}.csv`, [
          ['createdAt', 'email', 'consentVersion', 'expiresAt'],
          ...records.map((record) => [
            record.createdAt,
            record.email,
            record.consentVersion,
            record.expiresAt,
          ]),
        ]);
      } catch (error) {
        if (error instanceof AnalyticsQueryError) {
          response.status(422).json({ error: { code: 'INVALID_QUERY', message: error.message } });
          return;
        }
        next(error);
      }
    },
  );
  router.get(
    '/exports/assessments.csv',
    requireAdmin(authService, ['admin']),
    async (request, response, next) => {
      try {
        const range = service.rangeWithCalculator(request);
        const calculatorQuery = request.query.calculator;
        if (calculatorQuery !== undefined && typeof calculatorQuery !== 'string') {
          throw new AnalyticsQueryError('calculator must be supplied exactly once');
        }
        const calculator = calculatorQuery ? validateSlug(calculatorQuery) : undefined;
        const records = await AssessmentModel.find({
          createdAt: { $gte: range.start, $lt: range.end },
          expiresAt: { $gt: new Date() },
          ...(calculator ? { calculatorSlug: calculator } : {}),
        })
          .select('createdAt calculatorSlug calculatorVersion omittedParameters')
          .sort({ createdAt: 1 })
          .limit(100_001)
          .lean();
        if (records.length > 100_000) {
          response.status(413).json({
            error: {
              code: 'EXPORT_TOO_LARGE',
              message: 'Export exceeds 100000 rows; request a narrower date range.',
            },
          });
          return;
        }
        await AuditLogModel.create({
          actorId: new mongoose.Types.ObjectId((request as AuthenticatedRequest).admin?.id),
          action: 'analytics.export.assessments',
          entityType: 'AnalyticsExport',
          entityId: `${range.from}:${range.to}`,
          diffSummary: {
            from: range.from,
            to: range.to,
            calculator: calculator ?? 'all',
            count: records.length,
          },
        });
        sendCsv(response, `niro-assessments-${range.from}-${range.to}.csv`, [
          ['createdAt', 'calculatorSlug', 'calculatorVersion', 'omittedParameters'],
          ...records.map((record) => [
            record.createdAt,
            record.calculatorSlug,
            record.calculatorVersion,
            record.omittedParameters.join('|'),
          ]),
        ]);
      } catch (error) {
        if (error instanceof AnalyticsQueryError) {
          response.status(422).json({ error: { code: 'INVALID_QUERY', message: error.message } });
          return;
        }
        next(error);
      }
    },
  );
  return router;
}
