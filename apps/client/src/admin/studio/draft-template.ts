type JsonRecord = Record<string, unknown>;

export function createEmptyDraft(slug: string, name: string): JsonRecord {
  return {
    $schema: 'niro-platform/calculator-version.v1',
    calculatorSlug: slug,
    name,
    version: 1,
    status: 'draft',
    shortDescription: '',
    disclaimers: [],
    parameters: [],
    scoringRules: [],
    formulas: [],
    domains: [],
    resultCategories: {
      scale: { min: 0, max: 100, direction: 'higher-is-worse', clamp: false },
      bandEdges: 'explicit',
      bands: [],
    },
    uiConfig: {
      theme: { accent: '#0d5cab' },
      steps: [],
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
    governance: {
      clinicalStatus: 'unreviewed',
      sourceReviewStatus: 'unreviewed',
      discrepancyIds: [],
      publishBlockers: ['Authoring, evidence, tests, and independent review are incomplete.'],
      measurementRevisionIds: [],
    },
    testCases: [],
  };
}

export function measurementIdsFromPayload(payload: Readonly<JsonRecord>): readonly string[] {
  const governance = payload.governance;
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)) return [];
  const ids = (governance as JsonRecord).measurementRevisionIds;
  return Array.isArray(ids)
    ? [...new Set(ids.filter((item): item is string => typeof item === 'string'))]
    : [];
}
