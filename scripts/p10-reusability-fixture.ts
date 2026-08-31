import { validateCalculatorVersion } from '@niro/contracts';

import {
  createP7CalculatorPayload,
  p7FixtureIdentities,
  p7FixtureKeys,
} from './p7-browser-fixture';
import { p10CalculatorSlug } from './p10-fixture-identity';

export { p10CalculatorSlug } from './p10-fixture-identity';

const FIXTURE_ID = 'p10-studio-only-reusability-gate-v1';
const REVIEWED_AT = '2026-08-28T00:00:00.000Z';

export function createP10ReusabilityPayload(nonce: string): Record<string, unknown> {
  const measurementKey = p7FixtureKeys(nonce).measurement;
  const measurementRevisionId = p7FixtureIdentities(nonce).measurementId.toString();
  const slug = p10CalculatorSlug(nonce);
  const name = `Synthetic P10 adaptability check ${nonce.slice(0, 10)}`;
  const base = createP7CalculatorPayload(nonce, measurementRevisionId);
  const payload: Record<string, unknown> = {
    ...base,
    calculatorSlug: slug,
    name,
    shortDescription:
      'A temporary nonclinical calculator authored through Calculator Studio for the P10 reusability gate.',
    parameters: [
      {
        key: 'readinessAnswer',
        label: 'Synthetic readiness check',
        group: 'questionnaire',
        inputType: 'boolean',
        validation: { required: true },
        missingPolicy: 'block',
        order: 1,
        helpText: 'This answer is synthetic and has no medical interpretation.',
      },
      {
        key: 'markerValue',
        label: 'Optional synthetic marker value',
        group: 'measurements',
        biomarkerKey: measurementKey,
        inputType: 'number',
        unit: { canonical: 'mg/L', allowed: [{ code: 'mg/dL', factor: 10 }] },
        validation: { required: false, min: 0, max: 100, softMin: 1, softMax: 90 },
        missingPolicy: 'exclude-from-group',
        order: 2,
        helpText: 'Optional synthetic input used to prove partial-laboratory handling.',
      },
    ],
    scoringRules: [
      {
        parameterKey: 'readinessAnswer',
        optionPoints: [
          { value: false, points: 0 },
          { value: true, points: 1 },
        ],
      },
      {
        parameterKey: 'markerValue',
        bandEdges: 'min-inclusive',
        contexts: [
          {
            when: null,
            bands: [
              { min: null, max: 50, points: 0 },
              { min: 50, max: null, points: 1 },
            ],
          },
        ],
      },
    ],
    formulas: [{ key: 'final-score', expression: 'sum(points)' }],
    domains: [
      {
        key: 'questionnaire',
        label: 'Synthetic questionnaire',
        weight: 0.5,
        parameterKeys: ['readinessAnswer'],
      },
      {
        key: 'measurements',
        label: 'Synthetic measurements',
        weight: 0.5,
        parameterKeys: ['markerValue'],
      },
    ],
    domainAggregationPolicy: {
      zeroDenominator: 'unscored',
      missingDomainPolicy: 'exclude-and-renormalize',
      negativeDomainPolicy: 'preserve',
    },
    resultCategories: {
      scale: { min: 0, max: 2, direction: 'higher-is-worse' },
      bandEdges: 'min-inclusive',
      bands: [
        {
          label: 'Lower synthetic score',
          min: null,
          max: 1,
          color: '#26734D',
          message: 'The synthetic inputs produced the lower nonclinical test category.',
          recommendation: 'No medical action is associated with this fixture.',
        },
        {
          label: 'Higher synthetic score',
          min: 1,
          max: null,
          color: '#9A5B00',
          message: 'The synthetic inputs produced the higher nonclinical test category.',
          recommendation: 'No medical action is associated with this fixture.',
        },
      ],
    },
    uiConfig: {
      theme: { accent: '#0D5CAB' },
      steps: [
        {
          key: 'questionnaire',
          title: 'Synthetic questionnaire',
          parameterGroups: ['questionnaire'],
        },
        {
          key: 'measurements',
          title: 'Optional synthetic laboratory value',
          parameterGroups: ['measurements'],
        },
      ],
      result: {
        layout: [
          'score-gauge',
          'category',
          'key-contributors',
          'domain-breakdown',
          'biomarker-details',
          'recommendations',
        ],
      },
    },
    content: {
      schemaVersion: 'content-page.v1',
      contentId: `${slug}-content`,
      version: 1,
      locale: 'en-IN',
      slug,
      title: name,
      summary: 'Reviewed nonclinical content used only for the automated P10 reusability gate.',
      blocks: [
        {
          id: 'fixture-notice',
          type: 'markdown',
          markdown:
            'This temporary calculator contains only synthetic nonclinical test logic and is never a health recommendation.',
        },
      ],
      claims: [],
      citations: [],
      authorship: {
        contributors: [{ id: 'p10-automation', displayName: 'P10 automation', role: 'author' }],
        ownerId: 'p10-automation',
        createdAt: REVIEWED_AT,
        updatedAt: REVIEWED_AT,
      },
      medicalReview: {
        status: 'not-applicable',
        scope: 'not-applicable',
        reviewerId: null,
        reviewedAt: null,
        nextReviewAt: null,
        decisionNote: 'Synthetic nonclinical automation fixture.',
      },
      seo: {
        metaTitle: name,
        metaDescription: 'Temporary nonclinical Calculator Studio P10 reusability fixture.',
        canonicalPath: `/c/${slug}`,
        robots: { index: false, follow: false },
        schemaTypes: ['WebPage'],
      },
      publication: {
        status: 'approved',
        publishedAt: null,
        retiredAt: null,
        changelog: 'Created through Calculator Studio for the P10 reusability gate.',
      },
    },
    sources: [
      {
        type: 'internal',
        ref: `${FIXTURE_ID}:${nonce}`,
        title: 'P10 automated nonclinical reusability fixture',
        verification: 'source-provided',
        demoPoints: true,
      },
    ],
    governance: {
      clinicalStatus: 'not-applicable',
      sourceReviewStatus: 'not-applicable',
      discrepancyIds: [],
      publishBlockers: [],
      measurementRevisionIds: [measurementRevisionId],
    },
    testCases: [
      {
        key: 'p10-partial-labs',
        name: 'Questionnaire result with the optional lab omitted',
        kind: 'nonclinical-fixture',
        inputs: { readinessAnswer: false },
        expected: { finalScore: 0, category: 'Lower synthetic score' },
      },
      {
        key: 'p10-threshold',
        name: 'Synthetic marker at the authored threshold',
        kind: 'boundary',
        inputs: { readinessAnswer: false, markerValue: 50 },
        expected: { finalScore: 1, category: 'Higher synthetic score' },
      },
    ],
  };

  const validation = validateCalculatorVersion(payload, `${slug}.p10.fixture.json`);
  if (!validation.publishEligible) {
    const findings = [
      ...validation.structural.findings,
      ...validation.semantic.findings,
      ...validation.clinical.findings,
      ...validation.publish.findings,
    ];
    throw new Error(
      `Invalid P10 reusability fixture: ${findings
        .map((finding) => `${finding.id} ${finding.jsonPath}: ${finding.message}`)
        .join('; ')}`,
    );
  }
  return payload;
}
