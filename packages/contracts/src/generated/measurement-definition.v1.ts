/** Generated from measurement-definition.v1.schema.json; edit the canonical JSON Schema instead. */

/**
 * Canonical definition for a versioned biomarker, vital, anthropometric measurement, derived measurement, or contextual input.
 */
export type NiroMeasurementDefinitionV1 = {
  [k: string]: unknown;
} & {
  schemaVersion: 'measurement-definition.v1';
  key: Slug;
  version: number;
  status: 'draft' | 'in-review' | 'approved' | 'retired';
  displayName: string;
  aliases?: string[];
  formerKeys?: Slug[];
  kind:
    | 'laboratory-biomarker'
    | 'vital'
    | 'anthropometric'
    | 'derived-measurement'
    | 'questionnaire-response'
    | 'context';
  panels?: Slug[];
  domainKeys?: Slug[];
  valueType: 'number' | 'integer' | 'boolean' | 'coded-value';
  canonicalUnit: Unit;
  acceptedUnits?: Unit[];
  conversions?: Conversion[];
  inputBounds: InputBounds;
  referenceRanges: ReferenceRange[];
  derived?: DerivedMeasurement;
  description?: {
    whatItMeasures?: string;
    whyItMatters?: string;
    collectionNotes?: string;
    limitations?: string;
  };
  /**
   * @minItems 1
   */
  sources: [Source, ...Source[]];
  governance: Governance;
};
export type Slug = string;
export type Conversion = AffineConversion | CompositeConversion;
export type Interval = Interval1 & {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
};
export type Interval1 = {
  [k: string]: unknown;
};
export type Source = Source1 & {
  id: Slug;
  type: 'niro' | 'external' | 'internal';
  org?: string;
  title: string;
  url?: string;
  ref?: string;
  accessed?: string;
  verification:
    | 'fetch-verified'
    | 'source-provided'
    | 'search-verified'
    | 'blocked-cited'
    | 'needs-verification';
  /**
   * @minItems 1
   */
  claimIds?: [Slug, ...Slug[]];
  note?: string;
} & Source1 & {
    id: Slug;
    type: 'niro' | 'external' | 'internal';
    org?: string;
    title: string;
    url?: string;
    ref?: string;
    accessed?: string;
    verification:
      | 'fetch-verified'
      | 'source-provided'
      | 'search-verified'
      | 'blocked-cited'
      | 'needs-verification';
    /**
     * @minItems 1
     */
    claimIds?: [Slug, ...Slug[]];
    note?: string;
  };
export type Source1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };

export interface Unit {
  code: string;
  dimension:
    | 'dimensionless'
    | 'mass'
    | 'length'
    | 'time'
    | 'temperature'
    | 'pressure'
    | 'substance-concentration'
    | 'mass-concentration'
    | 'count-concentration'
    | 'enzyme-activity-concentration'
    | 'rate'
    | 'area'
    | 'volume'
    | 'energy'
    | 'composite';
  display: string;
  ucum?: string;
}
export interface AffineConversion {
  kind: 'affine';
  fromUnit: string;
  toUnit: string;
  factor: number;
  offset: number;
  /**
   * @minItems 1
   */
  sourceClaimIds?: [Slug, ...Slug[]];
}
export interface CompositeConversion {
  kind: 'composite';
  adapter: 'feet-inches-to-centimetres' | 'stone-pounds-to-kilograms';
  /**
   * @minItems 2
   * @maxItems 2
   */
  from: [
    {
      field: Slug;
      unit: string;
    },
    {
      field: Slug;
      unit: string;
    },
  ];
  toUnit: string;
  /**
   * @minItems 1
   */
  sourceClaimIds?: [Slug, ...Slug[]];
}
export interface InputBounds {
  hard: Interval;
  soft?: Interval;
  integerOnly?: boolean;
  displayDecimals?: number;
  note?: string;
}
export interface ReferenceRange {
  id: Slug;
  label: string;
  unit: string;
  interval: Interval;
  context: RangeContext;
  interpretation?: string;
  interpretationOnly: true;
  /**
   * @minItems 1
   */
  sourceClaimIds: [Slug, ...Slug[]];
  conflictGroup?: Slug;
  reviewExpiresAt?: string;
}
export interface RangeContext {
  sexAtBirth?: 'female' | 'male' | 'intersex' | 'not-specified';
  ageMinYears?: number;
  ageMaxYears?: number;
  pregnancyStatus?: 'pregnant' | 'not-pregnant' | 'unknown';
  menopausalStatus?: 'pre' | 'peri' | 'post' | 'unknown';
  fastingStatus?: 'fasting' | 'non-fasting' | 'unknown';
  specimen?: string;
  sampleTiming?: string;
  population?: string;
  method?: string;
}
export interface DerivedMeasurement {
  expression: string;
  /**
   * @minItems 1
   */
  dependsOn: [Slug, ...Slug[]];
  semanticVersion: string;
  /**
   * @minItems 1
   */
  sourceClaimIds?: [Slug, ...Slug[]];
}
export interface Governance {
  reviewStatus: 'unreviewed' | 'in-review' | 'approved' | 'changes-requested' | 'expired';
  reviewedAt: string | null;
  reviewerId: string | null;
  reviewExpiresAt?: string | null;
  publishBlockers: string[];
  conflictIds?: Slug[];
  legacyRecordRefs?: string[];
}
