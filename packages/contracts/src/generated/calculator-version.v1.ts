/** Generated from calculator-version.v1.schema.json; edit the canonical JSON Schema instead. */

/**
 * Strict structural contract for an immutable calculator version. Semantic and publish rules are defined in the companion P0A specifications.
 */
export type NiroCalculatorVersionV1 = {
  [k: string]: unknown;
} & {
  /**
   * Instance contract discriminator. It is retained for compatibility with the five P0A fixtures.
   */
  $schema: 'niro-platform/calculator-version.v1';
  calculatorSlug: Slug;
  name: string;
  version: number;
  status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired' | 'rejected';
  shortDescription: string;
  /**
   * @minItems 1
   */
  disclaimers: [string, ...string[]];
  engineSemanticVersion?: string;
  NIRO_SOURCE_STATUS?: LegacyNiroSourceStatus;
  /**
   * @deprecated
   */
  PURPOSE_NOTE?: string;
  /**
   * @minItems 1
   */
  parameters: [Parameter, ...Parameter[]];
  /**
   * @minItems 1
   */
  scoringRules: [ScoringRule, ...ScoringRule[]];
  parameterGroupsAggregation?: ParameterGroupAggregation[];
  imputationRules?: ImputationRule[];
  lookupTables?: LookupTable[];
  /**
   * @minItems 1
   */
  formulas: [Formula, ...Formula[]];
  floorRules?: FloorRule[];
  /**
   * @minItems 1
   */
  domains: [Domain, ...Domain[]];
  domainAggregationPolicy?: DomainAggregationPolicy;
  adjustmentRules?: AdjustmentRule[];
  resultCategories: ResultCategories;
  uiConfig: UiConfig;
  content?: NiroCalculatorContentPageV1;
  /**
   * @minItems 1
   */
  sources?: [Source, ...Source[]];
  governance?: Governance;
  /**
   * @minItems 1
   */
  testCases?: [TestCase, ...TestCase[]];
};
export type Slug = string;
export type Parameter = {
  [k: string]: unknown;
} & {
  [k: string]: unknown;
} & {
  key: Key;
  label: string;
  group: Key;
  biomarkerKey?: Slug;
  inputType: 'number' | 'select' | 'boolean' | 'derived';
  unit?: Unit;
  validation?: Validation;
  /**
   * @minItems 1
   */
  options?: [Option, ...Option[]];
  defaultOption?: Scalar;
  missingPolicy?:
    | 'block'
    | 'default-option'
    | 'impute-rule'
    | 'exclude-from-max'
    | 'exclude-from-group'
    | 'zero-points'
    | 'not-applicable';
  derived?: Derived;
  visibility?: Condition;
  order: number;
  source?: Source;
  helpText?: string;
  placeholder?: string;
} & {
  key: Key;
  label: string;
  group: Key;
  biomarkerKey?: Slug;
  inputType: 'number' | 'select' | 'boolean' | 'derived';
  unit?: Unit;
  validation?: Validation;
  /**
   * @minItems 1
   */
  options?: [Option, ...Option[]];
  defaultOption?: Scalar;
  missingPolicy?:
    | 'block'
    | 'default-option'
    | 'impute-rule'
    | 'exclude-from-max'
    | 'exclude-from-group'
    | 'zero-points'
    | 'not-applicable';
  derived?: Derived;
  visibility?: Condition;
  order: number;
  source?: Source;
  helpText?: string;
  placeholder?: string;
};
export type Key = string;
export type Scalar = string | number | boolean;
export type Condition =
  | {
      /**
       * @minItems 1
       */
      all: [Condition, ...Condition[]];
    }
  | {
      /**
       * @minItems 1
       */
      any: [Condition, ...Condition[]];
    }
  | {
      not: Condition;
    }
  | Predicate;
export type Predicate = {
  [k: string]: unknown;
} & {
  param?: Key;
  aggregate?: Key;
  formula?: Key;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not-in' | 'exists' | 'missing';
  value?: ConditionValue;
} & Predicate1;
export type ConditionValue = Scalar | [Scalar, ...Scalar[]];
export type Predicate1 = {
  [k: string]: unknown;
};
export type ScoringRule = {
  parameterKey: Key;
  bandEdges?: 'min-inclusive' | 'explicit';
  /**
   * @minItems 1
   */
  contexts?: [Context, ...Context[]];
  /**
   * @minItems 1
   */
  optionPoints?: [OptionPoint, ...OptionPoint[]];
  source?: Source;
  asWritten?: boolean;
  /**
   * @minItems 1
   */
  clarificationRefs?: [string, ...string[]];
} & ScoringRule1 & {
    parameterKey: Key;
    bandEdges?: 'min-inclusive' | 'explicit';
    /**
     * @minItems 1
     */
    contexts?: [Context, ...Context[]];
    /**
     * @minItems 1
     */
    optionPoints?: [OptionPoint, ...OptionPoint[]];
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  } & ScoringRule1;
export type ScoreBand = ScoreBand1 & {
  min?: NullableNumber;
  max?: NullableNumber;
  minInclusive?: boolean;
  minExclusive?: boolean;
  maxInclusive?: boolean;
  maxExclusive?: boolean;
  points: number;
  interpretation?: string;
  source?: Source;
  asWritten?: boolean;
  /**
   * @minItems 1
   */
  clarificationRefs?: [string, ...string[]];
} & ScoreBand1 & {
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    points: number;
    interpretation?: string;
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  } & ScoreBand1 & {
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    points: number;
    interpretation?: string;
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  } & ScoreBand1 & {
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    points: number;
    interpretation?: string;
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  } & ScoreBand1 & {
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    points: number;
    interpretation?: string;
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  } & ScoreBand1 & {
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    points: number;
    interpretation?: string;
    source?: Source;
    asWritten?: boolean;
    /**
     * @minItems 1
     */
    clarificationRefs?: [string, ...string[]];
  };
export type ScoreBand1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type NullableNumber = number | null;
export type ScoringRule1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type ImputationAction = {
  setPoints?: number;
  setPointsByBand?: ImputationBandAction;
} & ImputationAction1;
export type ImputationAction1 = {
  [k: string]: unknown;
};
export type LookupTable = {
  key: Key;
  label: string;
  inputField?: Key;
  outputField?: Key;
  /**
   * @minItems 1
   */
  map?: [LegacyLookupRow, ...LegacyLookupRow[]];
  /**
   * @minItems 1
   */
  entries?: [LookupEntry, ...LookupEntry[]];
  source?: Source;
} & LookupTable1;
export type LookupTable1 = {
  [k: string]: unknown;
};
export type FloorAppliesWhen = FloorAppliesWhen1 & {
  description?: string;
  /**
   * @minItems 1
   */
  all?: [Condition, ...Condition[]];
  /**
   * @minItems 1
   */
  any?: [Condition, ...Condition[]];
};
export type FloorAppliesWhen1 = {
  [k: string]: unknown;
};
export type FloorTier = FloorTier1 & {
  bandParam: Key;
  min?: number;
  max?: number;
  minInclusive?: boolean;
  minExclusive?: boolean;
  maxInclusive?: boolean;
  maxExclusive?: boolean;
  floorPct: number;
  floorPctRangeNote?: string;
  uxClass?: string;
  message?: string;
  source?: Source;
  asWritten?: boolean;
  clarificationRefs?: string[];
} & FloorTier1 & {
    bandParam: Key;
    min?: number;
    max?: number;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    floorPct: number;
    floorPctRangeNote?: string;
    uxClass?: string;
    message?: string;
    source?: Source;
    asWritten?: boolean;
    clarificationRefs?: string[];
  };
export type FloorTier1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type AdjustmentRule = {
  key: Key;
  label: string;
  bandParam?: Key;
  bandEdges?: 'min-inclusive' | 'explicit';
  /**
   * @minItems 1
   */
  bands?: [ScoreBand, ...ScoreBand[]];
  optionParam?: Key;
  /**
   * @minItems 1
   */
  optionPoints?: [OptionPoint, ...OptionPoint[]];
  source?: Source;
} & AdjustmentRule1;
export type AdjustmentRule1 = {
  [k: string]: unknown;
};
export type ResultBand = ResultBand1 & {
  label: string;
  min?: NullableNumber;
  max?: NullableNumber;
  minInclusive?: boolean;
  minExclusive?: boolean;
  maxInclusive?: boolean;
  maxExclusive?: boolean;
  color: string;
  message?: string;
  recommendation?: string;
  source?: Source;
  asWritten?: boolean;
  clarificationRefs?: string[];
} & ResultBand1 & {
    label: string;
    min?: NullableNumber;
    max?: NullableNumber;
    minInclusive?: boolean;
    minExclusive?: boolean;
    maxInclusive?: boolean;
    maxExclusive?: boolean;
    color: string;
    message?: string;
    recommendation?: string;
    source?: Source;
    asWritten?: boolean;
    clarificationRefs?: string[];
  };
export type ResultBand1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type ContentBlock =
  | MarkdownBlock
  | CalloutBlock
  | FaqBlock
  | StepsBlock
  | TableBlock
  | MediaBlock
  | RelatedBlock
  | DisclaimerBlock
  | CalculatorEmbedBlock
  | CrisisBlock;
export type MarkdownBlock = BlockBase & {
  id: Key;
  type: 'markdown';
  markdown: string;
  claimIds?: Key[];
};
export type RelatedBlock = RelatedBlock1 & {
  id: Key;
  type: 'related';
  calculatorSlugs?: Slug[];
  measurementKeys?: Slug[];
  contentSlugs?: Slug[];
  claimIds?: Key[];
};
export type RelatedBlock1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type Citation = Citation1 & {
  id: Key;
  type: 'niro' | 'guideline' | 'government' | 'journal' | 'reference' | 'internal';
  org?: string;
  authors?: string[];
  title: string;
  url?: string;
  localRef?: string;
  identifier?: string;
  publishedAt?: string;
  accessedAt?: string;
  verificationStatus:
    | 'fetch-verified'
    | 'source-provided'
    | 'search-verified'
    | 'blocked-cited'
    | 'needs-verification';
  licenseStatus: 'clear' | 'permission-required' | 'licensed' | 'unknown' | 'not-applicable';
  primarySource?: boolean;
  reviewExpiresAt?: string;
  note?: string;
};
export type Citation1 = {
  [k: string]: unknown;
};
export type InputValue =
  | Scalar
  | {
      value: number;
      unit: string;
    };

/**
 * @deprecated
 */
export interface LegacyNiroSourceStatus {
  banner: string;
  explanation: string;
  governanceCaveat?: string;
  remainingClarifications?: string[];
}
export interface Unit {
  canonical: string;
  /**
   * @minItems 1
   */
  allowed?: [UnitChoice, ...UnitChoice[]];
}
export interface UnitChoice {
  code: string;
  factor: number;
  offset?: number;
}
export interface Validation {
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  softMin?: number;
  softMax?: number;
}
export interface Option {
  value: Scalar;
  label: string;
  source?: Source;
}
export interface Source {
  type?: 'niro' | 'external' | 'internal' | 'needs-clarification';
  ref?: string;
  org?: string;
  title?: string;
  url?: string;
  accessed?: string;
  note?: string;
  verification?:
    | 'fetch-verified'
    | 'search-verified'
    | 'blocked-cited'
    | 'source-provided'
    | 'needs-verification';
  demoPoints?: boolean;
  claimIds?: Key[];
}
export interface Derived {
  formula: string;
  /**
   * @minItems 1
   */
  dependsOn: [Key, ...Key[]];
}
export interface Context {
  when: null | Condition;
  /**
   * @minItems 1
   */
  bands: [ScoreBand, ...ScoreBand[]];
  source?: Source;
  asWritten?: boolean;
  /**
   * @minItems 1
   */
  clarificationRefs?: [string, ...string[]];
}
export interface OptionPoint {
  value: Scalar;
  points: number;
  source?: Source;
}
export interface ParameterGroupAggregation {
  key: Key;
  label: string;
  aggregate: 'max' | 'min' | 'sum' | 'mean';
  /**
   * @minItems 1
   */
  parameterKeys: [Key, ...Key[]];
  emptyPolicy?: 'absent' | 'zero' | 'block';
  source?: Source;
}
export interface ImputationRule {
  key: Key;
  parameterKey: Key;
  when: Condition;
  action: ImputationAction;
  fallbackPolicy?: 'block' | 'exclude-from-max' | 'zero-points' | 'not-applicable';
  source?: Source;
}
export interface ImputationBandAction {
  bandParam: Key;
  /**
   * @minItems 1
   */
  bands: [ScoreBand, ...ScoreBand[]];
}
export interface LegacyLookupRow {
  points: number;
  riskPct: number;
  orBelow?: boolean;
  orAbove?: boolean;
  display?: string;
}
export interface LookupEntry {
  input: Scalar;
  output: Scalar;
  orBelow?: boolean;
  orAbove?: boolean;
  display?: string;
  source?: Source;
}
export interface Formula {
  key: Key;
  symbol?: Key;
  expression: string;
  scope?: 'global' | 'per-domain';
  note?: string;
  source?: Source;
}
export interface FloorRule {
  key: Key;
  label: string;
  appliesWhen: FloorAppliesWhen;
  /**
   * @minItems 1
   */
  tiers: [FloorTier, ...FloorTier[]];
  display?: string;
  source?: Source;
}
export interface Domain {
  key: Key;
  label: string;
  weight: number;
  implicit?: boolean;
  parameterKeys: Key[];
  aggregateKeys?: Key[];
  source?: Source;
}
export interface DomainAggregationPolicy {
  zeroDenominator: 'unscored' | 'block' | 'no-score';
  missingDomainPolicy: 'block' | 'exclude-and-renormalize' | 'zero-contribution' | 'no-score';
  negativeDomainPolicy: 'preserve' | 'clamp-zero';
  minimumWeightCoverage?: number;
  minimumParameterCoverage?: number;
}
export interface ResultCategories {
  scale: Scale;
  bandEdges: 'min-inclusive' | 'explicit';
  boundarySemantics?: BoundarySemantics;
  scoreLattice?: {
    step: number;
    origin: number;
  };
  /**
   * @minItems 1
   */
  bands: [ResultBand, ...ResultBand[]];
  overrides?: ResultOverride[];
}
export interface Scale {
  min: number;
  max: number;
  unit?: string;
  direction: 'higher-is-worse' | 'lower-is-worse' | 'higher-is-better' | 'lower-is-better';
  clamp?: boolean;
  displayDecimals?: number;
}
export interface BoundarySemantics {
  status: 'confirmed' | 'as-documented' | 'needs-clarification';
  note: string;
}
export interface ResultOverride {
  when: Condition;
  minCategory: string;
  source?: Source;
}
export interface UiConfig {
  theme: Theme;
  /**
   * @minItems 1
   */
  steps: [UiStep, ...UiStep[]];
  result: UiResult;
}
export interface Theme {
  accent: string;
}
export interface UiStep {
  key: Key;
  title: string;
  /**
   * @minItems 1
   */
  parameterGroups: [Key, ...Key[]];
}
export interface UiResult {
  /**
   * @minItems 1
   */
  layout: [
    (
      | 'score-gauge'
      | 'category'
      | 'key-contributors'
      | 'domain-breakdown'
      | 'biomarker-details'
      | 'recommendations'
    ),
    ...(
      | 'score-gauge'
      | 'category'
      | 'key-contributors'
      | 'domain-breakdown'
      | 'biomarker-details'
      | 'recommendations'
    )[],
  ];
  informationHierarchy?: string;
}
/**
 * Structured calculator-associated page content with claim-level evidence, authorship, SEO, lifecycle, and medical review.
 */
export interface NiroCalculatorContentPageV1 {
  schemaVersion: 'content-page.v1';
  contentId: Slug;
  version: number;
  locale: string;
  slug: Slug;
  title: string;
  summary: string;
  /**
   * @minItems 1
   */
  blocks: [ContentBlock, ...ContentBlock[]];
  claims: Claim[];
  citations: Citation[];
  authorship: Authorship;
  medicalReview: MedicalReview;
  seo: Seo;
  publication: Publication;
  related?: Related;
}
export interface BlockBase {
  id: Key;
  type: string;
  claimIds?: Key[];
  [k: string]: unknown;
}
export interface CalloutBlock {
  id: Key;
  type: 'callout';
  tone: 'information' | 'caution' | 'warning' | 'success';
  title?: string;
  markdown: string;
  claimIds?: Key[];
}
export interface FaqBlock {
  id: Key;
  type: 'faq';
  /**
   * @minItems 1
   */
  items: [FaqItem, ...FaqItem[]];
  claimIds?: Key[];
}
export interface FaqItem {
  id: Key;
  question: string;
  answerMarkdown: string;
  claimIds?: Key[];
}
export interface StepsBlock {
  id: Key;
  type: 'steps';
  /**
   * @minItems 1
   */
  steps: [
    {
      title: string;
      markdown: string;
      claimIds?: Key[];
    },
    ...{
      title: string;
      markdown: string;
      claimIds?: Key[];
    }[],
  ];
  claimIds?: Key[];
}
export interface TableBlock {
  id: Key;
  type: 'table';
  caption: string;
  /**
   * @minItems 1
   */
  headers: [string, ...string[]];
  /**
   * @minItems 1
   */
  rows: [[string, ...string[]], ...[string, ...string[]][]];
  claimIds?: Key[];
}
export interface MediaBlock {
  id: Key;
  type: 'media';
  assetId: string;
  alt: string;
  caption?: string;
  claimIds?: Key[];
}
export interface DisclaimerBlock {
  id: Key;
  type: 'disclaimer';
  markdown: string;
  claimIds?: Key[];
}
export interface CalculatorEmbedBlock {
  id: Key;
  type: 'calculator-embed';
  calculatorSlug: Slug;
  claimIds?: Key[];
}
export interface CrisisBlock {
  id: Key;
  type: 'crisis-resources';
  triggerRef: string;
  markdown: string;
  /**
   * @minItems 1
   */
  resources: [CrisisResource, ...CrisisResource[]];
  claimIds?: Key[];
}
export interface CrisisResource {
  region: string;
  label: string;
  contact: string;
  url?: string;
}
export interface Claim {
  id: Key;
  text: string;
  kind:
    | 'medical-fact'
    | 'threshold'
    | 'formula'
    | 'recommendation'
    | 'product-description'
    | 'disclaimer'
    | 'nonmedical';
  citationIds: Key[];
  reviewStatus: 'unreviewed' | 'verified' | 'disputed' | 'expired' | 'not-applicable';
  reviewNote?: string;
}
export interface Authorship {
  /**
   * @minItems 1
   */
  contributors: [Contributor, ...Contributor[]];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Contributor {
  id: string;
  displayName: string;
  role: 'author' | 'editor' | 'medical-reviewer' | 'source-reviewer';
  credentials?: string;
  profileSlug?: Slug;
}
export interface MedicalReview {
  status:
    | 'unreviewed'
    | 'in-review'
    | 'approved'
    | 'changes-requested'
    | 'rejected'
    | 'expired'
    | 'not-applicable';
  scope: 'content-only' | 'clinical-claims' | 'full-page' | 'not-applicable';
  reviewerId: string | null;
  reviewedAt: string | null;
  nextReviewAt: string | null;
  decisionNote: string | null;
  approvedClaimIds?: Key[];
}
export interface Seo {
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  robots: {
    index: boolean;
    follow: boolean;
  };
  /**
   * @minItems 1
   */
  schemaTypes: [
    'WebPage' | 'MedicalWebPage' | 'FAQPage' | 'SoftwareApplication' | 'BreadcrumbList',
    ...('WebPage' | 'MedicalWebPage' | 'FAQPage' | 'SoftwareApplication' | 'BreadcrumbList')[],
  ];
  openGraph?: {
    title?: string;
    description?: string;
    image?: SocialImage;
  };
  keywords?: string[];
  redirectsFrom?: string[];
}
export interface SocialImage {
  assetId: string;
  alt: string;
}
export interface Publication {
  status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired';
  publishedAt: string | null;
  retiredAt: string | null;
  changelog: string;
  replacementSlug?: Slug;
}
export interface Related {
  calculatorSlugs?: Slug[];
  measurementKeys?: Slug[];
  contentSlugs?: Slug[];
}
export interface Governance {
  clinicalStatus: 'unreviewed' | 'in-review' | 'approved' | 'rejected' | 'not-applicable';
  sourceReviewStatus: 'unreviewed' | 'partial' | 'verified' | 'expired' | 'not-applicable';
  discrepancyIds: string[];
  publishBlockers: string[];
  reviews?: ReviewEvidence[];
  measurementRevisionIds?: string[];
  sourceReviewExpiresAt?: string;
}
export interface ReviewEvidence {
  reviewerId: string;
  reviewedAt: string;
  decision: 'approved' | 'changes-requested' | 'rejected';
  scope: 'clinical-logic' | 'content' | 'sources' | 'full-version';
  note?: string;
}
export interface TestCase {
  key: Key;
  name: string;
  kind: 'nonclinical-fixture' | 'source-worked-example' | 'boundary' | 'regression';
  inputs: {
    [k: string]: InputValue;
  };
  expected:
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      }
    | {
        [k: string]: unknown;
      };
  source?: Source;
}
