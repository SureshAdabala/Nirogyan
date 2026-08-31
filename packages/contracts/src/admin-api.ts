import type { Source } from './generated/calculator-version.v1';
import type { ValidationLayerResult } from './validation/types';

/** Safe administrative roles exposed by the authenticated API. */
export type AdminApiRole = 'admin' | 'editor' | 'medical-reviewer';

export type AdminCalculatorLifecycleStatus =
  'draft' | 'in-review' | 'approved' | 'published' | 'retired' | 'rejected';

export interface AdminApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fields?: unknown;
  };
}

export interface AdminApiDataEnvelope<T> {
  readonly data: T;
}

export interface AdminIdentity {
  readonly id: string;
  readonly email: string;
  readonly role: AdminApiRole;
}

export interface AdminCalculatorSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: AdminCalculatorLifecycleStatus;
  readonly currentVersionId?: string;
  readonly draftVersionId?: string;
  readonly updatedAt?: string;
}

/**
 * Server-owned approval evidence. The reviewer and protected hash come from the
 * authenticated write and persisted version, never from a client assertion.
 */
export interface AdminReviewEvidenceSnapshot {
  readonly reviewerId: string;
  readonly reviewedAt: string;
  readonly decision: 'approved';
  readonly scope: 'full-version';
  readonly protectedHash: string;
}

export interface AdminMeasurementBindingSummary {
  readonly revisionIds: readonly string[];
  readonly count: number;
}

/** Full payload is authorized admin data and may intentionally be an invalid draft. */
export interface AdminCalculatorVersion {
  readonly id: string;
  readonly calculatorSlug: string;
  readonly version: number;
  readonly status: AdminCalculatorLifecycleStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly versionHash?: string;
  readonly createdBy?: string;
  readonly lastEditedBy?: string;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly reviewEvidence?: AdminReviewEvidenceSnapshot;
  readonly publishedAt?: string;
  readonly immutableAt?: string;
  readonly changelog?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly measurements: AdminMeasurementBindingSummary;
}

export interface AdminValidationSummary {
  readonly publishEligible: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly layers: {
    readonly structural: ValidationLayerResult;
    readonly semantic: ValidationLayerResult;
    readonly clinical: ValidationLayerResult;
    readonly publish: ValidationLayerResult;
  };
}

export interface AdminCreateCalculatorRequest {
  readonly slug: string;
  readonly name: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly measurementRevisionIds?: readonly string[];
}

export interface AdminCreateCalculatorVersionRequest {
  readonly sourceVersion?: number;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly measurementRevisionIds?: readonly string[];
}

export interface AdminUpdateCalculatorVersionRequest {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly measurementRevisionIds?: readonly string[];
}

/** Schema-aligned provenance attached to a saved calculator test case. */
export type AdminTestCaseSource = Readonly<Source>;

export interface AdminTestCase {
  readonly key: string;
  readonly name: string;
  readonly kind: 'nonclinical-fixture' | 'source-worked-example' | 'boundary' | 'regression';
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly source?: AdminTestCaseSource;
}

export interface AdminTestCaseRunResult {
  readonly key: string;
  readonly passed: boolean;
  readonly checks: readonly Readonly<Record<string, unknown>>[];
  readonly result: Readonly<Record<string, unknown>>;
}

export interface AdminTestRunSummary {
  readonly passed: boolean;
  readonly cases: readonly AdminTestCaseRunResult[];
}
