import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { stableMeasurementHash } from '../apps/server/src/modules/measurement-contract';
import { readEvidenceRequests, validateEvidenceRequests } from './generate-niro-readiness-report';

type JsonObject = Record<string, unknown>;

export const DIABETES_REVIEW_ROOT = resolve(__dirname, '..');
export const DIABETES_REVIEW_PACKET_PATH = join(
  DIABETES_REVIEW_ROOT,
  'data',
  'reconciliation',
  'evidence',
  'diabetes-risk',
  'review-preparation.v1.json',
);

export const DIABETES_EXTERNAL_BLOCKERS = [
  'DIA-01',
  'DIA-02',
  'DIA-03',
  'DIA-04',
  'DIA-06',
  'DIA-07',
  'DIA-09',
  'DIA-10',
  'DIA-11',
  'DIA-12',
  'DIA-13',
  'DIA-14',
] as const;

const EXPECTED_FILES = {
  sourceArtifact: {
    path: 'data/sources/risk-analysis/Risk calculators.xlsx',
    locator: 'data/sources/risk-analysis/Risk calculators.xlsx#Diabetes!B5:I27',
    sha256: 'f1d808861d61b1a4e748a2c079c0cafae521a3c1e0ef01c84cd015ac293fc089',
  },
  calculatorFixture: {
    path: 'data/fixtures/config-samples/diabetes-risk.config.json',
    sha256: '1dee527ed5ce64ac64f7a567577d1e3cee49a0c442a7afc2793a3b956d75152a',
  },
  measurementSeed: {
    path: 'data/seeds/core-measurements.v1.seed.json',
    sha256: '8e15cedd8c79eb37a202a36ca225be74a6c204d12e35d82187e35b7d632c371a',
  },
} as const;

const EXPECTED_MEASUREMENT_CANDIDATES = [
  {
    parameterKey: 'fbs',
    measurementKey: 'fasting-glucose',
    revision: 3,
    seedDefinitionHash: 'f4b636b1c550386c60c51eb1f3305864b8938ec5ae307fb91d1098fe8873794d',
    lifecycleStatus: 'draft',
    reviewStatus: 'unreviewed',
    approvalState: 'unapproved',
    bindable: false,
    bindingState: 'not-bound-candidate-only',
  },
  {
    parameterKey: 'hba1c',
    measurementKey: 'hba1c',
    revision: 3,
    seedDefinitionHash: 'bf8bea3734bf1a74c7e3ae31b0795eddbdf205c6aff8e3751b9f680c1dfe00e3',
    lifecycleStatus: 'draft',
    reviewStatus: 'unreviewed',
    approvalState: 'unapproved',
    bindable: false,
    bindingState: 'not-bound-candidate-only',
  },
] as const;

const FORBIDDEN_EXECUTABLE_KEYS = new Set([
  'parameters',
  'scoringRules',
  'parameterGroupsAggregation',
  'imputationRules',
  'lookupTables',
  'formulas',
  'floorRules',
  'domains',
  'domainAggregationPolicy',
  'adjustmentRules',
  'resultCategories',
  'uiConfig',
  'content',
  'testCases',
  'points',
  'weight',
  'bands',
  'threshold',
  'thresholds',
  'inputs',
  'sourceInputs',
  'expectedScore',
  'expectedCategory',
  'clinicalValue',
  'clinicalValues',
  'measurementRevisionIds',
  'measurementSnapshots',
  'reviewEvidence',
  'reviewHash',
  'protectedHash',
  'reviewerId',
  'reviewedAt',
  'approvedAt',
  'verifiedAt',
  'publishedAt',
]);

const FORBIDDEN_LIFECYCLE_VALUES = new Set([
  'accepted',
  'approved',
  'eligible',
  'published',
  'resolved',
  'verified',
]);

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function stableDiabetesReviewJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function blankEvidenceSlot(status: 'awaiting-authority' | 'blocked-by-prerequisite') {
  return {
    status,
    authoritativeArtifactRef: null,
    authoritativeArtifactSha256: null,
  } as const;
}

export function expectedDiabetesReviewPacket(): JsonObject {
  return {
    schemaVersion: 'diabetes-review-preparation.v1',
    calculatorSlug: 'diabetes-risk',
    kind: 'review-preparation-only-non-executable',
    purpose:
      'Pointer-only template for collecting authoritative Diabetes review artifacts without storing clinical values, executable logic, reviewer identities, approvals, or lifecycle changes.',
    normativeSpec: 'packages/contracts/specs/p8-evidence-handoff.v1.md',
    policy: {
      autoApply: false,
      autoApprove: false,
      databaseWriteAllowed: false,
      clinicalValuesPresent: false,
      approvalEvidencePresent: false,
      canSatisfyPublicationGate: false,
    },
    preflight: EXPECTED_FILES,
    externalBlockers: DIABETES_EXTERNAL_BLOCKERS.map((id) => ({
      id,
      status: 'open',
      authorityEvidenceRef: null,
      authorityEvidenceSha256: null,
      studioDispositionRef: null,
    })),
    lockedNonClinicalDispositions: ['DIA-05', 'DIA-08'].map((id) => ({
      id,
      scope: 'engineering-semantics-only',
      authorizesClinicalChange: false,
      authorizesPublication: false,
    })),
    measurementCandidates: EXPECTED_MEASUREMENT_CANDIDATES,
    evidencePlaceholders: {
      sourceOwnerDisposition: blankEvidenceSlot('awaiting-authority'),
      measurementReview: blankEvidenceSlot('awaiting-authority'),
      completeSourceWorkedExample: {
        ...blankEvidenceSlot('awaiting-authority'),
        completeInputsPresent: false,
        expectedFinalScorePresent: false,
        expectedCategoryPresent: false,
        preciseSourceLocatorPresent: false,
      },
      boundaryExamples: DIABETES_EXTERNAL_BLOCKERS.map((blockerId) => ({
        blockerId,
        ...blankEvidenceSlot('awaiting-authority'),
      })),
      contentGovernance: blankEvidenceSlot('awaiting-authority'),
      independentMedicalReview: blankEvidenceSlot('blocked-by-prerequisite'),
    },
    nextAllowedAction:
      'Preserve future authority artifacts outside this template, verify provenance and role, then apply accepted decisions only to a new Calculator Studio draft through the normal protected review workflow.',
  };
}

export function readDiabetesReviewPacket(path = DIABETES_REVIEW_PACKET_PATH): JsonObject {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error('Diabetes review-preparation packet must be an object.');
  return parsed;
}

function collectForbiddenMaterial(value: unknown): readonly string[] {
  const findings: string[] = [];
  const visit = (entry: unknown, path: string): void => {
    if (typeof entry === 'number') {
      if (!/^\$\.measurementCandidates\[\d+\]\.revision$/.test(path)) {
        findings.push(`${path} contains a numeric value outside the revision-only allowlist.`);
      }
      return;
    }
    if (typeof entry === 'string' && FORBIDDEN_LIFECYCLE_VALUES.has(entry.toLowerCase())) {
      findings.push(
        `${path} contains forbidden lifecycle/approval state ${JSON.stringify(entry)}.`,
      );
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(entry)) return;
    for (const [key, child] of Object.entries(entry)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_EXECUTABLE_KEYS.has(key)) {
        findings.push(`${childPath} is prohibited executable, clinical, or approval material.`);
      }
      visit(child, childPath);
    }
  };
  visit(value, '$');
  return findings;
}

function validateCanonicalRegister(findings: string[]): void {
  const requests = readEvidenceRequests();
  const registerFindings = validateEvidenceRequests(requests);
  findings.push(...registerFindings.map((finding) => `Evidence request register: ${finding}`));
  const diabetes = requests.calculators.find((entry) => entry.calculatorSlug === 'diabetes-risk');
  if (!diabetes) {
    findings.push('Canonical evidence request register has no diabetes-risk entry.');
    return;
  }
  if (
    stableDiabetesReviewJson(diabetes.externalClinicalBlockerIds) !==
    stableDiabetesReviewJson(DIABETES_EXTERNAL_BLOCKERS)
  ) {
    findings.push('Packet blocker allowlist differs from the canonical evidence request register.');
  }
  if (
    diabetes.requests.some(
      (request) => !request.status.includes('awaiting') && !request.status.includes('blocked'),
    )
  ) {
    findings.push('Canonical Diabetes evidence request unexpectedly implies received evidence.');
  }
}

function validatePreflightFiles(packet: JsonObject, findings: string[]): void {
  const preflight = isRecord(packet.preflight) ? packet.preflight : {};
  for (const [key, expected] of Object.entries(EXPECTED_FILES)) {
    const entry = isRecord(preflight[key]) ? preflight[key] : {};
    const absolutePath = join(DIABETES_REVIEW_ROOT, expected.path);
    const actualHash = sha256File(absolutePath);
    if (actualHash !== expected.sha256) {
      findings.push(`${expected.path} drifted from the reviewed SHA-256 baseline.`);
    }
    if (entry.path !== expected.path || entry.sha256 !== actualHash) {
      findings.push(
        `Packet preflight metadata for ${key} does not match the current reviewed file.`,
      );
    }
    if ('locator' in expected && entry.locator !== expected.locator) {
      findings.push('Packet source locator differs from the exact Diabetes source locator.');
    }
  }
}

function validateMeasurementSeed(packet: JsonObject, findings: string[]): void {
  const seed = JSON.parse(
    readFileSync(join(DIABETES_REVIEW_ROOT, EXPECTED_FILES.measurementSeed.path), 'utf8'),
  ) as { readonly records?: readonly { readonly definition?: JsonObject }[] };
  const candidates = Array.isArray(packet.measurementCandidates)
    ? packet.measurementCandidates
    : [];
  for (const expected of EXPECTED_MEASUREMENT_CANDIDATES) {
    const record = seed.records?.find(
      (item) => item.definition?.key === expected.measurementKey,
    )?.definition;
    if (
      !record ||
      record.version !== 3 ||
      record.status !== 'draft' ||
      !isRecord(record.governance) ||
      record.governance.reviewStatus !== 'unreviewed' ||
      record.governance.reviewerId !== null ||
      record.governance.reviewedAt !== null ||
      stableMeasurementHash(record) !== expected.seedDefinitionHash
    ) {
      findings.push(
        `Current seed candidate ${expected.measurementKey}@3 is not the exact unapproved draft baseline.`,
      );
    }
    const candidate = candidates.find(
      (item) => isRecord(item) && item.measurementKey === expected.measurementKey,
    );
    if (
      !isRecord(candidate) ||
      candidate.lifecycleStatus !== 'draft' ||
      candidate.reviewStatus !== 'unreviewed' ||
      candidate.approvalState !== 'unapproved' ||
      candidate.bindable !== false ||
      candidate.bindingState !== 'not-bound-candidate-only'
    ) {
      findings.push(`${expected.measurementKey}@3 is not explicitly unapproved and non-bindable.`);
    }
  }
}

export function validateDiabetesReviewPacket(packet: JsonObject): readonly string[] {
  const findings = [...collectForbiddenMaterial(packet)];
  if (
    stableDiabetesReviewJson(packet) !== stableDiabetesReviewJson(expectedDiabetesReviewPacket())
  ) {
    findings.push(
      'Packet differs from the exact locked non-executable review-preparation template.',
    );
  }
  validateCanonicalRegister(findings);
  validatePreflightFiles(packet, findings);
  validateMeasurementSeed(packet, findings);
  return [...new Set(findings)];
}

export function validateDiabetesReviewArguments(args: readonly string[]): void {
  if (args.length === 0 || (args.length === 1 && args[0] === '--check')) return;
  throw new Error('Usage: tsx scripts/verify-diabetes-review-preparation.ts [--check]');
}

function main(): void {
  validateDiabetesReviewArguments(process.argv.slice(2));
  const packet = readDiabetesReviewPacket();
  const findings = validateDiabetesReviewPacket(packet);
  console.log(
    JSON.stringify(
      {
        status: findings.length === 0 ? 'ok' : 'blocked',
        mode: 'read-only-non-executable-review-preparation-check',
        calculatorSlug: 'diabetes-risk',
        externalBlockersOpen: DIABETES_EXTERNAL_BLOCKERS.length,
        measurementCandidates: EXPECTED_MEASUREMENT_CANDIDATES.length,
        bindableCandidates: 0,
        executableClinicalValues: 0,
        approvals: 0,
        findings,
      },
      null,
      2,
    ),
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
