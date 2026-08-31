import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildDivergenceReport,
  checkDivergenceArtifacts,
  DIVERGENCE_JSON_REPORT_PATH,
  DIVERGENCE_MARKDOWN_REPORT_PATH,
  generatedDivergenceArtifacts,
  readDivergenceSource,
  validateDivergenceSource,
} from './generate-niro-divergence-report';

describe('P8 deterministic Niro divergence report', () => {
  it('builds a stable report from only the four source-derived calculators', () => {
    const source = readDivergenceSource();
    expect(validateDivergenceSource(source)).toEqual([]);
    const first = generatedDivergenceArtifacts(source);
    const second = generatedDivergenceArtifacts(structuredClone(source));
    expect(first).toEqual(second);
    expect(first.json).not.toContain('covid');
    expect(first.json).not.toContain('data/catalog');
    const report = buildDivergenceReport(source);
    expect(report.summary).toMatchObject({
      rowCount: 11,
      byCalculator: {
        'diabetes-risk': 2,
        'heart-risk': 2,
        'hypothyroid-risk': 1,
        'niro-cws': 6,
      },
    });
    expect(first.markdown).toContain('External anchors never overwrite original Niro');
  });

  it('keeps checked JSON and Markdown exactly generator-derived', () => {
    expect(checkDivergenceArtifacts()).toEqual([]);
    const generated = generatedDivergenceArtifacts();
    expect(readFileSync(DIVERGENCE_JSON_REPORT_PATH, 'utf8')).toBe(generated.json);
    expect(readFileSync(DIVERGENCE_MARKDOWN_REPORT_PATH, 'utf8')).toBe(generated.markdown);
  });

  it('rejects duplicate/unsorted ids and quarantine-boundary violations', () => {
    const source = structuredClone(readDivergenceSource());
    const first = source.rows[0];
    const second = source.rows[1];
    if (!first || !second) throw new Error('Expected source rows.');
    Object.assign(second, {
      id: first.id,
      calculatorSlug: 'covid-19-risk-check',
      niro: { locator: 'data/catalog/calculators.json', statement: 'unsafe' },
    });
    const findings = validateDivergenceSource(source);
    expect(findings).toContain('Divergence row ids must be unique.');
    expect(findings.some((finding) => finding.includes('outside the four-calculator'))).toBe(true);
    expect(findings.some((finding) => finding.includes('catalog quarantine'))).toBe(true);
  });
});
