import type { FilterQuery } from 'mongoose';

import { createIdentitySketch } from './hll';
import { reportingDayBounds } from './time';
import { AnalyticsDailyModel } from '../persistence/models/analytics-daily';
import {
  AnalyticsEventModel,
  type AnalyticsEventDocument,
} from '../persistence/models/analytics-event';
import { AnonymousVisitorModel } from '../persistence/models/anonymous-visitor';
import { AssessmentModel } from '../persistence/models/assessment';
import { CalculatorModel } from '../persistence/models/calculator';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { LeadModel } from '../persistence/models/lead';
import { ResultModel } from '../persistence/models/result';

type CountMap = Record<string, number>;
export type AnalyticsRollupEvent = Pick<
  AnalyticsEventDocument,
  | 'type'
  | 'occurredAt'
  | 'visitorIdHash'
  | 'sessionIdHash'
  | 'calculatorSlug'
  | 'path'
  | 'step'
  | 'stepIndex'
  | 'query'
  | 'device'
  | 'browser'
  | 'os'
  | 'locale'
  | 'referrerHost'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'unit'
  | 'zeroResults'
  | 'action'
>;

interface SessionState {
  first: number;
  last: number;
  pages: number;
}

interface Accumulator {
  readonly scope: 'global' | 'calculator';
  readonly calculatorSlug?: string;
  readonly sessions: Set<string>;
  readonly visitors: Set<string>;
  readonly sessionStates: Map<string, SessionState>;
  readonly eventCounts: CountMap;
  readonly funnelSessions: Map<string, Set<string>>;
  readonly stepSessions: Map<string, Set<string>>;
  readonly sensitiveDimensionSessions: Record<string, Map<string, Set<string>>>;
  readonly attributionBySession: Record<string, Map<string, string>>;
  readonly breakdowns: Record<string, CountMap>;
  sourceEventCount: number;
  sourceMaxOccurredAt?: Date;
}

interface AssessmentIntelligence {
  readonly scoreBuckets: CountMap;
  readonly categoryCounts: CountMap;
  readonly omittedParameterCounts: CountMap;
  readonly unitCounts: CountMap;
  readonly versionCounts: CountMap;
  computeMsTotal: number;
  computeMsSamples: number;
}

export interface AnalyticsEventSummary {
  readonly visitors: number;
  readonly sessions: number;
  readonly eventCounts: CountMap;
  readonly sessionDurationTotalMs: number;
  readonly sessionDurationSamples: number;
  readonly pageViews: number;
  readonly breakdowns: Record<string, CountMap>;
  readonly funnel: CountMap;
  readonly stepViews: CountMap;
  readonly sourceEventCount: number;
  readonly sourceMaxOccurredAt?: Date;
}

export interface AnalyticsDailyRollup {
  readonly day: string;
  readonly timezone: string;
  readonly scope: 'global' | 'calculator';
  readonly scopeKey: string;
  readonly calculatorSlug?: string;
  readonly identityBasis: 'visitor' | 'session';
  readonly identityKeyVersion: string;
  readonly minimumCohortSize: number;
  readonly visitors: number;
  readonly sessions: number;
  readonly newVisitors: number;
  readonly returningVisitors: number;
  readonly identitySketch: number[];
  readonly assessments: number;
  readonly results: number;
  readonly leads: number;
  readonly eventCounts: CountMap;
  readonly sessionDurationTotalMs: number;
  readonly sessionDurationSamples: number;
  readonly pageViews: number;
  readonly breakdowns: Record<string, CountMap>;
  readonly funnel: CountMap;
  readonly stepViews: CountMap;
  readonly scoreBuckets: CountMap;
  readonly categoryCounts: CountMap;
  readonly omittedParameterCounts: CountMap;
  readonly unitCounts: CountMap;
  readonly versionCounts: CountMap;
  readonly computeMsTotal: number;
  readonly computeMsSamples: number;
  readonly sourceEventCount: number;
  readonly sourceMaxOccurredAt?: Date;
  readonly sourceRetentionDays?: AnalyticsSourceRetentionDays;
  readonly sourceCompletenessCheckedAt?: Date;
  readonly rolledUpAt: Date;
}

export interface AnalyticsSourceRetentionDays {
  readonly events: number;
  readonly assessments: number;
  readonly leads: number;
  readonly visitors?: number;
}

export class AnalyticsSourceWindowIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsSourceWindowIncompleteError';
  }
}

export function assertAnalyticsSourceWindowComplete(options: {
  readonly day: string;
  readonly timezone: string;
  readonly now: Date;
  readonly visitorPersistenceEnabled: boolean;
  readonly visitorSourceRequired?: boolean;
  readonly retentionDays: AnalyticsSourceRetentionDays;
}): AnalyticsSourceRetentionDays {
  const visitorSourceRequired = options.visitorSourceRequired ?? options.visitorPersistenceEnabled;
  const values = [
    ['events', options.retentionDays.events],
    ['assessments/results', options.retentionDays.assessments],
    ['leads', options.retentionDays.leads],
    ...(visitorSourceRequired ? ([['visitors', options.retentionDays.visitors]] as const) : []),
  ] as const;
  for (const [source, days] of values) {
    if (!Number.isSafeInteger(days) || (days ?? 0) < 1) {
      throw new AnalyticsSourceWindowIncompleteError(
        `${source} retention must be explicitly configured before a permanent analytics rollup can be replaced.`,
      );
    }
  }
  const shortest = Math.min(...values.map(([, days]) => days as number));
  const dayStart = reportingDayBounds(options.day, options.timezone).start;
  const sourceCutoff = new Date(options.now.getTime() - shortest * 86_400_000);
  if (dayStart <= sourceCutoff) {
    throw new AnalyticsSourceWindowIncompleteError(
      `Reporting day ${options.day} starts outside the complete source window (${sourceCutoff.toISOString()}); existing permanent rollups were preserved.`,
    );
  }
  return { ...options.retentionDays };
}

function emptyCountMap(): CountMap {
  return Object.create(null) as CountMap;
}

export function encodeAnalyticsDimension(value: string): string {
  return `v_${Buffer.from(value, 'utf8').toString('base64url')}`;
}

export function decodeAnalyticsDimension(value: string): string {
  if (!value.startsWith('v_')) return value;
  try {
    return Buffer.from(value.slice(2), 'base64url').toString('utf8');
  } catch {
    return '[invalid]';
  }
}

function incrementKnown(target: CountMap, key: string | undefined, amount = 1): void {
  if (!key) return;
  target[key] = (target[key] ?? 0) + amount;
}

function incrementDimension(
  target: CountMap,
  key: string | undefined,
  amount = 1,
  maximumKeys = 200,
): void {
  if (!key) return;
  const encoded = encodeAnalyticsDimension(key);
  if (!(encoded in target) && Object.keys(target).length >= maximumKeys) {
    const other = encodeAnalyticsDimension('[other]');
    target[other] = (target[other] ?? 0) + amount;
    return;
  }
  target[encoded] = (target[encoded] ?? 0) + amount;
}

function retainedCells(source: CountMap, minimumCohortSize: number): CountMap {
  const retained = emptyCountMap();
  for (const [key, count] of Object.entries(source).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (Number.isSafeInteger(count) && count >= minimumCohortSize) retained[key] = count;
  }
  return retained;
}

function privacySafeBreakdowns(
  source: Record<string, CountMap>,
  minimumCohortSize: number,
): Record<string, CountMap> {
  return {
    ...source,
    // Free-text and campaign/referrer dimensions are retained forever in the
    // daily table. Only cohort-sized cells may cross that retention boundary.
    paths: retainedCells(source.paths ?? emptyCountMap(), minimumCohortSize),
    searches: retainedCells(source.searches ?? emptyCountMap(), minimumCohortSize),
    zeroResultSearches: retainedCells(
      source.zeroResultSearches ?? emptyCountMap(),
      minimumCohortSize,
    ),
    referrers: retainedCells(source.referrers ?? emptyCountMap(), minimumCohortSize),
    utmSources: retainedCells(source.utmSources ?? emptyCountMap(), minimumCohortSize),
    utmMediums: retainedCells(source.utmMediums ?? emptyCountMap(), minimumCohortSize),
    utmCampaigns: retainedCells(
      source.utmCampaigns ?? source.campaigns ?? emptyCountMap(),
      minimumCohortSize,
    ),
    units: retainedCells(source.units ?? emptyCountMap(), minimumCohortSize),
  };
}

export interface ScoreScale {
  readonly min: number;
  readonly max: number;
}

function normalizedBoundary(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toPrecision(12));
}

/**
 * Produces self-describing, arbitrary-scale score buckets. Published calculator
 * scale bounds take precedence; legacy/missing-version rows use a magnitude-
 * adaptive fallback instead of assuming a 0..100 score.
 */
export function scoreBucketBounds(score: number, scale?: ScoreScale): ScoreScale | undefined {
  if (!Number.isFinite(score)) return undefined;
  let width: number;
  let anchor: number;
  if (scale && Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.max > scale.min) {
    width = (scale.max - scale.min) / 10;
    anchor = scale.min;
  } else {
    const magnitude = Math.abs(score);
    const exponent = magnitude > 0 ? Math.floor(Math.log10(magnitude)) - 1 : -1;
    width = 10 ** Math.max(-300, Math.min(300, exponent));
    anchor = 0;
  }
  if (!Number.isFinite(width) || width <= 0) return undefined;
  const index = Math.floor((score - anchor) / width);
  const lower = normalizedBoundary(anchor + index * width);
  const upper = normalizedBoundary(anchor + (index + 1) * width);
  return Number.isFinite(lower) && Number.isFinite(upper) && upper > lower
    ? { min: lower, max: upper }
    : undefined;
}

export function encodeScoreBucket(bounds: ScoreScale): string {
  return encodeAnalyticsDimension(JSON.stringify([bounds.min, bounds.max]));
}

export function decodeScoreBucket(value: string): ScoreScale | undefined {
  try {
    const decoded = JSON.parse(decodeAnalyticsDimension(value)) as unknown;
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      !decoded.every((item) => typeof item === 'number' && Number.isFinite(item)) ||
      decoded[1] <= decoded[0]
    )
      return undefined;
    return { min: decoded[0], max: decoded[1] };
  } catch {
    return undefined;
  }
}

function createAccumulator(scope: Accumulator['scope'], calculatorSlug?: string): Accumulator {
  return {
    scope,
    calculatorSlug,
    sessions: new Set(),
    visitors: new Set(),
    sessionStates: new Map(),
    eventCounts: emptyCountMap(),
    funnelSessions: new Map(),
    stepSessions: new Map(),
    sensitiveDimensionSessions: {
      paths: new Map(),
      searches: new Map(),
      zeroResultSearches: new Map(),
      referrers: new Map(),
      utmSources: new Map(),
      utmMediums: new Map(),
      utmCampaigns: new Map(),
      devices: new Map(),
      browsers: new Map(),
      operatingSystems: new Map(),
      locales: new Map(),
      units: new Map(),
    },
    attributionBySession: {
      referrers: new Map(),
      utmSources: new Map(),
      utmMediums: new Map(),
      utmCampaigns: new Map(),
    },
    breakdowns: {
      paths: emptyCountMap(),
      searches: emptyCountMap(),
      zeroResultSearches: emptyCountMap(),
      devices: emptyCountMap(),
      browsers: emptyCountMap(),
      operatingSystems: emptyCountMap(),
      locales: emptyCountMap(),
      referrers: emptyCountMap(),
      utmSources: emptyCountMap(),
      utmMediums: emptyCountMap(),
      utmCampaigns: emptyCountMap(),
      units: emptyCountMap(),
    },
    sourceEventCount: 0,
  };
}

function addSetCount(target: Map<string, Set<string>>, key: string, session: string): void {
  if (!target.has(key) && target.size >= 100) key = encodeAnalyticsDimension('[other]');
  const sessions = target.get(key) ?? new Set<string>();
  sessions.add(session);
  target.set(key, sessions);
}

function addSensitiveDimension(
  accumulator: Accumulator,
  dimension:
    | 'paths'
    | 'searches'
    | 'zeroResultSearches'
    | 'referrers'
    | 'utmSources'
    | 'utmMediums'
    | 'utmCampaigns'
    | 'devices'
    | 'browsers'
    | 'operatingSystems'
    | 'locales'
    | 'units',
  value: string | undefined,
  session: string,
): void {
  if (!value) return;
  addSetCount(
    accumulator.sensitiveDimensionSessions[dimension] ?? new Map(),
    encodeAnalyticsDimension(value),
    session,
  );
}

function addFirstSessionAttribution(
  accumulator: Accumulator,
  dimension: 'referrers' | 'utmSources' | 'utmMediums' | 'utmCampaigns',
  value: string | undefined,
  session: string,
): void {
  if (!value) return;
  const selected = accumulator.attributionBySession[dimension];
  if (!selected || selected.has(session)) return;
  selected.set(session, value);
  addSensitiveDimension(accumulator, dimension, value, session);
}

function materializedBreakdowns(accumulator: Accumulator): Record<string, CountMap> {
  return {
    ...accumulator.breakdowns,
    ...Object.fromEntries(
      Object.entries(accumulator.sensitiveDimensionSessions).map(([key, sessions]) => [
        key,
        setSizes(sessions),
      ]),
    ),
  };
}

function acceptEvent(accumulator: Accumulator, event: AnalyticsRollupEvent): void {
  const timestamp = event.occurredAt.getTime();
  accumulator.sourceEventCount += 1;
  if (!accumulator.sourceMaxOccurredAt || event.occurredAt > accumulator.sourceMaxOccurredAt) {
    accumulator.sourceMaxOccurredAt = event.occurredAt;
  }
  accumulator.sessions.add(event.sessionIdHash);
  if (event.visitorIdHash) accumulator.visitors.add(event.visitorIdHash);
  const session = accumulator.sessionStates.get(event.sessionIdHash) ?? {
    first: timestamp,
    last: timestamp,
    pages: 0,
  };
  session.first = Math.min(session.first, timestamp);
  session.last = Math.max(session.last, timestamp);
  if (event.type === 'page_view') session.pages += 1;
  accumulator.sessionStates.set(event.sessionIdHash, session);

  incrementKnown(accumulator.eventCounts, event.type);
  addSensitiveDimension(
    accumulator,
    'paths',
    event.type === 'page_view' ? event.path : undefined,
    event.sessionIdHash,
  );
  addSensitiveDimension(
    accumulator,
    'searches',
    event.type === 'search' ? event.query : undefined,
    event.sessionIdHash,
  );
  addSensitiveDimension(
    accumulator,
    'zeroResultSearches',
    event.type === 'search' && event.zeroResults ? event.query : undefined,
    event.sessionIdHash,
  );
  addSensitiveDimension(accumulator, 'devices', event.device, event.sessionIdHash);
  addSensitiveDimension(accumulator, 'browsers', event.browser, event.sessionIdHash);
  addSensitiveDimension(accumulator, 'operatingSystems', event.os, event.sessionIdHash);
  addSensitiveDimension(accumulator, 'locales', event.locale, event.sessionIdHash);
  addFirstSessionAttribution(accumulator, 'referrers', event.referrerHost, event.sessionIdHash);
  addFirstSessionAttribution(accumulator, 'utmSources', event.utmSource, event.sessionIdHash);
  addFirstSessionAttribution(accumulator, 'utmMediums', event.utmMedium, event.sessionIdHash);
  addFirstSessionAttribution(accumulator, 'utmCampaigns', event.utmCampaign, event.sessionIdHash);
  addSensitiveDimension(
    accumulator,
    'units',
    event.type === 'unit_switch' ? event.unit : undefined,
    event.sessionIdHash,
  );

  const stage =
    event.type === 'page_view' ||
    event.type === 'calc_start' ||
    event.type === 'assess_submit' ||
    event.type === 'result_view' ||
    event.type === 'retake'
      ? event.type
      : undefined;
  if (stage) addSetCount(accumulator.funnelSessions, stage, event.sessionIdHash);
  if (event.type === 'step_view' && event.step && event.stepIndex !== undefined) {
    addSetCount(
      accumulator.stepSessions,
      encodeAnalyticsDimension(`${String(event.stepIndex).padStart(3, '0')}\u0000${event.step}`),
      event.sessionIdHash,
    );
  }
}

function sessionTotals(accumulator: Accumulator): {
  duration: number;
  samples: number;
  pages: number;
} {
  let duration = 0;
  let pages = 0;
  for (const session of accumulator.sessionStates.values()) {
    duration += Math.max(0, session.last - session.first);
    pages += session.pages;
  }
  return { duration, samples: accumulator.sessionStates.size, pages };
}

function setSizes(source: Map<string, Set<string>>): CountMap {
  return Object.fromEntries([...source].map(([key, values]) => [key, values.size]));
}

export function summarizeAnalyticsEvents(
  events: readonly AnalyticsRollupEvent[],
  visitorPersistenceEnabled: boolean,
): AnalyticsEventSummary {
  const accumulator = createAccumulator('global');
  for (const event of events) acceptEvent(accumulator, event);
  const totals = sessionTotals(accumulator);
  return {
    visitors: visitorPersistenceEnabled ? accumulator.visitors.size : accumulator.sessions.size,
    sessions: accumulator.sessions.size,
    eventCounts: accumulator.eventCounts,
    sessionDurationTotalMs: totals.duration,
    sessionDurationSamples: totals.samples,
    pageViews: totals.pages,
    breakdowns: materializedBreakdowns(accumulator),
    funnel: setSizes(accumulator.funnelSessions),
    stepViews: setSizes(accumulator.stepSessions),
    sourceEventCount: accumulator.sourceEventCount,
    sourceMaxOccurredAt: accumulator.sourceMaxOccurredAt,
  };
}

export async function buildAnalyticsDailyRollups(options: {
  readonly day: string;
  readonly timezone: string;
  readonly visitorPersistenceEnabled: boolean;
  readonly identityKeyVersion?: string;
  readonly minimumCohortSize?: number;
  readonly now?: Date;
  readonly heartbeat?: () => Promise<void>;
}): Promise<AnalyticsDailyRollup[]> {
  const { start, end } = reportingDayBounds(options.day, options.timezone);
  type RollupIdentityBasis = 'visitor' | 'session';
  const preferredBasis: RollupIdentityBasis = options.visitorPersistenceEnabled
    ? 'visitor'
    : 'session';
  const globals = new Map<RollupIdentityBasis, Accumulator>();
  const calculators = new Map<string, Accumulator>();
  const calculatorSlugs = new Set<string>();
  const globalFor = (basis: RollupIdentityBasis) => {
    const accumulator = globals.get(basis) ?? createAccumulator('global');
    globals.set(basis, accumulator);
    return accumulator;
  };
  const calculatorKey = (basis: RollupIdentityBasis, slug: string) => `${basis}\u0000${slug}`;
  const effectiveNow = options.now ?? new Date();
  const acceptedCalculators = new Set(
    (
      await CalculatorModel.find({ status: { $in: ['published', 'retired'] } })
        .select('slug')
        .lean()
    ).map((calculator) => calculator.slug),
  );
  const cursor = AnalyticsEventModel.find({
    occurredAt: { $gte: start, $lt: end },
    expiresAt: { $gt: effectiveNow },
    identityKeyVersion: options.identityKeyVersion ?? 'v1',
  })
    .sort({ occurredAt: 1, eventId: 1 })
    .select(
      'type occurredAt visitorIdHash sessionIdHash calculatorSlug path step stepIndex query device browser os locale referrerHost utmSource utmMedium utmCampaign unit zeroResults action',
    )
    .lean()
    .cursor();
  let processed = 0;
  for await (const event of cursor) {
    const typed = event as unknown as AnalyticsRollupEvent;
    // The stored identity material determines the partition permanently. A
    // later privacy-policy toggle must not reinterpret retained visitor events
    // as sessions and double-count a reconciliation window.
    const basis: RollupIdentityBasis = typed.visitorIdHash ? 'visitor' : 'session';
    acceptEvent(globalFor(basis), typed);
    if (
      typed.calculatorSlug &&
      acceptedCalculators.has(typed.calculatorSlug) &&
      (calculatorSlugs.has(typed.calculatorSlug) || calculatorSlugs.size < 500)
    ) {
      const key = calculatorKey(basis, typed.calculatorSlug);
      const calculator =
        calculators.get(key) ?? createAccumulator('calculator', typed.calculatorSlug);
      acceptEvent(calculator, typed);
      calculators.set(key, calculator);
      calculatorSlugs.add(typed.calculatorSlug);
    }
    processed += 1;
    if (processed % 1_000 === 0) await options.heartbeat?.();
  }

  await options.heartbeat?.();
  const leads = await LeadModel.countDocuments({
    createdAt: { $gte: start, $lt: end },
    expiresAt: { $gt: effectiveNow },
  });
  const assessments = new Map<string, number>();
  const results = new Map<string, number>();
  const intelligence = new Map<string, AssessmentIntelligence>();
  const getIntelligence = (slug: string) => {
    const value = intelligence.get(slug) ?? {
      scoreBuckets: emptyCountMap(),
      categoryCounts: emptyCountMap(),
      omittedParameterCounts: emptyCountMap(),
      unitCounts: emptyCountMap(),
      versionCounts: emptyCountMap(),
      computeMsTotal: 0,
      computeMsSamples: 0,
    };
    intelligence.set(slug, value);
    return value;
  };
  const versionScales = new Map<string, ScoreScale>();
  const versions = await CalculatorVersionModel.find({})
    .select('_id payload.resultCategories.scale')
    .lean();
  for (const version of versions) {
    const payload = version.payload as Record<string, unknown> | undefined;
    const categories = payload?.resultCategories as Record<string, unknown> | undefined;
    const rawScale = categories?.scale as Record<string, unknown> | undefined;
    const min = rawScale?.min;
    const max = rawScale?.max;
    if (
      typeof min === 'number' &&
      typeof max === 'number' &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      max > min
    ) {
      versionScales.set(version._id.toString(), { min, max });
    }
  }
  const resultCursor = ResultModel.find({
    createdAt: { $gte: start, $lt: end },
    expiresAt: { $gt: effectiveNow },
  })
    .select('calculatorSlug calculatorVersionId score category computeMs')
    .lean()
    .cursor();
  let intelligenceProcessed = 0;
  for await (const result of resultCursor) {
    results.set(result.calculatorSlug, (results.get(result.calculatorSlug) ?? 0) + 1);
    const value = getIntelligence(result.calculatorSlug);
    if (typeof result.score === 'number' && Number.isFinite(result.score)) {
      const versionId = result.calculatorVersionId?.toString();
      const bucket = scoreBucketBounds(
        result.score,
        versionId ? versionScales.get(versionId) : undefined,
      );
      if (bucket) incrementKnown(value.scoreBuckets, encodeScoreBucket(bucket));
    }
    const category = result.category as Record<string, unknown> | undefined;
    const label = typeof category?.label === 'string' ? category.label : 'unclassified';
    incrementDimension(value.categoryCounts, label);
    incrementDimension(value.versionCounts, result.calculatorVersionId?.toString() ?? '[unknown]');
    if (typeof result.computeMs === 'number' && Number.isFinite(result.computeMs)) {
      value.computeMsTotal += result.computeMs;
      value.computeMsSamples += 1;
    }
    intelligenceProcessed += 1;
    if (intelligenceProcessed % 1_000 === 0) await options.heartbeat?.();
  }
  const assessmentCursor = AssessmentModel.find({
    createdAt: { $gte: start, $lt: end },
    expiresAt: { $gt: effectiveNow },
  })
    .select('calculatorSlug omittedParameters inputsEntered')
    .lean()
    .cursor();
  for await (const assessment of assessmentCursor) {
    assessments.set(
      assessment.calculatorSlug,
      (assessments.get(assessment.calculatorSlug) ?? 0) + 1,
    );
    const value = getIntelligence(assessment.calculatorSlug);
    for (const parameter of assessment.omittedParameters ?? []) {
      incrementDimension(value.omittedParameterCounts, parameter);
    }
    for (const input of Object.values(assessment.inputsEntered ?? {})) {
      if (input && typeof input === 'object' && !Array.isArray(input)) {
        const unit = (input as Record<string, unknown>).unit;
        if (typeof unit === 'string') incrementDimension(value.unitCounts, unit);
      }
    }
    intelligenceProcessed += 1;
    if (intelligenceProcessed % 1_000 === 0) await options.heartbeat?.();
  }
  await options.heartbeat?.();
  for (const slug of new Set([...assessments.keys(), ...results.keys()])) {
    const hasCalculatorPartition = [...calculators.values()].some(
      (accumulator) => accumulator.calculatorSlug === slug,
    );
    if (acceptedCalculators.has(slug) && !hasCalculatorPartition) {
      calculators.set(calculatorKey(preferredBasis, slug), createAccumulator('calculator', slug));
      calculatorSlugs.add(slug);
    }
  }

  if (globals.size === 0) globalFor(preferredBasis);

  const visitorFirstSeen = new Map<string, Date>();
  const visitorGlobal = globals.get('visitor');
  if (visitorGlobal && visitorGlobal.visitors.size > 0) {
    const visitors = await AnonymousVisitorModel.find({
      visitorIdHash: { $in: [...visitorGlobal.visitors] },
      expiresAt: { $gt: effectiveNow },
    })
      .select('visitorIdHash firstSeenAt')
      .lean();
    for (const visitor of visitors)
      visitorFirstSeen.set(visitor.visitorIdHash, visitor.firstSeenAt);
  }

  function materialize(
    accumulator: Accumulator,
    identityBasis: RollupIdentityBasis,
  ): AnalyticsDailyRollup {
    const totals = sessionTotals(accumulator);
    let newVisitors = 0;
    let returningVisitors = 0;
    if (identityBasis === 'visitor') {
      for (const visitor of accumulator.visitors) {
        const firstSeen = visitorFirstSeen.get(visitor);
        // Missing state includes logically expired visitor rows waiting for
        // Atlas TTL cleanup; do not misclassify those identities as returning.
        if (!firstSeen) continue;
        if (firstSeen >= start && firstSeen < end) newVisitors += 1;
        else returningVisitors += 1;
      }
    }
    const minimumCohortSize = options.minimumCohortSize ?? 5;
    const calculatorAssessments = assessments.get(accumulator.calculatorSlug ?? '') ?? 0;
    const calculatorResults = results.get(accumulator.calculatorSlug ?? '') ?? 0;
    const assessmentCohortEligible = calculatorAssessments >= minimumCohortSize;
    const resultCohortEligible = calculatorResults >= minimumCohortSize;
    const clinicalCohortEligible = assessmentCohortEligible && resultCohortEligible;
    const calculatorIntelligence = intelligence.get(accumulator.calculatorSlug ?? '');
    return {
      day: options.day,
      timezone: options.timezone,
      scope: accumulator.scope,
      scopeKey:
        accumulator.scope === 'global' ? 'global' : `calculator:${accumulator.calculatorSlug}`,
      calculatorSlug: accumulator.calculatorSlug,
      identityBasis,
      identityKeyVersion: options.identityKeyVersion ?? 'v1',
      minimumCohortSize,
      visitors: identityBasis === 'visitor' ? accumulator.visitors.size : accumulator.sessions.size,
      sessions: accumulator.sessions.size,
      newVisitors,
      returningVisitors,
      identitySketch: createIdentitySketch(
        identityBasis === 'visitor' ? accumulator.visitors : accumulator.sessions,
      ),
      assessments:
        accumulator.scope === 'global'
          ? [...assessments.values()].reduce((sum, value) => sum + value, 0)
          : (assessments.get(accumulator.calculatorSlug ?? '') ?? 0),
      results:
        accumulator.scope === 'global'
          ? [...results.values()].reduce((sum, value) => sum + value, 0)
          : (results.get(accumulator.calculatorSlug ?? '') ?? 0),
      leads: accumulator.scope === 'global' ? leads : 0,
      eventCounts: accumulator.eventCounts,
      sessionDurationTotalMs: totals.duration,
      sessionDurationSamples: totals.samples,
      pageViews: totals.pages,
      breakdowns: privacySafeBreakdowns(materializedBreakdowns(accumulator), minimumCohortSize),
      funnel: setSizes(accumulator.funnelSessions),
      stepViews: setSizes(accumulator.stepSessions),
      // Clinical dimensions use a minimum record-count small-cell rule. This is
      // not represented as person-level k-anonymity because result/assessment
      // persistence deliberately has no analytics identity linkage.
      scoreBuckets: clinicalCohortEligible
        ? retainedCells(calculatorIntelligence?.scoreBuckets ?? emptyCountMap(), minimumCohortSize)
        : emptyCountMap(),
      categoryCounts: clinicalCohortEligible
        ? retainedCells(
            calculatorIntelligence?.categoryCounts ?? emptyCountMap(),
            minimumCohortSize,
          )
        : emptyCountMap(),
      omittedParameterCounts: clinicalCohortEligible
        ? retainedCells(
            calculatorIntelligence?.omittedParameterCounts ?? emptyCountMap(),
            minimumCohortSize,
          )
        : emptyCountMap(),
      unitCounts: clinicalCohortEligible
        ? retainedCells(calculatorIntelligence?.unitCounts ?? emptyCountMap(), minimumCohortSize)
        : emptyCountMap(),
      versionCounts: clinicalCohortEligible
        ? retainedCells(calculatorIntelligence?.versionCounts ?? emptyCountMap(), minimumCohortSize)
        : emptyCountMap(),
      computeMsTotal: clinicalCohortEligible ? (calculatorIntelligence?.computeMsTotal ?? 0) : 0,
      computeMsSamples: clinicalCohortEligible
        ? (calculatorIntelligence?.computeMsSamples ?? 0)
        : 0,
      sourceEventCount: accumulator.sourceEventCount,
      sourceMaxOccurredAt: accumulator.sourceMaxOccurredAt,
      rolledUpAt: options.now ?? new Date(),
    };
  }

  return [
    ...[...globals].map(([basis, accumulator]) => materialize(accumulator, basis)),
    ...[...calculators].map(([key, accumulator]) =>
      materialize(accumulator, key.startsWith('visitor\u0000') ? 'visitor' : 'session'),
    ),
  ];
}

export async function upsertAnalyticsDailyRollups(
  rollups: readonly AnalyticsDailyRollup[],
  options: { readonly sourceWindowVerified: true },
): Promise<void> {
  if (options.sourceWindowVerified !== true) {
    throw new AnalyticsSourceWindowIncompleteError(
      'A verified source-retention window is required before permanent rollup replacement.',
    );
  }
  if (rollups.length === 0) return;
  const replacementGroups = new Map<
    string,
    {
      readonly day: string;
      readonly timezone: string;
      readonly identityKeyVersion: string;
      readonly partitions: Array<{
        scope: 'global' | 'calculator';
        scopeKey: string;
        identityBasis: 'visitor' | 'session';
      }>;
    }
  >();
  for (const rollup of rollups) {
    const key = `${rollup.day}\u0000${rollup.timezone}\u0000${rollup.identityKeyVersion}`;
    const group = replacementGroups.get(key) ?? {
      day: rollup.day,
      timezone: rollup.timezone,
      identityKeyVersion: rollup.identityKeyVersion,
      partitions: [],
    };
    group.partitions.push({
      scope: rollup.scope,
      scopeKey: rollup.scopeKey,
      identityBasis: rollup.identityBasis,
    });
    replacementGroups.set(key, group);
  }
  // A final heartbeat is performed by the leased wrapper immediately before
  // this potentially long multi-document write.
  await AnalyticsDailyModel.bulkWrite(
    [
      ...rollups.map((rollup) => ({
        updateOne: {
          filter: {
            day: rollup.day,
            timezone: rollup.timezone,
            scope: rollup.scope,
            scopeKey: rollup.scopeKey,
            identityBasis: rollup.identityBasis,
            identityKeyVersion: rollup.identityKeyVersion,
          },
          update: { $set: rollup },
          upsert: true,
        },
      })),
      // Write the desired durable copies before removing stale partitions. An
      // interrupted retry can safely repair extra rows without first erasing
      // the last complete copy of a reporting window.
      ...[...replacementGroups.values()].map((group) => ({
        deleteMany: {
          filter: {
            day: group.day,
            timezone: group.timezone,
            identityKeyVersion: group.identityKeyVersion,
            $nor: group.partitions,
          },
        },
      })),
    ],
    { ordered: true },
  );
}

export async function rollupAnalyticsDay(options: {
  readonly day: string;
  readonly timezone: string;
  readonly visitorPersistenceEnabled: boolean;
  readonly identityKeyVersion?: string;
  readonly minimumCohortSize?: number;
  readonly sourceRetentionDays: AnalyticsSourceRetentionDays;
  readonly now?: Date;
  readonly heartbeat?: () => Promise<void>;
}): Promise<{ readonly documents: number; readonly sourceEvents: number }> {
  const effectiveNow = options.now ?? new Date();
  assertAnalyticsSourceWindowComplete({
    day: options.day,
    timezone: options.timezone,
    now: effectiveNow,
    visitorPersistenceEnabled: options.visitorPersistenceEnabled,
    visitorSourceRequired:
      options.visitorPersistenceEnabled || options.sourceRetentionDays.visitors !== undefined,
    retentionDays: options.sourceRetentionDays,
  });
  const built = await buildAnalyticsDailyRollups({ ...options, now: effectiveNow });
  const sourceRetentionDays = assertAnalyticsSourceWindowComplete({
    day: options.day,
    timezone: options.timezone,
    now: effectiveNow,
    visitorPersistenceEnabled: options.visitorPersistenceEnabled,
    visitorSourceRequired:
      options.visitorPersistenceEnabled ||
      built.some((rollup) => rollup.identityBasis === 'visitor'),
    retentionDays: options.sourceRetentionDays,
  });
  const rollups = built.map((rollup) => ({
    ...rollup,
    sourceRetentionDays,
    sourceCompletenessCheckedAt: effectiveNow,
  }));
  await options.heartbeat?.();
  await upsertAnalyticsDailyRollups(rollups, { sourceWindowVerified: true });
  await options.heartbeat?.();
  return {
    documents: rollups.length,
    sourceEvents: rollups
      .filter((rollup) => rollup.scope === 'global')
      .reduce((total, rollup) => total + rollup.sourceEventCount, 0),
  };
}

export function analyticsEventRetentionFilter(now: Date): FilterQuery<AnalyticsEventDocument> {
  return { expiresAt: { $lte: now } };
}
