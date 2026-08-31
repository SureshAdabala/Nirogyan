export type ResultLayoutBlock =
  | 'score-gauge'
  | 'category'
  | 'key-contributors'
  | 'domain-breakdown'
  | 'biomarker-details'
  | 'recommendations';

export type ResultDirection =
  'higher-is-worse' | 'lower-is-worse' | 'higher-is-better' | 'lower-is-better';

export interface ResultScoreDisplay {
  readonly min: number;
  readonly max: number;
  readonly direction?: ResultDirection;
  readonly displayDecimals?: number;
  readonly unit?: string;
}

export interface ResultCategoryProjection {
  readonly label?: string;
  readonly color?: string;
  readonly message?: string;
  readonly recommendation?: string;
}

export type ResultParameterStatus = 'scored' | 'missing' | 'excluded' | 'blocked';

export interface ResultParameterProjection {
  readonly key: string;
  readonly input?: unknown;
  readonly value?: string | number | boolean;
  readonly canonicalUnit?: string;
  readonly missing?: boolean;
  readonly imputed?: boolean;
  readonly applicable?: boolean;
  readonly status?: ResultParameterStatus;
  /** Optional backward-compatible safe presentation fields. */
  readonly label?: string;
  readonly group?: string;
  readonly biomarkerKey?: string;
  readonly kind?: 'measurement' | 'questionnaire' | 'context';
}

export interface ResultDomainProjection {
  readonly key: string;
  readonly score?: number;
  readonly scoredCount?: number;
  readonly missingCount?: number;
  readonly applicableCount?: number;
  readonly coverage?: number;
  readonly status?: 'scored' | 'empty' | 'blocked';
  /** Optional backward-compatible safe presentation field. */
  readonly label?: string;
}

export interface ResultContributorProjection {
  readonly key: string;
  readonly status?: ResultParameterStatus;
  /** Optional backward-compatible safe presentation field. */
  readonly label?: string;
}

export interface ResultCoverageSegment {
  readonly scoredCount: number;
  readonly applicableCount: number;
  readonly coverage?: number;
}

export interface ResultCoverageProjection {
  readonly scoredParameterCount?: number;
  /**
   * P2/P3 retained this historical name for the applicable denominator. It is
   * deliberately presented as a count, never as confidence.
   */
  readonly applicableScoredParameterCount?: number;
  readonly parameterCoverage?: number;
  readonly domainCoverage?: number;
  readonly measuredLab?: ResultCoverageSegment;
  readonly questionnaire?: ResultCoverageSegment;
}

export interface ResultProjection {
  readonly score?: number;
  readonly category?: ResultCategoryProjection;
  readonly parameters?: readonly ResultParameterProjection[];
  readonly domains?: readonly ResultDomainProjection[];
  readonly coverage?: ResultCoverageProjection;
  readonly contributors?: {
    readonly harmful?: readonly ResultContributorProjection[];
    readonly protective?: readonly ResultContributorProjection[];
  };
  readonly warnings?: readonly string[];
  readonly recommendations?: readonly string[];
}

export interface ResultParameterPresentation {
  readonly key: string;
  readonly label: string;
  readonly group?: string;
  readonly biomarkerKey?: string;
  readonly kind?: 'measurement' | 'questionnaire' | 'context';
}

export interface ResultDomainPresentation {
  readonly key: string;
  readonly label: string;
}

/**
 * Immutable, scoring-free metadata needed to render a saved result. This is
 * intentionally separate from ResultProjection so public persistence can
 * snapshot labels without exposing calculator logic.
 */
export interface ResultPresentation {
  readonly calculatorSlug?: string;
  readonly calculatorVersion?: number;
  readonly calculatorName?: string;
  readonly summary?: string;
  readonly disclaimers?: readonly string[];
  readonly layout: readonly ResultLayoutBlock[];
  readonly scoreDisplay?: ResultScoreDisplay;
  readonly parameters?: readonly ResultParameterPresentation[];
  readonly domains?: readonly ResultDomainPresentation[];
  readonly releaseState?: 'testing-unapproved';
}

export interface LeadCaptureSubmission {
  readonly email: string;
  readonly consentVersion: string;
}

export interface LeadCaptureOptions {
  readonly enabled: boolean;
  readonly consentText: string;
  readonly consentVersion: string;
  readonly onSubmit: (submission: LeadCaptureSubmission) => Promise<void>;
  readonly heading?: string;
}
