import { describe, expect, it } from 'vitest';

import type {
  AdminCalculatorVersion,
  AdminCreateCalculatorRequest,
  AdminReviewEvidenceSnapshot,
} from './admin-api';

describe('admin API DTOs', () => {
  it('represent server-owned review evidence and revision-only client binding', () => {
    const request = {
      slug: 'nonclinical-example',
      name: 'Nonclinical example',
      payload: { status: 'draft' },
      measurementRevisionIds: ['507f1f77bcf86cd799439011'],
    } satisfies AdminCreateCalculatorRequest;
    const review = {
      reviewerId: '507f1f77bcf86cd799439012',
      reviewedAt: '2026-08-27T00:00:00.000Z',
      decision: 'approved',
      scope: 'full-version',
      protectedHash: 'a'.repeat(64),
    } satisfies AdminReviewEvidenceSnapshot;
    const version = {
      id: '507f1f77bcf86cd799439013',
      calculatorSlug: request.slug,
      version: 1,
      status: 'approved',
      payload: request.payload,
      approvedBy: review.reviewerId,
      approvedAt: review.reviewedAt,
      reviewEvidence: review,
      measurements: { revisionIds: request.measurementRevisionIds, count: 1 },
    } satisfies AdminCalculatorVersion;

    expect(version.reviewEvidence.protectedHash).toHaveLength(64);
    expect(version.measurements).toEqual({
      revisionIds: ['507f1f77bcf86cd799439011'],
      count: 1,
    });
    expect('measurementSnapshots' in request).toBe(false);
  });
});
