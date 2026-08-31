/**
 * Additive, presentation-only DTOs for the public HTTP API.
 *
 * These types intentionally omit every scoring rule, formula, threshold,
 * weight, trace, review hash, and persistence identifier. The immutable P0A
 * calculator schema remains the source of truth for authoring and execution.
 */

export type PublicScalar = string | number | boolean;

export interface PublicConditionPredicate {
  readonly param?: string;
  readonly aggregate?: string;
  readonly op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not-in' | 'exists' | 'missing';
  readonly value?: PublicScalar | readonly PublicScalar[];
}

export type PublicCondition =
  | { readonly all: readonly PublicCondition[] }
  | { readonly any: readonly PublicCondition[] }
  | { readonly not: PublicCondition }
  /** An authoring-only condition was redacted and therefore remains fail-closed. */
  | { readonly unavailable: true }
  | PublicConditionPredicate;

export interface PublicParameter {
  readonly key: string;
  readonly label: string;
  readonly group: string;
  readonly biomarkerKey?: string;
  readonly inputType: 'number' | 'select' | 'boolean' | 'derived';
  readonly unit?: {
    readonly canonical: string;
    readonly allowed?: readonly {
      readonly code: string;
      readonly factor: number;
      readonly offset?: number;
    }[];
  };
  readonly validation?: {
    readonly required?: boolean;
    readonly min?: number;
    readonly max?: number;
    readonly integer?: boolean;
    readonly softMin?: number;
    readonly softMax?: number;
  };
  readonly options?: readonly {
    readonly value: PublicScalar;
    readonly label: string;
  }[];
  readonly defaultOption?: PublicScalar;
  readonly missingPolicy?:
    | 'block'
    | 'default-option'
    | 'impute-rule'
    | 'exclude-from-max'
    | 'exclude-from-group'
    | 'zero-points'
    | 'not-applicable';
  readonly visibility?: PublicCondition;
  readonly order: number;
  readonly helpText?: string;
  readonly placeholder?: string;
}

export type PublicResultBlock =
  | 'score-gauge'
  | 'category'
  | 'key-contributors'
  | 'domain-breakdown'
  | 'biomarker-details'
  | 'recommendations';

export interface PublicContentBlock {
  readonly id: string;
  readonly type:
    | 'markdown'
    | 'callout'
    | 'faq'
    | 'steps'
    | 'table'
    | 'media'
    | 'related'
    | 'disclaimer'
    | 'calculator-embed'
    | 'crisis-resources';
  readonly claimIds?: readonly string[];
  readonly [key: string]: unknown;
}

export interface PublicContentPage {
  readonly schemaVersion?: 'content-page.v1';
  readonly contentId?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly slug?: string;
  readonly title?: string;
  readonly summary?: string;
  readonly blocks: readonly PublicContentBlock[];
  readonly claims?: readonly Record<string, unknown>[];
  readonly citations?: readonly Record<string, unknown>[];
  readonly authorship?: Readonly<Record<string, unknown>>;
  readonly seo?: Readonly<Record<string, unknown>>;
  readonly publication?: Readonly<Record<string, unknown>>;
  readonly related?: Readonly<Record<string, unknown>>;
}

export interface PublicCalculatorSummary {
  readonly slug: string;
  readonly calculatorSlug: string;
  readonly version: number;
  /** Present only for explicitly enabled, non-production database preview records. */
  readonly releaseState?: 'testing-unapproved';
  readonly name?: string;
  readonly shortDescription?: string;
  readonly disclaimers?: readonly string[];
}

export interface PublicCalculatorConfig extends PublicCalculatorSummary {
  readonly parameters: readonly PublicParameter[];
  readonly uiConfig: {
    readonly theme?: { readonly accent?: string };
    readonly steps: readonly {
      readonly key: string;
      readonly title: string;
      readonly parameterGroups: readonly string[];
    }[];
    readonly result: { readonly layout: readonly PublicResultBlock[] };
  };
  readonly content?: PublicContentPage;
  readonly resultCategories?: {
    readonly bands?: readonly {
      readonly label?: string;
      readonly color?: string;
      readonly message?: string;
      readonly recommendation?: string;
    }[];
  };
}

export interface PublicAssessmentRequest {
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly omitted?: readonly string[];
}

export interface PublicAssessmentResponse {
  readonly id: string;
  readonly calculatorSlug: string;
  readonly version: number;
  readonly score?: number;
  readonly category?: PublicResultCategory;
  readonly shareToken: string;
  readonly releaseState?: 'testing-unapproved';
}

export interface PublicResultCategory {
  readonly label?: string;
  readonly color?: string;
  readonly message?: string;
  readonly recommendation?: string;
}

export interface PublicResultPresentation {
  readonly calculatorSlug: string;
  readonly calculatorVersion: number;
  readonly name: string;
  readonly shortDescription: string;
  readonly disclaimers: readonly string[];
  readonly resultLayout: readonly PublicResultBlock[];
  readonly scoreScale?: {
    readonly min: number;
    readonly max: number;
    readonly direction:
      'higher-is-worse' | 'lower-is-worse' | 'higher-is-better' | 'lower-is-better';
  };
  readonly parameters: readonly {
    readonly key: string;
    readonly label: string;
    readonly biomarkerKey?: string;
    readonly canonicalUnit?: string;
  }[];
  readonly domains: readonly { readonly key: string; readonly label: string }[];
  readonly releaseState?: 'testing-unapproved';
}

export interface PublicSharedResult {
  readonly score?: number;
  readonly category?: PublicResultCategory;
  readonly parameters?: readonly {
    readonly key: string;
    readonly input?: unknown;
    readonly value?: PublicScalar | null;
    readonly canonicalUnit?: string;
    readonly missing?: boolean;
    readonly imputed?: boolean;
    readonly applicable?: boolean;
    readonly status?: string;
  }[];
  readonly domains?: readonly {
    readonly key: string;
    readonly score?: number;
    readonly scoredCount?: number;
    readonly missingCount?: number;
    readonly applicableCount?: number;
    readonly coverage?: number;
    readonly status?: string;
  }[];
  readonly coverage?: {
    readonly scoredParameterCount?: number;
    readonly applicableScoredParameterCount?: number;
    readonly parameterCoverage?: number;
    readonly domainCoverage?: number;
  };
  readonly contributors?: {
    readonly harmful: readonly { readonly key: string; readonly status?: string }[];
    readonly protective: readonly { readonly key: string; readonly status?: string }[];
  };
  readonly warnings?: readonly string[];
  readonly presentation?: PublicResultPresentation;
}

export type PublicMeasurementKind =
  | 'laboratory-biomarker'
  | 'vital'
  | 'anthropometric'
  | 'derived-measurement'
  | 'questionnaire-response'
  | 'context';

export interface PublicMeasurementUnit {
  readonly code: string;
  readonly dimension: string;
  readonly display: string;
  readonly ucum?: string;
}

export interface PublicMeasurementInterval {
  readonly min?: number;
  readonly max?: number;
  readonly minInclusive?: boolean;
  readonly maxInclusive?: boolean;
}

export interface PublicBiomarkerRangeContext {
  readonly sexAtBirth?: 'female' | 'male' | 'intersex' | 'not-specified';
  readonly ageMinYears?: number;
  readonly ageMaxYears?: number;
  readonly pregnancyStatus?: 'pregnant' | 'not-pregnant' | 'unknown';
  readonly menopausalStatus?: 'pre' | 'peri' | 'post' | 'unknown';
  readonly fastingStatus?: 'fasting' | 'non-fasting' | 'unknown';
  readonly specimen?: string;
  readonly sampleTiming?: string;
  readonly population?: string;
  readonly method?: string;
}

export interface PublicBiomarkerReferenceRange {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly interval: PublicMeasurementInterval;
  readonly context: PublicBiomarkerRangeContext;
  readonly interpretation?: string;
  readonly interpretationOnly: true;
  readonly sourceClaimIds: readonly string[];
  readonly conflictGroup?: string;
}

export interface PublicBiomarkerSource {
  readonly id: string;
  readonly type: 'niro' | 'external' | 'internal';
  readonly org?: string;
  readonly title: string;
  readonly url?: string;
  readonly accessed?: string;
  /** Only source states allowed through the reviewed public projection. */
  readonly verification: 'fetch-verified' | 'source-provided';
  readonly claimIds?: readonly string[];
}

export type PublicMeasurementConversion =
  | {
      readonly kind: 'affine';
      readonly fromUnit: string;
      readonly toUnit: string;
      readonly factor: number;
      readonly offset: number;
      readonly sourceClaimIds?: readonly string[];
    }
  | {
      readonly kind: 'composite';
      readonly adapter: string;
      readonly from: readonly { readonly field: string; readonly unit: string }[];
      readonly toUnit: string;
      readonly sourceClaimIds?: readonly string[];
    };

export interface PublicBiomarkerDefinition {
  readonly aliases?: readonly string[];
  readonly formerKeys?: readonly string[];
  readonly panels?: readonly string[];
  readonly domainKeys?: readonly string[];
  readonly valueType?: 'number' | 'integer' | 'boolean' | 'coded-value';
  readonly canonicalUnit?: PublicMeasurementUnit;
  readonly acceptedUnits?: readonly PublicMeasurementUnit[];
  readonly conversions?: readonly PublicMeasurementConversion[];
  readonly referenceRanges?: readonly PublicBiomarkerReferenceRange[];
  readonly description?: {
    readonly whatItMeasures?: string;
    readonly whyItMatters?: string;
    readonly collectionNotes?: string;
    readonly limitations?: string;
  };
}

/** A reviewed public list card; it contains no scoring or governance fields. */
export interface PublicBiomarkerSummary {
  readonly key: string;
  readonly revision: number;
  /** Present only for explicitly enabled, non-production database preview records. */
  readonly releaseState?: 'testing-unapproved';
  readonly displayName: string;
  readonly kind: PublicMeasurementKind;
  readonly canonicalUnit?: string;
  readonly definition: PublicBiomarkerDefinition;
  readonly sources: readonly PublicBiomarkerSource[];
}

export interface PublicRelatedBiomarker {
  readonly key: string;
  readonly displayName: string;
  readonly relation: 'same-domain';
  readonly canonicalUnit?: string;
  readonly domainKeys?: readonly string[];
}

export interface PublicBiomarkerCalculatorUsage {
  readonly calculatorSlug: string;
  readonly version: number;
  readonly name?: string;
  readonly shortDescription?: string;
}

/** Detail response enriched with safe, server-derived public relationships. */
export interface PublicBiomarkerDetail extends PublicBiomarkerSummary {
  readonly relatedBiomarkers: readonly PublicRelatedBiomarker[];
  readonly usedInCalculators: readonly PublicBiomarkerCalculatorUsage[];
}

export interface PublicLeadRequest {
  readonly email: string;
  readonly consent: true;
  readonly consentVersion: string;
}
