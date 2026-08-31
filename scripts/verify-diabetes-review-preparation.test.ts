import { describe, expect, it } from 'vitest';

import {
  DIABETES_EXTERNAL_BLOCKERS,
  expectedDiabetesReviewPacket,
  readDiabetesReviewPacket,
  validateDiabetesReviewArguments,
  validateDiabetesReviewPacket,
} from './verify-diabetes-review-preparation';

interface EvidencePointer {
  status: string;
  authoritativeArtifactRef: string | null;
  authoritativeArtifactSha256: string | null;
}

interface TestPacket extends Record<string, unknown> {
  policy: Record<string, boolean>;
  externalBlockers: {
    id: string;
    status: string;
  }[];
  measurementCandidates: {
    revision: number;
    lifecycleStatus: string;
    reviewStatus: string;
    approvalState: string;
    bindable: boolean;
    bindingState: string;
  }[];
  evidencePlaceholders: {
    boundaryExamples: (EvidencePointer & { blockerId: string })[];
    completeSourceWorkedExample: EvidencePointer & {
      completeInputsPresent: boolean;
      expectedFinalScorePresent: boolean;
      expectedCategoryPresent: boolean;
      preciseSourceLocatorPresent: boolean;
    };
  };
  preflight: {
    calculatorFixture: {
      sha256: string;
    };
  };
}

function clonedPacket(): TestPacket {
  return structuredClone(readDiabetesReviewPacket()) as unknown as TestPacket;
}

describe('Diabetes non-executable review-preparation packet', () => {
  it('matches the locked template and current source, fixture, register, and measurement seed', () => {
    const packet = readDiabetesReviewPacket();
    expect(packet).toEqual(expectedDiabetesReviewPacket());
    expect(validateDiabetesReviewPacket(packet)).toEqual([]);
  });

  it('keeps every external blocker open and every authority example blank', () => {
    const packet = clonedPacket();
    expect(packet.policy).toMatchObject({
      autoApply: false,
      autoApprove: false,
      databaseWriteAllowed: false,
      clinicalValuesPresent: false,
      approvalEvidencePresent: false,
      canSatisfyPublicationGate: false,
    });
    expect(packet.externalBlockers.map((entry) => entry.id)).toEqual(DIABETES_EXTERNAL_BLOCKERS);
    expect(packet.externalBlockers.every((entry) => entry.status === 'open')).toBe(true);
    expect(
      packet.evidencePlaceholders.boundaryExamples.every(
        (entry) =>
          entry.status === 'awaiting-authority' &&
          entry.authoritativeArtifactRef === null &&
          entry.authoritativeArtifactSha256 === null,
      ),
    ).toBe(true);
    expect(packet.evidencePlaceholders.completeSourceWorkedExample).toMatchObject({
      status: 'awaiting-authority',
      authoritativeArtifactRef: null,
      authoritativeArtifactSha256: null,
      completeInputsPresent: false,
      expectedFinalScorePresent: false,
      expectedCategoryPresent: false,
      preciseSourceLocatorPresent: false,
    });
  });

  it('keeps both revision-3 candidates explicitly unapproved, non-bindable, and non-applied', () => {
    const packet = clonedPacket();
    expect(packet.measurementCandidates).toHaveLength(2);
    expect(
      packet.measurementCandidates.every(
        (candidate) =>
          candidate.revision === 3 &&
          candidate.lifecycleStatus === 'draft' &&
          candidate.reviewStatus === 'unreviewed' &&
          candidate.approvalState === 'unapproved' &&
          candidate.bindable === false &&
          candidate.bindingState === 'not-bound-candidate-only',
      ),
    ).toBe(true);
  });

  it('rejects closed blockers, bindable candidates, populated examples, and executable values', () => {
    const closed = clonedPacket();
    const firstBlocker = closed.externalBlockers[0];
    if (!firstBlocker) throw new Error('Expected at least one Diabetes blocker.');
    firstBlocker.status = 'resolved';
    expect(validateDiabetesReviewPacket(closed).join(' ')).toContain(
      'forbidden lifecycle/approval',
    );

    const bindable = clonedPacket();
    const firstCandidate = bindable.measurementCandidates[0];
    if (!firstCandidate) throw new Error('Expected at least one measurement candidate.');
    firstCandidate.bindable = true;
    expect(validateDiabetesReviewPacket(bindable).join(' ')).toContain(
      'not explicitly unapproved and non-bindable',
    );

    const populated = clonedPacket();
    populated.evidencePlaceholders.completeSourceWorkedExample.authoritativeArtifactRef =
      'received/example.json';
    expect(validateDiabetesReviewPacket(populated).join(' ')).toContain('exact locked');

    const executable = clonedPacket();
    executable.scoringRules = [{ threshold: 1 }];
    const executableFindings = validateDiabetesReviewPacket(executable).join(' ');
    expect(executableFindings).toContain('scoringRules');
    expect(executableFindings).toContain('numeric value outside the revision-only allowlist');
  });

  it('rejects packet hash drift and unsupported CLI modes', () => {
    const drifted = clonedPacket();
    drifted.preflight.calculatorFixture.sha256 = '0'.repeat(64);
    expect(validateDiabetesReviewPacket(drifted).join(' ')).toContain(
      'preflight metadata for calculatorFixture',
    );
    expect(() => validateDiabetesReviewArguments([])).not.toThrow();
    expect(() => validateDiabetesReviewArguments(['--check'])).not.toThrow();
    expect(() => validateDiabetesReviewArguments(['--write'])).toThrow('Usage:');
  });
});
