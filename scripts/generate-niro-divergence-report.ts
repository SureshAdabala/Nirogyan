import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

export interface DivergenceAnchor {
  readonly organization: string;
  readonly title: string;
  readonly url?: string;
  readonly localRef?: string;
  readonly statement: string;
  readonly verification: 'fetch-verified' | 'source-provided';
}

export interface DivergenceRow {
  readonly id: string;
  readonly calculatorSlug: string;
  readonly topic: string;
  readonly niro: { readonly locator: string; readonly statement: string };
  readonly externalAnchors: readonly DivergenceAnchor[];
  readonly classification:
    | 'divergent-endpoint'
    | 'divergent-bands'
    | 'divergent-conversion'
    | 'source-conflict'
    | 'not-directly-comparable';
  readonly publicationImpact: string;
  readonly discrepancyIds: readonly string[];
}

export interface DivergenceSource {
  readonly schemaVersion: 'niro-external-divergence-source.v1';
  readonly scope: string;
  readonly researchPass: string;
  readonly rows: readonly DivergenceRow[];
}

export const P8_ROOT = resolve(__dirname, '..');
export const DIVERGENCE_SOURCE_PATH = join(
  P8_ROOT,
  'data',
  'reconciliation',
  'niro-external-divergence.source.v1.json',
);
export const DIVERGENCE_JSON_REPORT_PATH = join(
  P8_ROOT,
  'packages',
  'contracts',
  'reports',
  'niro-external-divergence.v1.json',
);
export const DIVERGENCE_MARKDOWN_REPORT_PATH = join(
  P8_ROOT,
  'packages',
  'contracts',
  'reports',
  'niro-external-divergence.v1.md',
);

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

export function stableJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const ALLOWED_SLUGS = new Set(['diabetes-risk', 'heart-risk', 'hypothyroid-risk', 'niro-cws']);
const ALLOWED_CLASSIFICATIONS = new Set([
  'divergent-endpoint',
  'divergent-bands',
  'divergent-conversion',
  'source-conflict',
  'not-directly-comparable',
]);

export function validateDivergenceSource(source: DivergenceSource): readonly string[] {
  const findings: string[] = [];
  if (source.schemaVersion !== 'niro-external-divergence-source.v1') {
    findings.push('schemaVersion must be niro-external-divergence-source.v1.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(source.researchPass)) {
    findings.push('researchPass must be an ISO date.');
  }
  if (source.rows.length === 0) findings.push('At least one divergence row is required.');
  const ids = source.rows.map((row) => row.id);
  if (new Set(ids).size !== ids.length) findings.push('Divergence row ids must be unique.');
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    findings.push('Divergence rows must be sorted by id.');
  }
  for (const [index, row] of source.rows.entries()) {
    const path = `rows[${index}]`;
    if (!/^DIV-\d{3}$/u.test(row.id)) findings.push(`${path}.id is invalid.`);
    if (!ALLOWED_SLUGS.has(row.calculatorSlug)) {
      findings.push(`${path}.calculatorSlug is outside the four-calculator reconciliation set.`);
    }
    if (row.calculatorSlug.startsWith('covid')) findings.push(`${path} must not include COVID.`);
    if (!ALLOWED_CLASSIFICATIONS.has(row.classification)) {
      findings.push(`${path}.classification is invalid.`);
    }
    if (row.externalAnchors.length === 0) findings.push(`${path} needs an external anchor.`);
    if (row.discrepancyIds.length === 0) findings.push(`${path} needs a discrepancy id.`);
    for (const anchor of row.externalAnchors) {
      if (Boolean(anchor.url) === Boolean(anchor.localRef)) {
        findings.push(`${path} anchors must have exactly one of url or localRef.`);
      }
      if (anchor.localRef?.replaceAll('\\', '/').includes('/catalog/')) {
        findings.push(`${path} references the quarantined catalog.`);
      }
    }
    const serialized = JSON.stringify(row).replaceAll('\\', '/');
    if (serialized.includes('/catalog/')) findings.push(`${path} crosses the catalog quarantine.`);
  }
  return findings;
}

export function readDivergenceSource(path = DIVERGENCE_SOURCE_PATH): DivergenceSource {
  return JSON.parse(readFileSync(path, 'utf8')) as DivergenceSource;
}

function countsBy(rows: readonly DivergenceRow[], select: (row: DivergenceRow) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[select(row)] = (counts[select(row)] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function buildDivergenceReport(source: DivergenceSource): JsonObject {
  const findings = validateDivergenceSource(source);
  if (findings.length > 0) {
    throw new Error(`Invalid divergence source: ${findings.join(' ')}`);
  }
  return {
    schemaVersion: 'niro-external-divergence-report.v1',
    sourceSchemaVersion: source.schemaVersion,
    sourceCanonicalSha256: sha256(stableJson(source)),
    researchPass: source.researchPass,
    policy: source.scope,
    publicationDecision:
      'No row authorizes a clinical-value change or publication. Original Niro sources remain authoritative for Niro scoring, while conflicts remain attributed and review-blocking where noted.',
    summary: {
      rowCount: source.rows.length,
      byCalculator: countsBy(source.rows, (row) => row.calculatorSlug),
      byClassification: countsBy(source.rows, (row) => row.classification),
    },
    rows: source.rows,
  };
}

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function anchorLabel(anchor: DivergenceAnchor): string {
  const label = `${anchor.organization}: ${anchor.title}`;
  if (anchor.url) return `[${escapeTable(label)}](${anchor.url})`;
  return `${escapeTable(label)} (${escapeTable(anchor.localRef ?? '')})`;
}

export function renderDivergenceMarkdown(report: JsonObject): string {
  const rows = report.rows as readonly DivergenceRow[];
  const summary = report.summary as {
    readonly rowCount: number;
    readonly byCalculator: Readonly<Record<string, number>>;
    readonly byClassification: Readonly<Record<string, number>>;
  };
  const lines = [
    '# Niro versus external-anchor divergence report v1',
    '',
    `Canonical source hash: \`${String(report.sourceCanonicalSha256)}\`  `,
    `Research pass: \`${String(report.researchPass)}\`  `,
    `Rows: **${summary.rowCount}**`,
    '',
    '> This is a deterministic discrepancy report, not a clinical harmonization. External anchors never overwrite original Niro scoring values. Every calculator below remains a draft and is not publication eligible.',
    '',
    '## Summary',
    '',
    `- By calculator: ${Object.entries(summary.byCalculator)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')}`,
    `- By classification: ${Object.entries(summary.byClassification)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')}`,
    '',
    '## Comparisons',
    '',
    '| ID | Calculator | Topic / classification | Niro source statement | External anchors | Publication impact | Discrepancies |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((row) => {
      const anchors = row.externalAnchors
        .map((anchor) => `${anchorLabel(anchor)} — ${escapeTable(anchor.statement)}`)
        .join('<br>');
      return `| ${row.id} | ${row.calculatorSlug} | ${escapeTable(row.topic)}<br>\`${row.classification}\` | ${escapeTable(row.niro.statement)}<br>Locator: \`${escapeTable(row.niro.locator)}\` | ${anchors} | ${escapeTable(row.publicationImpact)} | ${row.discrepancyIds.map((id) => `\`${id}\``).join(', ')} |`;
    }),
    '',
    '## Locked boundary',
    '',
    '- COVID is an internal nonclinical fixture and is excluded from this report.',
    '- The quarantined 62-calculator/79-measurement catalog is not an input.',
    '- CWS remains a rejected-source draft pending Niro stratified-range confirmation (N1).',
    '- The Heart 13-points to 10-percent example is a partial stage check only and does not satisfy PUB-007.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function generatedDivergenceArtifacts(source = readDivergenceSource()): {
  readonly json: string;
  readonly markdown: string;
} {
  const report = buildDivergenceReport(source);
  return { json: stableJson(report), markdown: renderDivergenceMarkdown(report) };
}

export function checkDivergenceArtifacts(
  source = readDivergenceSource(),
  jsonPath = DIVERGENCE_JSON_REPORT_PATH,
  markdownPath = DIVERGENCE_MARKDOWN_REPORT_PATH,
): readonly string[] {
  const generated = generatedDivergenceArtifacts(source);
  const findings: string[] = [];
  if (readFileSync(jsonPath, 'utf8') !== generated.json) findings.push('JSON report is stale.');
  if (readFileSync(markdownPath, 'utf8') !== generated.markdown)
    findings.push('Markdown report is stale.');
  return findings;
}

function main(): void {
  const generated = generatedDivergenceArtifacts();
  if (process.argv.includes('--write')) {
    writeFileSync(DIVERGENCE_JSON_REPORT_PATH, generated.json, 'utf8');
    writeFileSync(DIVERGENCE_MARKDOWN_REPORT_PATH, generated.markdown, 'utf8');
    console.log(
      JSON.stringify({ status: 'written', rows: readDivergenceSource().rows.length }, null, 2),
    );
    return;
  }
  const findings = checkDivergenceArtifacts();
  console.log(
    JSON.stringify({ status: findings.length === 0 ? 'ok' : 'stale', findings }, null, 2),
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (require.main === module) main();
