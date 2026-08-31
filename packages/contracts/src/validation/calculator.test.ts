import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateCalculatorJson, validateCalculatorVersion } from './calculator';

const fixtureDirectory = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'data',
  'fixtures',
  'config-samples',
);
const fixtureNames = [
  'covid-risk.config.json',
  'diabetes-risk.config.json',
  'heart-risk.config.json',
  'hypothyroid-risk.config.json',
  'niro-cws.config.json',
];

function semanticallyCleanCovidFixture(): Record<string, unknown> {
  const config = JSON.parse(
    readFileSync(join(fixtureDirectory, 'covid-risk.config.json'), 'utf8'),
  ) as Record<string, unknown>;
  for (const parameter of config.parameters as Record<string, unknown>[]) {
    const validation = parameter.validation as Record<string, unknown> | undefined;
    if (
      parameter.inputType !== 'derived' &&
      validation?.required !== true &&
      parameter.missingPolicy === undefined
    ) {
      parameter.missingPolicy = 'block';
    }
  }
  return config;
}

function addAgeBandImputation(
  config: Record<string, unknown>,
  bands: readonly Record<string, unknown>[],
): void {
  config.imputationRules = [
    {
      key: 'age-test-imputation',
      parameterKey: 'age',
      when: { param: 'age', op: 'missing' },
      action: { setPointsByBand: { bandParam: 'age', bands } },
      fallbackPolicy: 'block',
    },
  ];
}

describe('calculator-version.v1 validation', () => {
  it('structurally accepts all five untouched draft fixtures', () => {
    for (const fixtureName of fixtureNames) {
      const config = JSON.parse(
        readFileSync(join(fixtureDirectory, fixtureName), 'utf8'),
      ) as Record<string, unknown>;
      const result = validateCalculatorVersion(config, fixtureName);
      expect(result.structural.passed, fixtureName).toBe(true);
      expect(result.publishEligible, fixtureName).toBe(false);
    }
  });

  it('keeps malformed JSON in the structural layer', () => {
    const result = validateCalculatorJson('{"calculatorSlug":', 'malformed.json');
    expect(result.structural.findings[0]?.id).toBe('STR-001');
    expect(result.publishEligible).toBe(false);
  });

  it('does not treat semantic or clinical failures as structural failures', () => {
    const config = JSON.parse(
      readFileSync(join(fixtureDirectory, 'covid-risk.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    const result = validateCalculatorVersion(config, 'covid-risk.config.json');
    expect(result.structural.passed).toBe(true);
    expect(result.semantic.passed).toBe(false);
    expect(result.clinical.passed).toBe(false);
  });

  it('treats quoted lookup keys as data instead of expression identifiers', () => {
    const config = JSON.parse(
      readFileSync(join(fixtureDirectory, 'heart-risk.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    const result = validateCalculatorVersion(config, 'heart-risk.config.json');
    const unknownSymbols = result.semantic.findings
      .filter((finding) => finding.id === 'SEM-031')
      .map((finding) => finding.message);
    expect(unknownSymbols).not.toContain('Unknown expression symbol "to".');
    expect(unknownSymbols).not.toContain('Unknown expression symbol "risk".');
  });

  it('separates governance, review, evidence/license, SEO, dependency, golden, and engine gates', () => {
    const config = JSON.parse(
      readFileSync(join(fixtureDirectory, 'heart-risk.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    config.status = 'approved';
    config.engineSemanticVersion = '2.0.0';
    config.sources = [
      {
        type: 'niro',
        ref: 'source.xlsx#Heart',
        verification: 'source-provided',
      },
    ];
    config.governance = {
      clinicalStatus: 'approved',
      sourceReviewStatus: 'verified',
      discrepancyIds: [],
      publishBlockers: [],
      reviews: [],
      measurementRevisionIds: [],
      sourceReviewExpiresAt: '2025-01-01T00:00:00.000Z',
    };
    config.content = {
      schemaVersion: 'content-page.v1',
      contentId: 'heart-content',
      version: 1,
      locale: 'en-IN',
      slug: 'heart-risk',
      title: 'Heart risk content',
      summary: 'Content intentionally fails review gates in this validator test.',
      blocks: [{ id: 'intro', type: 'markdown', markdown: 'Claim text.', claimIds: ['claim'] }],
      claims: [
        {
          id: 'claim',
          text: 'A medical claim.',
          kind: 'medical-fact',
          citationIds: ['citation'],
          reviewStatus: 'verified',
        },
      ],
      citations: [
        {
          id: 'citation',
          type: 'niro',
          title: 'Source',
          localRef: 'source.xlsx#Heart',
          verificationStatus: 'needs-verification',
          licenseStatus: 'unknown',
          reviewExpiresAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      authorship: {
        contributors: [{ id: 'author', displayName: 'Author', role: 'author' }],
        ownerId: 'author',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      medicalReview: {
        status: 'unreviewed',
        scope: 'clinical-claims',
        reviewerId: null,
        reviewedAt: null,
        nextReviewAt: '2025-01-01T00:00:00.000Z',
        decisionNote: null,
        approvedClaimIds: [],
      },
      seo: {
        metaTitle: 'A deliberately invalid heart page title',
        metaDescription:
          'A deliberately invalid associated page used to exercise the independent publication gates.',
        canonicalPath: '/wrong-heart-path',
        robots: { index: false, follow: false },
        schemaTypes: ['MedicalWebPage'],
      },
      publication: {
        status: 'draft',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Test only.',
      },
    };
    config.testCases = [];
    const result = validateCalculatorVersion(
      config,
      'review-gates.json',
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const clinicalIds = new Set(result.clinical.findings.map((finding) => finding.id));
    const publishIds = new Set(result.publish.findings.map((finding) => finding.id));
    for (const id of ['CLN-004', 'CLN-010', 'CLN-011', 'CLN-012']) {
      expect(clinicalIds.has(id), id).toBe(true);
    }
    for (const id of ['PUB-006', 'PUB-007', 'PUB-009', 'PUB-010', 'PUB-013', 'PUB-015']) {
      expect(publishIds.has(id), id).toBe(true);
    }
  });

  it('keeps unreviewed/partial draft governance explicitly non-publishable', () => {
    const config = JSON.parse(
      readFileSync(join(fixtureDirectory, 'diabetes-risk.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    config.governance = {
      clinicalStatus: 'unreviewed',
      sourceReviewStatus: 'partial',
      discrepancyIds: ['DIA-01'],
      publishBlockers: ['DIA-01 remains unresolved.'],
      reviews: [],
      measurementRevisionIds: [],
    };
    const result = validateCalculatorVersion(config, 'diabetes-overlay-candidate.json');
    expect(
      result.clinical.findings.some(
        (finding) => finding.id === 'CLN-010' && finding.jsonPath === '$.governance.clinicalStatus',
      ),
    ).toBe(true);
    expect(
      result.clinical.findings.some(
        (finding) =>
          finding.id === 'CLN-004' && finding.jsonPath === '$.governance.sourceReviewStatus',
      ),
    ).toBe(true);
    expect(result.publishEligible).toBe(false);
  });

  it('accepts an adjacent imputation seam under frozen [min,max) defaults', () => {
    const config = semanticallyCleanCovidFixture();
    addAgeBandImputation(config, [
      { max: 40, points: 0 },
      { min: 40, max: 50, points: 1 },
      { min: 50, points: 2 },
    ]);

    const result = validateCalculatorVersion(config, 'adjacent-imputation-bands.json');

    expect(result.structural.passed).toBe(true);
    expect(result.semantic.passed).toBe(true);
    expect(result.semantic.findings.filter((finding) => finding.id === 'SEM-023')).toEqual([]);
  });

  it('fails closed with the exact imputation-band overlap diagnostic', () => {
    const config = semanticallyCleanCovidFixture();
    addAgeBandImputation(config, [
      { max: 41, points: 0 },
      { min: 40, max: 50, points: 1 },
      { min: 50, points: 2 },
    ]);

    const result = validateCalculatorVersion(config, 'overlapping-imputation-bands.json');
    const overlaps = result.semantic.findings
      .filter((finding) => finding.id === 'SEM-023')
      .map(({ id, jsonPath, message, severity }) => ({ id, jsonPath, message, severity }));

    expect(result.structural.passed).toBe(true);
    expect(overlaps).toEqual([
      {
        id: 'SEM-023',
        jsonPath: '$.imputationRules[0].action.setPointsByBand.bands[1]',
        message: 'Band overlaps band 0; array order cannot resolve overlap.',
        severity: 'error',
      },
    ]);
    expect(result.semantic.passed).toBe(false);
    expect(result.publishEligible).toBe(false);
  });

  it('does not let a generic regression bypass the clinical PUB-007 source-golden gate', () => {
    const config = JSON.parse(
      readFileSync(join(fixtureDirectory, 'covid-risk.config.json'), 'utf8'),
    ) as Record<string, unknown>;
    config.testCases = [
      {
        key: 'validator-regression',
        name: 'Validator-only regression shape',
        kind: 'regression',
        inputs: { age: 40 },
        expected: { finalScore: 0, category: 'Low' },
      },
      {
        key: 'validator-boundary',
        name: 'Validator-only boundary shape',
        kind: 'boundary',
        inputs: { age: 65 },
        expected: { finalScore: 1 },
      },
    ];
    const regressionOnly = validateCalculatorVersion(config, 'pub-007-regression-only.json');
    expect(regressionOnly.publish.findings.some((finding) => finding.id === 'PUB-007')).toBe(true);

    (config.testCases as Record<string, unknown>[])[0] = {
      key: 'validator-source-golden',
      name: 'Validator-only complete source-golden shape',
      kind: 'source-worked-example',
      inputs: { age: 40 },
      expected: { finalScore: 0, category: 'Low' },
      source: {
        type: 'internal',
        ref: 'internal-fixture#validator-only',
        verification: 'source-provided',
      },
    };
    const completeSourceGolden = validateCalculatorVersion(
      config,
      'pub-007-complete-source-golden.json',
    );
    expect(completeSourceGolden.publish.findings.some((finding) => finding.id === 'PUB-007')).toBe(
      false,
    );
  });
});
