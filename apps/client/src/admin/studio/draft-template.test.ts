import { describe, expect, it } from 'vitest';

import { createEmptyDraft, measurementIdsFromPayload } from './draft-template';

describe('Studio draft template', () => {
  it('starts explicitly unreviewed and publish-blocked without clinical defaults', () => {
    const draft = createEmptyDraft('new-calculator', 'New calculator');
    expect(draft.status).toBe('draft');
    expect(draft.scoringRules).toEqual([]);
    expect(draft.parameters).toEqual([]);
    expect(draft.governance).toMatchObject({
      clinicalStatus: 'unreviewed',
      sourceReviewStatus: 'unreviewed',
    });
    expect((draft.governance as { publishBlockers: unknown[] }).publishBlockers).not.toHaveLength(
      0,
    );
  });

  it('deduplicates only explicit measurement revision IDs', () => {
    expect(
      measurementIdsFromPayload({
        governance: { measurementRevisionIds: ['a', 'a', 3, 'b'] },
      }),
    ).toEqual(['a', 'b']);
  });
});
