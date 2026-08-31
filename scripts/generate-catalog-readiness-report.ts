import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

interface ResearchSource {
  readonly org?: string;
  readonly title?: string;
  readonly url?: string;
  readonly verification?: string;
}

interface ResearchCalculator {
  readonly key: string;
  readonly name: string;
  readonly tier: number;
  readonly category: string;
  readonly inputs?: readonly unknown[];
  readonly sources?: readonly ResearchSource[];
  readonly platformMapping?: string;
  readonly cautions?: string;
}

interface ResearchMeasurement {
  readonly key: string;
  readonly name: string;
  readonly panel: string;
  readonly unit?: string;
  readonly referenceRanges?: unknown;
  readonly conversions?: readonly JsonObject[];
  readonly sources?: readonly ResearchSource[];
  readonly libraryMerge?: unknown;
  readonly notes?: string;
  readonly derivedFormula?: string;
}

interface ResearchCalculatorCatalog {
  readonly $schema: string;
  readonly counts: { readonly calculators: number };
  readonly calculators: readonly ResearchCalculator[];
  readonly openIssues: readonly string[];
}

interface ResearchMeasurementCatalog {
  readonly $schema: string;
  readonly counts: {
    readonly measurements: number;
    readonly genuinelyNew: number;
    readonly libraryEnrichments: number;
  };
  readonly measurements: readonly ResearchMeasurement[];
}

export interface CatalogBlocker {
  readonly id: string;
  readonly detail: string;
}

export interface CatalogRecordReadiness {
  readonly key: string;
  readonly name: string;
  readonly disposition: 'quarantined';
  readonly sourceSummary: {
    readonly total: number;
    readonly fetchVerified: number;
    readonly requiresReverification: number;
    readonly verificationLabels: readonly string[];
  };
  readonly blockers: readonly CatalogBlocker[];
  readonly nextAllowedAction: string;
}

export interface CalculatorCatalogReadiness extends CatalogRecordReadiness {
  readonly tier: number;
  readonly category: string;
}

export interface MeasurementCatalogReadiness extends CatalogRecordReadiness {
  readonly panel: string;
  readonly catalogRole: 'new-candidate' | 'library-enrichment';
  readonly conversionCount: number;
}

export interface CatalogReadinessReport {
  readonly schemaVersion: 'catalog-publication-readiness-report.v1';
  readonly evaluatedAgainst: readonly string[];
  readonly decision: string;
  readonly inputHashes: {
    readonly calculatorCatalogSha256: string;
    readonly measurementCatalogSha256: string;
  };
  readonly summary: {
    readonly calculatorResearchRecords: number;
    readonly calculatorPublicationEligible: 0;
    readonly calculatorQuarantined: number;
    readonly measurementResearchRecords: number;
    readonly measurementPublicationEligible: 0;
    readonly measurementQuarantined: number;
    readonly genuinelyNewMeasurementCandidates: number;
    readonly libraryEnrichments: number;
    readonly knownReversedConversionRecords: number;
    readonly calculatorSourceObjects: number;
    readonly measurementSourceObjects: number;
  };
  readonly calculators: readonly CalculatorCatalogReadiness[];
  readonly measurements: readonly MeasurementCatalogReadiness[];
  readonly preservedBoundaries: {
    readonly databaseWrites: false;
    readonly lifecycleTransitions: false;
    readonly clinicalApprovalsCreated: false;
    readonly historicalResearchModified: false;
    readonly note: string;
  };
}

export const CATALOG_READINESS_ROOT = resolve(__dirname, '..');
export const CALCULATOR_CATALOG_PATH = join(
  CATALOG_READINESS_ROOT,
  'data',
  'catalog',
  'health-calculator-catalog.json',
);
export const MEASUREMENT_CATALOG_PATH = join(
  CATALOG_READINESS_ROOT,
  'data',
  'catalog',
  'measurements-reference-extension.json',
);
export const CATALOG_READINESS_JSON_PATH = join(
  CATALOG_READINESS_ROOT,
  'data',
  'catalog',
  'Catalog-Publication-Readiness.v1.json',
);
export const CATALOG_READINESS_MARKDOWN_PATH = join(
  CATALOG_READINESS_ROOT,
  'data',
  'catalog',
  'Catalog-Publication-Readiness.v1.md',
);

const KNOWN_REVERSED_CONVERSION_DETAILS: Readonly<Record<string, string>> = {
  hematocrit:
    'Legacy L/L-to-percent factor 0.01 is reversed under canonical = entered × factor + offset; the locked contract records ×100 as the required direction.',
  mchc: 'Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.',
  'basophils-absolute':
    'Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.',
  'eosinophils-absolute':
    'Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.',
  'lymphocytes-absolute':
    'Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.',
  'monocytes-absolute':
    'Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.',
  'neutrophils-absolute':
    'Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.',
  'serum-iron':
    'Legacy µmol/L-to-µg/dL factor about 0.179 is reciprocal to the declared direction; the locked contract records about ×5.587.',
  tibc: 'Legacy µmol/L-to-µg/dL factor about 0.179 is reciprocal to the declared direction; the locked contract records about ×5.587.',
  'calcium-total':
    'Legacy mmol/L-to-mg/dL factor 0.2495 is reciprocal to the declared direction; the locked contract records about ×4.008.',
  phosphate:
    'Legacy mmol/L-to-mg/dL factor 0.3229 is reciprocal to the declared direction; the locked contract records about ×3.097.',
  'vldl-cholesterol':
    'Legacy mmol/L-to-mg/dL factor 0.02586 is reciprocal to the declared direction; the locked contract records about ×38.67.',
  alp: 'Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.',
  amylase:
    'Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.',
  lipase:
    'Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.',
  ldh: 'Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.',
  'bilirubin-direct':
    'Legacy µmol/L-to-mg/dL factor 17.104 is reciprocal to the declared direction; the locked contract records about ×0.0585.',
  'bilirubin-indirect':
    'Legacy µmol/L-to-mg/dL factor 17.104 is reciprocal to the declared direction; the locked contract records about ×0.0585.',
  'total-protein':
    'Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.',
  globulin:
    'Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.',
};

const ADDITIONAL_CONVERSION_DEFECTS: Readonly<Record<string, string>> = {
  'fasting-insulin':
    'The legacy conversion stores factor 0 as an unresolved sentinel, which is invalid and non-invertible.',
  'body-temperature':
    'Temperature requires an explicit affine factor and offset; the slope-only legacy record is directionally ambiguous.',
  height: 'The ft+in entry is a typed multi-component adapter, not a one-factor unit conversion.',
  weight: 'The st+lb entry is a typed multi-component adapter, not a one-factor unit conversion.',
  'pre-pregnancy-bmi':
    'Weight and height component conversions are attached to a derived BMI output and must be migrated to its input measurements.',
  'caffeine-daily-limit':
    'Serving caffeine coefficients and beverage amounts are not dimensional unit conversions and require a reviewed input model.',
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableCatalogReadinessJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function summarizeSources(sources: readonly ResearchSource[] | undefined) {
  const rows = sources ?? [];
  const labels = rows.map((source) => source.verification?.trim() || 'missing');
  const fetchVerified = labels.filter((label) => label === 'fetch-verified').length;
  return {
    total: rows.length,
    fetchVerified,
    requiresReverification: rows.length - fetchVerified,
    verificationLabels: uniqueSorted(labels),
  };
}

function sourceReverificationBlocker(
  sources: readonly ResearchSource[] | undefined,
  recordKind: 'calculator' | 'measurement',
): CatalogBlocker | undefined {
  const summary = summarizeSources(sources);
  if (summary.total > 0 && summary.requiresReverification === 0) return undefined;
  return {
    id: recordKind === 'calculator' ? 'CAT-CALC-SOURCE-REVERIFY' : 'CAT-MEAS-SOURCE-REVERIFY',
    detail:
      summary.total === 0
        ? 'No source object is present.'
        : `${summary.requiresReverification} of ${summary.total} source objects are not exactly fetch-verified (${summary.verificationLabels.join(', ')}).`,
  };
}

function hasExplicitMeasurementBinding(inputs: readonly unknown[] | undefined): boolean {
  return (inputs ?? []).some(
    (input) =>
      isRecord(input) &&
      (typeof input.biomarkerKey === 'string' || typeof input.measurementKey === 'string'),
  );
}

function engineReviewRequired(mapping: string | undefined): boolean {
  const normalized = (mapping ?? '')
    .toUpperCase()
    .replaceAll(/NO MISSING (?:ENGINE )?PRIMITIVES?/gu, '')
    .replaceAll('NO ENGINE PRIMITIVE IS MISSING', '');
  return /\bMISSING (?:ENGINE )?PRIMITIVE(?:S)?\b|\bREQUIRES (?:FOUR )?(?:NEW )?PRIMITIVES?\b|\bUNIMPLEMENTABLE TODAY\b|\bENGINE V1\.1\b/u.test(
    normalized,
  );
}

function licensingReviewRequired(calculator: ResearchCalculator): boolean {
  const text = `${calculator.name} ${calculator.platformMapping ?? ''} ${calculator.cautions ?? ''}`;
  return /\blicen[cs](?:e|ing|ed)|\bcopyright|\bcommercial permission|\bproprietary|\blink-out only/iu.test(
    text,
  );
}

function calculatorReadiness(calculator: ResearchCalculator): CalculatorCatalogReadiness {
  const blockers: CatalogBlocker[] = [
    {
      id: 'CAT-CALC-LEGACY-SHAPE',
      detail:
        'This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.',
    },
    {
      id: 'CAT-CALC-MEASUREMENT-MAPPING',
      detail: hasExplicitMeasurementBinding(calculator.inputs)
        ? 'Input mappings are research-only and do not bind approved immutable measurement revisions or snapshots.'
        : 'No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.',
    },
    {
      id: 'CAT-CALC-COMPLETE-GOLDEN',
      detail:
        'No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.',
    },
    {
      id: 'CAT-CALC-CONTENT-GOVERNANCE',
      detail:
        'Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.',
    },
    {
      id: 'CAT-CALC-INDEPENDENT-REVIEW',
      detail:
        'No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.',
    },
  ];
  const sourceBlocker = sourceReverificationBlocker(calculator.sources, 'calculator');
  if (sourceBlocker) blockers.push(sourceBlocker);
  if (engineReviewRequired(calculator.platformMapping)) {
    blockers.push({
      id: 'CAT-CALC-ENGINE-CAPABILITY',
      detail:
        'The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.',
    });
  }
  if (licensingReviewRequired(calculator)) {
    blockers.push({
      id: 'CAT-CALC-LICENSING',
      detail:
        'The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.',
    });
  }
  return {
    key: calculator.key,
    name: calculator.name,
    tier: calculator.tier,
    category: calculator.category,
    disposition: 'quarantined',
    sourceSummary: summarizeSources(calculator.sources),
    blockers,
    nextAllowedAction:
      'Reverify and disposition every blocker, then manually author a new Studio draft; do not import this legacy row.',
  };
}

function conversionShapeIsLegacy(conversions: readonly JsonObject[] | undefined): boolean {
  return (conversions ?? []).some(
    (conversion) =>
      typeof conversion.fromUnit !== 'string' ||
      typeof conversion.toUnit !== 'string' ||
      typeof conversion.offset !== 'number',
  );
}

function measurementReadiness(measurement: ResearchMeasurement): MeasurementCatalogReadiness {
  const blockers: CatalogBlocker[] = [
    {
      id: 'CAT-MEAS-LEGACY-SHAPE',
      detail:
        'This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.',
    },
    {
      id: 'CAT-MEAS-RANGE-STRUCTURE',
      detail:
        typeof measurement.referenceRanges === 'string'
          ? 'Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.'
          : 'Reference ranges have not been proven to satisfy the canonical structured/contextual contract.',
    },
    {
      id: 'CAT-MEAS-CLAIM-LINKS',
      detail:
        'Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.',
    },
    {
      id: 'CAT-MEAS-REVIEW-EVIDENCE',
      detail:
        'No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.',
    },
  ];
  const sourceBlocker = sourceReverificationBlocker(measurement.sources, 'measurement');
  if (sourceBlocker) blockers.push(sourceBlocker);
  if (conversionShapeIsLegacy(measurement.conversions)) {
    blockers.push({
      id: 'CAT-MEAS-CONVERSION-SHAPE',
      detail:
        'At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.',
    });
  }
  const reversedDetail = KNOWN_REVERSED_CONVERSION_DETAILS[measurement.key];
  if (reversedDetail) {
    blockers.push({ id: 'CAT-MEAS-CONVERSION-REVERSED', detail: reversedDetail });
  }
  const additionalDefect = ADDITIONAL_CONVERSION_DEFECTS[measurement.key];
  if (additionalDefect) {
    blockers.push({ id: 'CAT-MEAS-CONVERSION-SPECIAL', detail: additionalDefect });
  }
  if (measurement.libraryMerge) {
    blockers.push({
      id: 'CAT-MEAS-LIBRARY-MERGE',
      detail:
        'This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.',
    });
  }
  return {
    key: measurement.key,
    name: measurement.name,
    panel: measurement.panel,
    catalogRole: measurement.libraryMerge ? 'library-enrichment' : 'new-candidate',
    conversionCount: measurement.conversions?.length ?? 0,
    disposition: 'quarantined',
    sourceSummary: summarizeSources(measurement.sources),
    blockers,
    nextAllowedAction:
      'Migrate into a new canonical draft revision only after conversion, range, claim, source, licensing, mapping, and independent measurement-review gates pass.',
  };
}

function parseCalculatorCatalog(text: string): ResearchCalculatorCatalog {
  const parsed = JSON.parse(text) as ResearchCalculatorCatalog;
  if (
    parsed.$schema !== 'niro-platform/health-calculator-catalog.v1' ||
    !Array.isArray(parsed.calculators) ||
    parsed.calculators.length !== parsed.counts?.calculators
  ) {
    throw new Error('Calculator research catalog shape/count is invalid.');
  }
  if (new Set(parsed.calculators.map((entry) => entry.key)).size !== parsed.calculators.length) {
    throw new Error('Calculator research catalog contains duplicate keys.');
  }
  return parsed;
}

function parseMeasurementCatalog(text: string): ResearchMeasurementCatalog {
  const parsed = JSON.parse(text) as ResearchMeasurementCatalog;
  if (
    parsed.$schema !== 'niro-platform/measurements-reference-extension.v1' ||
    !Array.isArray(parsed.measurements) ||
    parsed.measurements.length !== parsed.counts?.measurements
  ) {
    throw new Error('Measurement research catalog shape/count is invalid.');
  }
  if (new Set(parsed.measurements.map((entry) => entry.key)).size !== parsed.measurements.length) {
    throw new Error('Measurement research catalog contains duplicate keys.');
  }
  return parsed;
}

export function buildCatalogReadinessReport(
  calculatorText = readFileSync(CALCULATOR_CATALOG_PATH, 'utf8'),
  measurementText = readFileSync(MEASUREMENT_CATALOG_PATH, 'utf8'),
): CatalogReadinessReport {
  const calculatorCatalog = parseCalculatorCatalog(calculatorText);
  const measurementCatalog = parseMeasurementCatalog(measurementText);
  const calculators = calculatorCatalog.calculators
    .map(calculatorReadiness)
    .sort((left, right) => left.key.localeCompare(right.key));
  const measurements = measurementCatalog.measurements
    .map(measurementReadiness)
    .sort((left, right) => left.key.localeCompare(right.key));
  if (
    calculators.some((record) => record.blockers.length === 0) ||
    measurements.some((record) => record.blockers.length === 0)
  ) {
    throw new Error('Unsafe catalog result: a legacy research record has no quarantine blocker.');
  }
  return {
    schemaVersion: 'catalog-publication-readiness-report.v1',
    evaluatedAgainst: [
      'Implementation-Plan.md#22.4',
      'packages/contracts/specs/biomarker-measurement-units.v1.md#10-11',
      'packages/contracts/specs/p8-evidence-handoff.v1.md',
    ],
    decision:
      'No legacy research calculator or measurement is publication eligible. Every row remains individually quarantined until its listed evidence, migration, testing, licensing, mapping, and independent-review gates pass.',
    inputHashes: {
      calculatorCatalogSha256: sha256(calculatorText),
      measurementCatalogSha256: sha256(measurementText),
    },
    summary: {
      calculatorResearchRecords: calculators.length,
      calculatorPublicationEligible: 0,
      calculatorQuarantined: calculators.length,
      measurementResearchRecords: measurements.length,
      measurementPublicationEligible: 0,
      measurementQuarantined: measurements.length,
      genuinelyNewMeasurementCandidates: measurementCatalog.counts.genuinelyNew,
      libraryEnrichments: measurementCatalog.counts.libraryEnrichments,
      knownReversedConversionRecords: Object.keys(KNOWN_REVERSED_CONVERSION_DETAILS).length,
      calculatorSourceObjects: calculatorCatalog.calculators.reduce(
        (total, calculator) => total + (calculator.sources?.length ?? 0),
        0,
      ),
      measurementSourceObjects: measurementCatalog.measurements.reduce(
        (total, measurement) => total + (measurement.sources?.length ?? 0),
        0,
      ),
    },
    calculators,
    measurements,
    preservedBoundaries: {
      databaseWrites: false,
      lifecycleTransitions: false,
      clinicalApprovalsCreated: false,
      historicalResearchModified: false,
      note: 'This deterministic report reads and hashes the two research catalogs. It never imports, edits, approves, verifies, publishes, retires, or deletes a record.',
    },
  };
}

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function blockerIds(record: CatalogRecordReadiness): string {
  return record.blockers.map((blocker) => `\`${blocker.id}\``).join(', ');
}

export function renderCatalogReadinessMarkdown(report: CatalogReadinessReport): string {
  const lines = [
    '# Catalog publication-readiness report v1',
    '',
    `Calculator catalog SHA-256: \`${report.inputHashes.calculatorCatalogSha256}\`  `,
    `Measurement catalog SHA-256: \`${report.inputHashes.measurementCatalogSha256}\``,
    '',
    '> This is a deterministic quarantine/readiness report. It is not clinical approval and performs no import or lifecycle transition.',
    '',
    '## Summary',
    '',
    `- Calculator research records: ${report.summary.calculatorResearchRecords}`,
    `- Calculator publication eligible: ${report.summary.calculatorPublicationEligible}`,
    `- Calculator quarantined: ${report.summary.calculatorQuarantined}`,
    `- Measurement research records: ${report.summary.measurementResearchRecords}`,
    `- Measurement publication eligible: ${report.summary.measurementPublicationEligible}`,
    `- Measurement quarantined: ${report.summary.measurementQuarantined}`,
    `- New measurement candidates / library enrichments: ${report.summary.genuinelyNewMeasurementCandidates} / ${report.summary.libraryEnrichments}`,
    `- Known reversed conversion records: ${report.summary.knownReversedConversionRecords}`,
    '',
    '## Calculator-by-calculator disposition',
    '',
    '| Key | Tier | Category | Source status | Disposition | Blockers |',
    '|---|---:|---|---|---|---|',
    ...report.calculators.map(
      (record) =>
        `| \`${record.key}\` | ${record.tier} | ${escapeTable(record.category)} | ${record.sourceSummary.fetchVerified}/${record.sourceSummary.total} fetch-verified | ${record.disposition} | ${blockerIds(record)} |`,
    ),
    '',
    '## Measurement-by-measurement disposition',
    '',
    '| Key | Role | Panel | Sources | Conversions | Disposition | Blockers |',
    '|---|---|---|---:|---:|---|---|',
    ...report.measurements.map(
      (record) =>
        `| \`${record.key}\` | ${record.catalogRole} | ${escapeTable(record.panel)} | ${record.sourceSummary.fetchVerified}/${record.sourceSummary.total} fetch-verified | ${record.conversionCount} | ${record.disposition} | ${blockerIds(record)} |`,
    ),
    '',
    '## Exact blocker details',
    '',
    ...report.calculators.flatMap((record) => [
      `### Calculator: ${record.key}`,
      '',
      ...record.blockers.map((blocker) => `- \`${blocker.id}\`: ${escapeTable(blocker.detail)}`),
      '',
    ]),
    ...report.measurements.flatMap((record) => [
      `### Measurement: ${record.key}`,
      '',
      ...record.blockers.map((blocker) => `- \`${blocker.id}\`: ${escapeTable(blocker.detail)}`),
      '',
    ]),
    '## Safe next action',
    '',
    'Select one record only after its source, licensing, conversion, mapping, applicability, and open-issue blockers are closed. Manually author it in Calculator Studio, bind approved immutable measurement revisions, add complete reviewer-approved source examples and boundary/missing/context tests, run all four validation layers, and obtain independent protected-hash medical approval before publication.',
    '',
    'No historical source row was modified, and no database write was performed by this report.',
    '',
  ];
  return lines.join('\n');
}

export function generatedCatalogReadinessArtifacts(): {
  readonly json: string;
  readonly markdown: string;
} {
  const report = buildCatalogReadinessReport();
  return {
    json: stableCatalogReadinessJson(report),
    markdown: renderCatalogReadinessMarkdown(report),
  };
}

export function checkCatalogReadinessArtifacts(
  jsonPath = CATALOG_READINESS_JSON_PATH,
  markdownPath = CATALOG_READINESS_MARKDOWN_PATH,
): readonly string[] {
  const generated = generatedCatalogReadinessArtifacts();
  const findings: string[] = [];
  if (readFileSync(jsonPath, 'utf8') !== generated.json) findings.push('JSON report is stale.');
  if (readFileSync(markdownPath, 'utf8') !== generated.markdown) {
    findings.push('Markdown report is stale.');
  }
  return findings;
}

export function validateCatalogReadinessArguments(args: readonly string[]): 'write' | 'check' {
  const unsupported = args.filter((argument) => argument !== '--write' && argument !== '--check');
  if (unsupported.length > 0) {
    throw new Error(`Unsupported catalog-readiness argument: ${unsupported[0]}.`);
  }
  if (args.includes('--write') && args.includes('--check')) {
    throw new Error('--write and --check are mutually exclusive.');
  }
  return args.includes('--write') ? 'write' : 'check';
}

function main(): void {
  const mode = validateCatalogReadinessArguments(process.argv.slice(2));
  const generated = generatedCatalogReadinessArtifacts();
  if (mode === 'write') {
    writeFileSync(CATALOG_READINESS_JSON_PATH, generated.json, 'utf8');
    writeFileSync(CATALOG_READINESS_MARKDOWN_PATH, generated.markdown, 'utf8');
    const summary = buildCatalogReadinessReport().summary;
    console.log(
      JSON.stringify(
        {
          status: 'written',
          calculators: summary.calculatorResearchRecords,
          measurements: summary.measurementResearchRecords,
          publicationEligible: 0,
        },
        null,
        2,
      ),
    );
    return;
  }
  const findings = checkCatalogReadinessArtifacts();
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
