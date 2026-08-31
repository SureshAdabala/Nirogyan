import type { AdminValidationSummary, ValidationFinding } from '@niro/contracts';

export type StudioTab =
  'details' | 'parameters' | 'scoring' | 'domains' | 'categories' | 'content' | 'release';

const PATH_TABS: readonly [prefix: string, tab: StudioTab][] = [
  ['/parameters', 'parameters'],
  ['/scoringRules', 'scoring'],
  ['/adjustmentRules', 'scoring'],
  ['/parameterGroupsAggregation', 'scoring'],
  ['/imputationRules', 'scoring'],
  ['/lookupTables', 'scoring'],
  ['/floorRules', 'scoring'],
  ['/domains', 'domains'],
  ['/domainAggregationPolicy', 'domains'],
  ['/formulas', 'domains'],
  ['/resultCategories', 'categories'],
  ['/uiConfig', 'content'],
  ['/content', 'content'],
  ['/governance', 'content'],
  ['/sources', 'content'],
  ['/testCases', 'release'],
];

export function tabForFinding(finding: Pick<ValidationFinding, 'jsonPath'>): StudioTab {
  return PATH_TABS.find(([prefix]) => finding.jsonPath.startsWith(prefix))?.[1] ?? 'details';
}

export function allValidationFindings(
  validation: AdminValidationSummary | undefined,
): readonly ValidationFinding[] {
  if (!validation) return [];
  return [
    ...validation.layers.structural.findings,
    ...validation.layers.semantic.findings,
    ...validation.layers.clinical.findings,
    ...validation.layers.publish.findings,
  ];
}

export function findingAnchor(jsonPath: string): string {
  return `studio-path-${jsonPath.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'root'}`;
}
