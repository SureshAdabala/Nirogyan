export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'calc_start',
  'step_view',
  'assess_submit',
  'result_view',
  'share',
  'search',
  'unit_switch',
  'share_open',
  'retake',
  'assess_error',
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsIdentityBasis = 'visitor' | 'session' | 'mixed';

export interface AnalyticsTrendPoint {
  readonly day: string;
  readonly visitors: number;
  readonly sessions: number;
  readonly assessments: number;
  readonly results: number;
  readonly leads: number;
}

export interface AnalyticsWindowSummary {
  readonly visitors: number;
  readonly sessions: number;
  readonly assessments: number;
  readonly results: number;
  readonly leads: number;
  readonly topCalculator?: string;
}

export interface AnalyticsOverviewResponse {
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly identityBasis: AnalyticsIdentityBasis;
  readonly identityNotice: string;
  readonly today: AnalyticsWindowSummary;
  readonly sevenDays: AnalyticsWindowSummary;
  readonly thirtyDays: AnalyticsWindowSummary;
  readonly active: { readonly dau: number; readonly wau: number; readonly mau: number };
  readonly newVsReturning: { readonly new: number; readonly returning: number };
  readonly liveNow: number;
  readonly growth: readonly AnalyticsTrendPoint[];
}

export interface AnalyticsRankedValue {
  readonly key: string;
  readonly count: number;
}

export interface AnalyticsCalculatorEngagement {
  readonly calculatorSlug: string;
  readonly starts: number;
  readonly completions: number;
  readonly completionRate: number;
  readonly dropOffStep?: string;
}

export interface AnalyticsEngagementResponse {
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly averageSessionDurationMs: number;
  readonly pagesPerSession: number;
  readonly calculators: readonly AnalyticsCalculatorEngagement[];
  readonly pages: readonly AnalyticsRankedValue[];
  readonly searches: readonly (AnalyticsRankedValue & { readonly zeroResults: number | null })[];
  readonly searchPrivacyNotice: string;
  readonly devices: readonly AnalyticsRankedValue[];
  readonly browsers: readonly AnalyticsRankedValue[];
  readonly operatingSystems: readonly AnalyticsRankedValue[];
  readonly locales: readonly AnalyticsRankedValue[];
  readonly referrers: readonly AnalyticsRankedValue[];
  readonly utmSources: readonly AnalyticsRankedValue[];
  readonly utmMediums: readonly AnalyticsRankedValue[];
  readonly utmCampaigns: readonly AnalyticsRankedValue[];
  readonly shareOpens: number;
  readonly retakes: number;
  /** Distinct retake sessions divided by distinct result-view sessions. */
  readonly retakeRate: number;
}

export interface AnalyticsFunnelResponse {
  readonly calculatorSlug: string;
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly stages: readonly { readonly stage: string; readonly count: number }[];
  readonly steps: readonly AnalyticsRankedValue[];
  readonly dropOffStep?: string;
  readonly completionRate: number;
}

export interface AnalyticsScoresResponse {
  readonly calculatorSlug: string;
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly suppressed: boolean;
  readonly suppressionNotice?: string;
  /** Number of non-expired persisted results represented by this response. */
  readonly sampleSize: number;
  /** Number of non-expired persisted successful assessments. */
  readonly successfulAssessments: number;
  readonly scoreHistogram: readonly {
    readonly lowerInclusive: number;
    readonly upperExclusive: number;
    readonly count: number;
  }[];
  readonly categories: readonly AnalyticsRankedValue[];
  readonly categoryTrend: readonly {
    readonly day: string;
    readonly suppressed: boolean;
    readonly categories: readonly AnalyticsRankedValue[];
  }[];
  readonly omittedParameters: readonly AnalyticsRankedValue[];
  readonly units: readonly AnalyticsRankedValue[];
  readonly averageComputeMs: number;
  readonly versionAdoption: readonly AnalyticsRankedValue[];
  readonly assessmentErrors: number;
  readonly assessmentErrorRate: number;
  readonly assessmentErrorRateBasis: 'client-telemetry-observed-v1';
}

export interface AnalyticsLeadsResponse {
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly total: number;
  readonly resultViews: number;
  readonly conversionRate: number;
  readonly trend: readonly { readonly day: string; readonly leads: number }[];
  readonly calculatorAttribution: 'unavailable-unlinked-v1';
}

export interface AnalyticsSecurityResponse {
  readonly range: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly successfulLogins: number;
  readonly failedLogins: number;
  readonly logouts: number;
  readonly activeLockouts: number;
  readonly rateLimitTrips: number;
  readonly rateLimitScope: 'public-endpoints-current-instance-since-start';
  readonly failedLoginTrend: readonly { readonly day: string; readonly count: number }[];
  readonly failedAttemptGroups: readonly {
    readonly kind: 'account' | 'network';
    /** Opaque, keyed label; never an email, IP address, or persisted hash. */
    readonly label: string;
    readonly count: number;
  }[];
  readonly adminActivity: readonly {
    readonly actorId: string;
    readonly actions: number;
    readonly lastActivityAt: string;
  }[];
}

export interface AnalyticsOpsResponse {
  readonly checkedAt: string;
  readonly health: 'ok' | 'degraded';
  readonly metricsScope: 'current-instance-since-start';
  readonly latencyScope: 'current-instance-rolling-last-5000';
  readonly database: 'ready' | 'not-ready';
  readonly requestLatencyMs: { readonly p50: number; readonly p95: number };
  readonly errorRate: number;
  readonly cache: { readonly hits: number; readonly misses: number; readonly hitRate: number };
  readonly cacheInvalidations: {
    readonly pending: number;
    readonly failed: number;
    readonly oldestPendingAgeMs: number | null;
  };
  readonly eventIngest: {
    readonly accepted: number;
    readonly rejected: number;
    readonly filteredBots: number;
    readonly lagMs: number | null;
  };
  readonly publishesLast30Days: number;
  readonly jobs: readonly {
    readonly job: string;
    readonly scheduledFor: string;
    readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    readonly attempt: number;
    readonly startedAt?: string;
    readonly finishedAt?: string;
    readonly errorCode?: string;
  }[];
  readonly collections: readonly {
    readonly name: string;
    readonly documents: number;
    readonly storageBytes: number | null;
  }[];
}
