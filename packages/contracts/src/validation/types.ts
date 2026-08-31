export type ValidationLayer = 'structural' | 'semantic' | 'clinical' | 'publish';
export type FindingSeverity = 'error' | 'warning' | 'info';
export type FindingStatus = 'open' | 'accepted-with-evidence' | 'resolved' | 'superseded';

export interface ValidationEvidence {
  readonly ref?: string;
  readonly note?: string;
}

export interface ValidationFinding {
  readonly id: string;
  readonly layer: ValidationLayer;
  readonly severity: FindingSeverity;
  readonly artifact: string;
  readonly jsonPath: string;
  readonly message: string;
  readonly relatedDiscrepancyIds: readonly string[];
  readonly remediation: string;
  readonly status: FindingStatus;
  readonly evidence: readonly ValidationEvidence[];
}

export interface ValidationLayerResult {
  readonly layer: ValidationLayer;
  readonly passed: boolean;
  readonly findings: readonly ValidationFinding[];
}

export interface CalculatorValidationResult {
  readonly artifact: string;
  readonly structural: ValidationLayerResult;
  readonly semantic: ValidationLayerResult;
  readonly clinical: ValidationLayerResult;
  readonly publish: ValidationLayerResult;
  readonly publishEligible: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
}
