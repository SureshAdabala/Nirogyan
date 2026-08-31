import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildReadinessReport,
  checkReadinessArtifacts,
  generatedReadinessArtifacts,
  readEvidenceRequests,
  stableReadinessJson,
  validateEvidenceRequests,
  validateReadinessArguments,
  type NiroEvidenceRequests,
} from './generate-niro-readiness-report';

function clonedSource(): NiroEvidenceRequests {
  return structuredClone(readEvidenceRequests());
}

describe('P8 publication-readiness evidence workflow', () => {
  it('locks the exact four drafts and separates completed engineering dispositions', () => {
    const source = readEvidenceRequests();
    expect(validateEvidenceRequests(source)).toEqual([]);
    expect(source.calculators.map((entry) => entry.calculatorSlug)).toEqual([
      'diabetes-risk',
      'heart-risk',
      'hypothyroid-risk',
      'niro-cws',
    ]);
    expect(source.calculators.every((entry) => entry.applicationState === 'draft')).toBe(true);
    expect(source.calculators.every((entry) => entry.releaseState.includes('blocked'))).toBe(true);
    const externalBlockerIds = source.calculators.flatMap(
      (entry) => entry.externalClinicalBlockerIds,
    );
    expect(externalBlockerIds).toHaveLength(56);
    expect(externalBlockerIds).not.toContain('CWS-17');
    expect(
      source.calculators
        .find((entry) => entry.calculatorSlug === 'niro-cws')
        ?.lockedEngineeringDispositions.map((entry) => entry.discrepancyId),
    ).toContain('CWS-17');
    expect(source.calculators.flatMap((entry) => entry.requests)).toHaveLength(20);
    expect(source.calculators.flatMap((entry) => entry.requests)).not.toContainEqual(
      expect.objectContaining({ status: 'approved' }),
    );
  });

  it('fails closed if a blocker disappears or a workflow implies received approval', () => {
    const missingBlocker = clonedSource();
    const first = missingBlocker.calculators[0];
    if (!first) throw new Error('Missing fixture calculator.');
    (first.externalClinicalBlockerIds as string[]).pop();
    expect(validateEvidenceRequests(missingBlocker)).toContain(
      'calculators[0].externalClinicalBlockerIds differs from the current P8 blocker register.',
    );

    const fabricatedApproval = clonedSource();
    const review = fabricatedApproval.calculators[0]?.requests[4];
    if (!review) throw new Error('Missing fixture review request.');
    (review as { status: string }).status = 'awaiting-external-evidence';
    expect(validateEvidenceRequests(fabricatedApproval)).toContain(
      'calculators[0].requests[4].status cannot imply unreceived evidence or approval.',
    );
  });

  it('rejects executable calculator data or trusted review evidence in the handoff register', () => {
    const source = clonedSource() as NiroEvidenceRequests & Record<string, unknown>;
    source.testCases = [];
    const findings = validateEvidenceRequests(source);
    expect(
      findings.some((finding) => finding.includes('prohibited executable/evidence keys')),
    ).toBe(true);
  });

  it('reports every candidate as ineligible and preserves the partial Heart golden boundary', () => {
    const report = buildReadinessReport();
    const summary = report.summary as Record<string, number>;
    const calculators = report.calculators as readonly Record<string, unknown>[];
    const partialGolden = report.partialGoldenEvidence as Record<string, unknown>;
    expect(summary).toMatchObject({
      calculatorCount: 4,
      publicationEligibleCount: 0,
      publicationBlockedCount: 4,
      externalClinicalBlockerCount: 56,
      evidenceRequestCount: 20,
      acceptedEvidenceCount: 0,
    });
    expect(calculators.every((entry) => entry.publishEligible === false)).toBe(true);
    expect(partialGolden.satisfiesPUB007).toBe(false);
    expect(stableReadinessJson(report).toLowerCase()).not.toContain('covid-risk-check');
    expect(stableReadinessJson(report).replaceAll('\\', '/')).not.toContain('/catalog/');
  });

  it('generates stable checked artifacts without runtime timestamps or writes', () => {
    const once = generatedReadinessArtifacts();
    const twice = generatedReadinessArtifacts();
    expect(twice).toEqual(once);
    expect(checkReadinessArtifacts()).toEqual([]);
    expect(once.json).toBe(
      readFileSync('packages/contracts/reports/niro-publication-readiness.v1.json', 'utf8'),
    );
    expect(once.markdown).toBe(
      readFileSync('packages/contracts/reports/niro-publication-readiness.v1.md', 'utf8'),
    );
  });

  it('requires an explicit report mode and rejects ambiguous arguments', () => {
    expect(validateReadinessArguments([])).toBe('check');
    expect(validateReadinessArguments(['--check'])).toBe('check');
    expect(validateReadinessArguments(['--write'])).toBe('write');
    expect(() => validateReadinessArguments(['--write', '--check'])).toThrow(
      '--write and --check are mutually exclusive.',
    );
    expect(() => validateReadinessArguments(['--import'])).toThrow(
      'Unsupported readiness argument: --import.',
    );
  });
});
