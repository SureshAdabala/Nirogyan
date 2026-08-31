import type { AdminValidationSummary, ValidationFinding } from '@niro/contracts';
import { describe, expect, it } from 'vitest';

import { allValidationFindings, findingAnchor, tabForFinding } from './validation-navigation';

function finding(
  jsonPath: string,
  layer: ValidationFinding['layer'] = 'semantic',
): ValidationFinding {
  return {
    id: 'TEST-001',
    layer,
    severity: 'error',
    artifact: 'fixture',
    jsonPath,
    message: 'Finding',
    relatedDiscrepancyIds: [],
    remediation: 'Fix it.',
    status: 'open',
    evidence: [],
  };
}

describe('Studio validation navigation', () => {
  it.each([
    ['/parameters/0/key', 'parameters'],
    ['/scoringRules/1/contexts', 'scoring'],
    ['/lookupTables/0', 'scoring'],
    ['/domains/0/weight', 'domains'],
    ['/resultCategories/bands/0', 'categories'],
    ['/content/seo/metaTitle', 'content'],
    ['/governance/publishBlockers', 'content'],
    ['/testCases/0', 'release'],
    ['/name', 'details'],
  ])('maps %s to %s', (path, tab) => {
    expect(tabForFinding(finding(path))).toBe(tab);
  });

  it('preserves layer ordering when flattening the server result', () => {
    const validation = {
      publishEligible: false,
      errorCount: 4,
      warningCount: 0,
      layers: {
        structural: {
          layer: 'structural',
          passed: false,
          findings: [finding('/name', 'structural')],
        },
        semantic: {
          layer: 'semantic',
          passed: false,
          findings: [finding('/formulas', 'semantic')],
        },
        clinical: {
          layer: 'clinical',
          passed: false,
          findings: [finding('/governance', 'clinical')],
        },
        publish: { layer: 'publish', passed: false, findings: [finding('/testCases', 'publish')] },
      },
    } satisfies AdminValidationSummary;
    expect(allValidationFindings(validation).map((item) => item.layer)).toEqual([
      'structural',
      'semantic',
      'clinical',
      'publish',
    ]);
    expect(findingAnchor('/content/seo/metaTitle')).toBe('studio-path-content-seo-metaTitle');
  });
});
