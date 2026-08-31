import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { validateCalculatorVersion } from '@niro/contracts';

import {
  readReconciliationPlan,
  reconcileNiroDrafts,
  sha256File,
  stableP8Json,
  type NiroReconciliationPlan,
} from './reconcile-niro-drafts';

type JsonObject = Record<string, unknown>;

export type EvidenceRequestKind =
  | 'source-owner-disposition'
  | 'measurement-review'
  | 'complete-source-worked-example'
  | 'content-governance'
  | 'independent-medical-review';

export interface EvidenceRequest {
  readonly kind: EvidenceRequestKind;
  readonly status: 'awaiting-external-evidence' | 'blocked-by-prerequisite';
  readonly ownerRole: string;
  readonly requiredEvidence: readonly string[];
}

export interface EngineeringDisposition {
  readonly discrepancyId: string;
  readonly disposition: string;
}

export interface CalculatorEvidenceRequest {
  readonly calculatorSlug: string;
  readonly applicationState: 'draft';
  readonly releaseState: 'publication-blocked' | 'source-rejected-publication-blocked';
  readonly sourceLocator: string;
  readonly externalClinicalBlockerIds: readonly string[];
  readonly lockedEngineeringDispositions: readonly EngineeringDisposition[];
  readonly requests: readonly EvidenceRequest[];
}

export interface NiroEvidenceRequests {
  readonly schemaVersion: 'niro-evidence-requests.v1';
  readonly evaluatedAgainstContractsAt: string;
  readonly purpose: string;
  readonly policy: {
    readonly autoApply: false;
    readonly autoApprove: false;
    readonly clinicalValuesPresent: false;
    readonly acceptedEvidenceMustBeAppliedThroughStudio: true;
    readonly note: string;
  };
  readonly calculators: readonly CalculatorEvidenceRequest[];
}

export const P8_READINESS_ROOT = resolve(__dirname, '..');
export const EVIDENCE_REQUESTS_PATH = join(
  P8_READINESS_ROOT,
  'data',
  'reconciliation',
  'niro-evidence-requests.v1.json',
);
export const READINESS_JSON_REPORT_PATH = join(
  P8_READINESS_ROOT,
  'packages',
  'contracts',
  'reports',
  'niro-publication-readiness.v1.json',
);
export const READINESS_MARKDOWN_REPORT_PATH = join(
  P8_READINESS_ROOT,
  'packages',
  'contracts',
  'reports',
  'niro-publication-readiness.v1.md',
);
const HEART_PARTIAL_GOLDEN_PATH = join(
  P8_READINESS_ROOT,
  'data',
  'goldens',
  'heart-base-stage.v1.json',
);

const EXPECTED_SLUGS = ['diabetes-risk', 'heart-risk', 'hypothyroid-risk', 'niro-cws'] as const;
const EXPECTED_REQUEST_KINDS: readonly EvidenceRequestKind[] = [
  'source-owner-disposition',
  'measurement-review',
  'complete-source-worked-example',
  'content-governance',
  'independent-medical-review',
];
const EXPECTED_EXTERNAL_BLOCKERS: Readonly<
  Record<(typeof EXPECTED_SLUGS)[number], readonly string[]>
> = {
  'diabetes-risk': [
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
  ],
  'heart-risk': [
    'HRT-01',
    'HRT-02',
    'HRT-03',
    'HRT-04',
    'HRT-05',
    'HRT-06',
    'HRT-07',
    'HRT-08',
    'HRT-09',
    'HRT-10',
    'HRT-11',
    'HRT-12',
    'HRT-13',
    'HRT-14',
    'HRT-16',
    'HRT-17',
    'HRT-18',
    'HRT-20',
  ],
  'hypothyroid-risk': ['HYP-01', 'HYP-02', 'HYP-03', 'HYP-04', 'HYP-05', 'HYP-06', 'HYP-07'],
  'niro-cws': [
    'N1',
    'CWS-01',
    'CWS-03',
    'CWS-04',
    'CWS-05',
    'CWS-06',
    'CWS-07',
    'CWS-08',
    'CWS-09',
    'CWS-10',
    'CWS-11',
    'CWS-12',
    'CWS-13',
    'CWS-14',
    'CWS-15',
    'CWS-16',
    'CWS-18',
    'CWS-19',
    'CWS-20',
  ],
};
const EXPECTED_ENGINEERING_DISPOSITIONS: Readonly<
  Record<(typeof EXPECTED_SLUGS)[number], readonly string[]>
> = {
  'diabetes-risk': ['DIA-05', 'DIA-08'],
  'heart-risk': ['HRT-15', 'HRT-19', 'HRT-20'],
  'hypothyroid-risk': [],
  'niro-cws': ['CWS-02', 'CWS-17'],
};
const FORBIDDEN_WORKFLOW_KEYS = new Set([
  'parameters',
  'scoringRules',
  'formulas',
  'lookupTables',
  'floorRules',
  'domains',
  'adjustmentRules',
  'resultCategories',
  'testCases',
  'inputs',
  'expected',
  'reviewerId',
  'reviewedAt',
  'protectedHash',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableReadinessJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function unsafeWorkflowKeys(value: unknown, path = '$'): readonly string[] {
  if (Array.isArray(value))
    return value.flatMap((entry, index) => unsafeWorkflowKeys(entry, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as JsonObject).flatMap(([key, entry]) => [
    ...(FORBIDDEN_WORKFLOW_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...unsafeWorkflowKeys(entry, `${path}.${key}`),
  ]);
}

export function readEvidenceRequests(path = EVIDENCE_REQUESTS_PATH): NiroEvidenceRequests {
  return JSON.parse(readFileSync(path, 'utf8')) as NiroEvidenceRequests;
}

export function validateEvidenceRequests(
  source: NiroEvidenceRequests,
  plan: NiroReconciliationPlan = readReconciliationPlan(),
): readonly string[] {
  const findings: string[] = [];
  if (source.schemaVersion !== 'niro-evidence-requests.v1') {
    findings.push('schemaVersion must be niro-evidence-requests.v1.');
  }
  if (Number.isNaN(Date.parse(source.evaluatedAgainstContractsAt))) {
    findings.push('evaluatedAgainstContractsAt must be a valid date-time.');
  }
  if (
    source.policy.autoApply !== false ||
    source.policy.autoApprove !== false ||
    source.policy.clinicalValuesPresent !== false ||
    source.policy.acceptedEvidenceMustBeAppliedThroughStudio !== true
  ) {
    findings.push('Evidence policy must remain nonclinical, non-automatic, and Studio-mediated.');
  }
  const unsafeKeys = unsafeWorkflowKeys(source);
  if (unsafeKeys.length > 0) {
    findings.push(
      `Evidence request source contains prohibited executable/evidence keys: ${unsafeKeys.join(', ')}.`,
    );
  }
  const slugs = source.calculators.map((calculator) => calculator.calculatorSlug);
  if (stableP8Json(slugs) !== stableP8Json(EXPECTED_SLUGS)) {
    findings.push(
      'Evidence requests must contain the four exact Niro calculators in locked order.',
    );
  }
  const overlayBySlug = new Map(plan.overlays.map((entry) => [entry.calculatorSlug, entry]));
  for (const [index, calculator] of source.calculators.entries()) {
    const path = `calculators[${index}]`;
    const slug = calculator.calculatorSlug as (typeof EXPECTED_SLUGS)[number];
    if (!EXPECTED_SLUGS.includes(slug)) {
      findings.push(`${path}.calculatorSlug is outside the four-calculator P8 boundary.`);
      continue;
    }
    if (calculator.applicationState !== 'draft') findings.push(`${path} must remain draft.`);
    const expectedReleaseState =
      slug === 'niro-cws' ? 'source-rejected-publication-blocked' : 'publication-blocked';
    if (calculator.releaseState !== expectedReleaseState) {
      findings.push(`${path}.releaseState must remain ${expectedReleaseState}.`);
    }
    const overlay = overlayBySlug.get(slug);
    const overlaySource = overlay?.metadataOverlay.sources[0]?.ref;
    if (!overlay || overlaySource !== calculator.sourceLocator) {
      findings.push(`${path}.sourceLocator differs from the preflighted reconciliation source.`);
    }
    if (
      stableP8Json(calculator.externalClinicalBlockerIds) !==
      stableP8Json(EXPECTED_EXTERNAL_BLOCKERS[slug])
    ) {
      findings.push(
        `${path}.externalClinicalBlockerIds differs from the current P8 blocker register.`,
      );
    }
    const engineeringIds = calculator.lockedEngineeringDispositions.map(
      (entry) => entry.discrepancyId,
    );
    if (stableP8Json(engineeringIds) !== stableP8Json(EXPECTED_ENGINEERING_DISPOSITIONS[slug])) {
      findings.push(
        `${path}.lockedEngineeringDispositions differs from the locked P0A resolutions.`,
      );
    }
    const knownOverlayIds = new Set(overlay?.metadataOverlay.governance.discrepancyIds ?? []);
    for (const discrepancyId of [...calculator.externalClinicalBlockerIds, ...engineeringIds]) {
      if (!knownOverlayIds.has(discrepancyId)) {
        findings.push(`${path} references discrepancy ${discrepancyId} outside its overlay.`);
      }
    }
    const requestKinds = calculator.requests.map((request) => request.kind);
    if (stableP8Json(requestKinds) !== stableP8Json(EXPECTED_REQUEST_KINDS)) {
      findings.push(
        `${path}.requests must contain every exact P8 evidence workflow in locked order.`,
      );
    }
    for (const [requestIndex, request] of calculator.requests.entries()) {
      const requestPath = `${path}.requests[${requestIndex}]`;
      const expectedStatus =
        request.kind === 'independent-medical-review'
          ? 'blocked-by-prerequisite'
          : 'awaiting-external-evidence';
      if (request.status !== expectedStatus) {
        findings.push(`${requestPath}.status cannot imply unreceived evidence or approval.`);
      }
      if (!request.ownerRole || request.requiredEvidence.length === 0) {
        findings.push(`${requestPath} needs an external owner role and required evidence.`);
      }
      if (request.requiredEvidence.some((item) => item.trim().length === 0)) {
        findings.push(`${requestPath}.requiredEvidence contains an empty item.`);
      }
    }
  }
  const serialized = stableP8Json(source).replaceAll('\\', '/').toLowerCase();
  if (serialized.includes('covid')) findings.push('Evidence requests must exclude COVID.');
  if (serialized.includes('/catalog/'))
    findings.push('Evidence requests cross the catalog quarantine.');
  return findings;
}

function reportLayer(layer: {
  readonly passed: boolean;
  readonly findings: readonly { readonly id: string; readonly severity: string }[];
}) {
  return {
    passed: layer.passed,
    errorCount: layer.findings.filter((finding) => finding.severity === 'error').length,
    warningCount: layer.findings.filter((finding) => finding.severity === 'warning').length,
    findingIds: sorted([...new Set(layer.findings.map((finding) => finding.id))]),
  };
}

export function buildReadinessReport(
  source = readEvidenceRequests(),
  plan = readReconciliationPlan(),
): JsonObject {
  const sourceFindings = validateEvidenceRequests(source, plan);
  if (sourceFindings.length > 0) {
    throw new Error(`Invalid P8 evidence-request register: ${sourceFindings.join(' ')}`);
  }
  const drafts = reconcileNiroDrafts(P8_READINESS_ROOT, plan);
  const draftBySlug = new Map(drafts.map((draft) => [draft.calculatorSlug, draft]));
  const evaluatedAt = new Date(source.evaluatedAgainstContractsAt);
  const calculators = source.calculators.map((entry) => {
    const draft = draftBySlug.get(entry.calculatorSlug);
    if (!draft) throw new Error(`Reconciliation did not produce ${entry.calculatorSlug}.`);
    const validation = validateCalculatorVersion(
      draft.payload as never,
      draft.fixturePath,
      evaluatedAt,
    );
    if (validation.publishEligible) {
      throw new Error(
        `Unsafe readiness result: ${entry.calculatorSlug} became publication eligible.`,
      );
    }
    return {
      calculatorSlug: entry.calculatorSlug,
      applicationState: entry.applicationState,
      releaseState: entry.releaseState,
      sourceLocator: entry.sourceLocator,
      fixturePath: draft.fixturePath,
      fixtureSha256: draft.fixtureSha256,
      reconciledPayloadSha256: draft.payloadSha256,
      publishEligible: false,
      validation: {
        structural: reportLayer(validation.structural),
        semantic: reportLayer(validation.semantic),
        clinical: reportLayer(validation.clinical),
        publish: reportLayer(validation.publish),
      },
      externalClinicalBlockerIds: entry.externalClinicalBlockerIds,
      lockedEngineeringDispositions: entry.lockedEngineeringDispositions,
      evidenceRequests: entry.requests,
      nextAllowedAction:
        'Collect authoritative evidence into a reviewed handoff packet; do not edit clinical values or advance lifecycle state automatically.',
    };
  });
  const heartGolden = JSON.parse(readFileSync(HEART_PARTIAL_GOLDEN_PATH, 'utf8')) as JsonObject;
  const heartPublishGate = heartGolden.publishGate as JsonObject;
  if (
    heartGolden.schemaVersion !== 'niro-partial-stage-golden.v1' ||
    heartPublishGate.satisfiesPUB007 !== false
  ) {
    throw new Error(
      'Heart base-stage evidence must remain explicitly partial and PUB-007-ineligible.',
    );
  }
  const requestCount = source.calculators.reduce(
    (count, calculator) => count + calculator.requests.length,
    0,
  );
  const externalBlockerCount = source.calculators.reduce(
    (count, calculator) => count + calculator.externalClinicalBlockerIds.length,
    0,
  );
  return {
    schemaVersion: 'niro-publication-readiness-report.v1',
    evaluatedAgainstContractsAt: source.evaluatedAgainstContractsAt,
    evidenceRequestSourceCanonicalSha256: sha256(stableReadinessJson(source)),
    reconciliationSourceCanonicalSha256: sha256(stableReadinessJson(plan)),
    decision:
      'All four Niro calculators remain drafts and publication-blocked. This report requests external evidence and never authorizes a clinical-value edit, review approval, or lifecycle transition.',
    summary: {
      calculatorCount: calculators.length,
      publicationEligibleCount: 0,
      publicationBlockedCount: calculators.length,
      externalClinicalBlockerCount: externalBlockerCount,
      evidenceRequestCount: requestCount,
      acceptedEvidenceCount: 0,
    },
    calculators,
    partialGoldenEvidence: {
      path: 'data/goldens/heart-base-stage.v1.json',
      sha256: sha256File(HEART_PARTIAL_GOLDEN_PATH),
      stage: heartGolden.stage,
      satisfiesPUB007: false,
      limitation:
        'The source omits later-stage inputs and a final expected score/category. It cannot satisfy the complete source-worked-example publication gate.',
    },
    preservedBoundaries: {
      covid: 'Excluded internal nonclinical fixture.',
      catalog: 'The quarantined 62-calculator/79-measurement research catalog is not an input.',
      liveImport: 'This report performs no file, database, review, or lifecycle write.',
    },
  };
}

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderReadinessMarkdown(report: JsonObject): string {
  const calculators = report.calculators as readonly (CalculatorEvidenceRequest & {
    readonly publishEligible: false;
    readonly fixtureSha256: string;
    readonly reconciledPayloadSha256: string;
    readonly validation: Readonly<Record<string, { readonly errorCount: number }>>;
    readonly evidenceRequests: readonly EvidenceRequest[];
  })[];
  const summary = report.summary as Readonly<Record<string, number>>;
  const lines = [
    '# Niro publication-readiness report v1',
    '',
    `Evidence-request hash: \`${String(report.evidenceRequestSourceCanonicalSha256)}\`  `,
    `Reconciliation hash: \`${String(report.reconciliationSourceCanonicalSha256)}\`  `,
    `Contract evaluation time: \`${String(report.evaluatedAgainstContractsAt)}\``,
    '',
    '> All four Niro calculators remain drafts and publication-blocked. This is an evidence handoff report, not a clinical decision or publish approval.',
    '',
    '## Summary',
    '',
    `- Calculators: ${summary.calculatorCount ?? 0}`,
    `- Publication eligible: ${summary.publicationEligibleCount ?? 0}`,
    `- Publication blocked: ${summary.publicationBlockedCount ?? 0}`,
    `- External calculator-specific blocker IDs: ${summary.externalClinicalBlockerCount ?? 0}`,
    `- Open evidence requests: ${summary.evidenceRequestCount ?? 0}`,
    `- Accepted evidence recorded here: ${summary.acceptedEvidenceCount ?? 0}`,
    '',
    '## Calculator readiness',
    '',
    '| Calculator | State | Structural | Semantic errors | Clinical errors | Publish errors | External blockers |',
    '|---|---|---:|---:|---:|---:|---|',
    ...calculators.map(
      (calculator) =>
        `| ${calculator.calculatorSlug} | ${calculator.releaseState} | ${calculator.validation.structural?.errorCount === 0 ? 'pass' : 'fail'} | ${calculator.validation.semantic?.errorCount ?? 0} | ${calculator.validation.clinical?.errorCount ?? 0} | ${calculator.validation.publish?.errorCount ?? 0} | ${calculator.externalClinicalBlockerIds.map((id) => `\`${id}\``).join(', ')} |`,
    ),
    '',
    '## External evidence workflow',
    '',
    ...calculators.flatMap((calculator) => [
      `### ${calculator.calculatorSlug}`,
      '',
      `Source: \`${escapeTable(calculator.sourceLocator)}\``,
      '',
      ...calculator.evidenceRequests.map(
        (request) =>
          `- **${request.kind}** — \`${request.status}\`; owner: \`${request.ownerRole}\`. Required: ${request.requiredEvidence.map(escapeTable).join(' ')}`,
      ),
      '',
      'Locked engineering dispositions (not clinical approval):',
      '',
      ...(calculator.lockedEngineeringDispositions.length === 0
        ? ['- None.']
        : calculator.lockedEngineeringDispositions.map(
            (disposition) =>
              `- \`${disposition.discrepancyId}\`: ${escapeTable(disposition.disposition)}`,
          )),
      '',
    ]),
    '## Worked-example gate',
    '',
    '- `data/goldens/heart-base-stage.v1.json` remains a partial stage check with `satisfiesPUB007:false`.',
    '- Every clinical calculator still needs a complete source-worked example with complete inputs, expected final score/category, precise current source locator, and boundary evidence.',
    '',
    '## Safe handoff rule',
    '',
    '1. Collect the requested evidence outside executable configuration.',
    '2. Verify provenance, authority, credentials, jurisdiction, and completeness.',
    '3. Apply an accepted decision only through a new Studio draft; never mutate a published version.',
    '4. Re-run structural, semantic, clinical, publish, saved-test, measurement, and protected-hash checks.',
    '5. A distinct qualified medical reviewer must approve the resulting protected snapshot before publication can be attempted.',
    '',
    'COVID and the quarantined catalog are excluded. Generating or checking this report performs no database write.',
    '',
  ];
  return lines.join('\n');
}

export function generatedReadinessArtifacts(source = readEvidenceRequests()): {
  readonly json: string;
  readonly markdown: string;
} {
  const report = buildReadinessReport(source);
  return { json: stableReadinessJson(report), markdown: renderReadinessMarkdown(report) };
}

export function checkReadinessArtifacts(
  source = readEvidenceRequests(),
  jsonPath = READINESS_JSON_REPORT_PATH,
  markdownPath = READINESS_MARKDOWN_REPORT_PATH,
): readonly string[] {
  const generated = generatedReadinessArtifacts(source);
  const findings: string[] = [];
  if (readFileSync(jsonPath, 'utf8') !== generated.json) findings.push('JSON report is stale.');
  if (readFileSync(markdownPath, 'utf8') !== generated.markdown) {
    findings.push('Markdown report is stale.');
  }
  return findings;
}

export function validateReadinessArguments(args: readonly string[]): 'write' | 'check' {
  const unsupported = args.filter((argument) => argument !== '--write' && argument !== '--check');
  if (unsupported.length > 0) throw new Error(`Unsupported readiness argument: ${unsupported[0]}.`);
  if (args.includes('--write') && args.includes('--check')) {
    throw new Error('--write and --check are mutually exclusive.');
  }
  return args.includes('--write') ? 'write' : 'check';
}

function main(): void {
  const mode = validateReadinessArguments(process.argv.slice(2));
  const generated = generatedReadinessArtifacts();
  if (mode === 'write') {
    writeFileSync(READINESS_JSON_REPORT_PATH, generated.json, 'utf8');
    writeFileSync(READINESS_MARKDOWN_REPORT_PATH, generated.markdown, 'utf8');
    console.log(
      JSON.stringify(
        { status: 'written', calculators: EXPECTED_SLUGS.length, publicationEligible: 0 },
        null,
        2,
      ),
    );
    return;
  }
  const findings = checkReadinessArtifacts();
  console.log(
    JSON.stringify({ status: findings.length === 0 ? 'ok' : 'stale', findings }, null, 2),
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
