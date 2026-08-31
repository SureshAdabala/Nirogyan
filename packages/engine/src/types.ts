export type Scalar = string | number | boolean | null;

export interface MeasurementInput {
  readonly value: number;
  readonly unit?: string;
}

export type InputValue = Scalar | MeasurementInput | undefined;

export interface EngineError {
  readonly code:
    | 'INVALID_INPUT'
    | 'MISSING_REQUIRED_INPUT'
    | 'UNKNOWN_PARAMETER'
    | 'UNIT_NOT_ALLOWED'
    | 'UNIT_VALUE_INVALID'
    | 'DERIVATION_ERROR'
    | 'EXPRESSION_ERROR'
    | 'NO_SCORING_RULE'
    | 'NO_BAND_MATCH'
    | 'NO_SCORING_CONTEXT'
    | 'NO_SCORING_BAND'
    | 'AGGREGATE_EMPTY'
    | 'DOMAIN_UNSCORABLE'
    | 'FORMULA_DOMAIN_ERROR'
    | 'LOOKUP_MISS'
    | 'SCALE_ASSERTION_FAILED'
    | 'BLOCKED_BY_POLICY';
  readonly path: string;
  readonly message: string;
}

export interface TraceStep {
  readonly sequence?: number;
  readonly stage?: string;
  readonly kind:
    | 'input'
    | 'normalization'
    | 'derived'
    | 'score'
    | 'aggregate'
    | 'formula'
    | 'result'
    | 'adjustment'
    | 'floor';
  readonly key: string;
  readonly value?: unknown;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface ParameterResult {
  readonly key: string;
  readonly input: unknown;
  readonly value?: Scalar;
  readonly canonicalUnit?: string;
  readonly missing: boolean;
  readonly points?: number;
  /** Greatest points reachable for this parameter in its selected context. */
  readonly possiblePoints?: number;
  /** True when the contribution was supplied by an explicit imputation rule. */
  readonly imputed?: boolean;
  /** False visibility means the submitted value is intentionally ignored. */
  readonly applicable?: boolean;
  readonly status: 'scored' | 'missing' | 'excluded' | 'blocked';
}

export interface DomainResult {
  readonly key: string;
  readonly points: number;
  readonly weight: number;
  readonly parameterKeys: readonly string[];
  readonly scoredCount: number;
  readonly missingCount: number;
  readonly applicableCount: number;
  readonly possiblePoints: number;
  readonly earnedPoints: number;
  readonly score?: number;
  readonly formulas?: Readonly<Record<string, Scalar>>;
  readonly coverage: number;
  readonly status: 'scored' | 'empty' | 'blocked';
}

export interface CoverageMatrixEntry {
  readonly key: string;
  readonly kind: 'parameter' | 'aggregate' | 'domain';
  readonly applicable: boolean;
  readonly scored: boolean;
  readonly missing: boolean;
  readonly earnedPoints: number;
  readonly possiblePoints: number;
  readonly coverage: number;
  readonly sourceGap: boolean;
  readonly clarificationRefs: readonly string[];
}

export interface CoverageSummary {
  readonly entries: readonly CoverageMatrixEntry[];
  readonly scoredParameterCount: number;
  readonly applicableScoredParameterCount: number;
  readonly possibleParameterCount: number;
  readonly earnedPoints: number;
  readonly possiblePoints: number;
  readonly parameterCoverage: number;
  readonly possibleWeightCoverage: number;
  readonly domainCoverage: number;
}

export interface EngineResult {
  readonly ok: boolean;
  readonly calculatorSlug: string;
  readonly version: number;
  readonly score?: number;
  readonly category?: {
    readonly label: string;
    readonly color?: string;
    readonly message?: string;
    readonly recommendation?: string;
  };
  readonly parameters: readonly ParameterResult[];
  readonly domains: readonly DomainResult[];
  readonly coverage: CoverageSummary;
  readonly contributors: {
    readonly harmful: readonly ParameterResult[];
    readonly protective: readonly ParameterResult[];
  };
  readonly formulas: Readonly<Record<string, Scalar>>;
  readonly errors: readonly EngineError[];
  readonly warnings: readonly string[];
  readonly trace: readonly TraceStep[];
}

export interface EngineOptions {
  readonly includeTrace?: boolean;
  readonly rejectUnknownInputs?: boolean;
}
