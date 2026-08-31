// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BandEditor, bandBoundaryText } from './BandEditor';
import { CategoryEditor } from './CategoryEditor';
import { ConditionBuilder } from './ConditionBuilder';
import { DomainEditor } from './DomainEditor';
import { JsonAreaEditor, LayoutContentEditor } from './LayoutContentEditor';
import { ParameterEditor } from './ParameterEditor';
import { ScoringEditor } from './ScoringEditor';
import { DetailsEditor } from '../studio/StudioWorkspace';
import type { JsonRecord } from '../editor-helpers';

afterEach(cleanup);

function ConditionHarness() {
  const [value, setValue] = useState<JsonRecord>({
    all: [{ param: 'age', op: 'gte', value: 18 }],
    preservedExtension: 'kept',
  });
  return (
    <>
      <ConditionBuilder
        value={value}
        onChange={setValue}
        parameterKeys={['age', 'sex']}
        legend="Eligibility"
      />
      <output data-testid="condition-json">{JSON.stringify(value)}</output>
    </>
  );
}

describe('Calculator Studio editors', () => {
  it('authors frozen engine and content schema versions from a blank Studio draft', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [draft, setDraft] = useState<JsonRecord>({
        calculatorSlug: 'blank-studio-fixture',
        name: 'Blank Studio fixture',
        uiConfig: { steps: [], result: { layout: [] } },
        governance: { publishBlockers: [] },
      });
      return (
        <>
          <DetailsEditor draft={draft} onChange={setDraft} />
          <LayoutContentEditor draft={draft} onChange={setDraft} />
          <output data-testid="schema-draft-json">{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Harness />);
    await user.type(screen.getByLabelText('Engine semantic version'), '1.0.0');
    await user.type(screen.getByLabelText('Content schema version'), 'content-page.v1');
    await user.selectOptions(screen.getByLabelText('Medical review status'), 'not-applicable');
    await user.selectOptions(screen.getByLabelText('Content publication status'), 'approved');
    expect(JSON.parse(screen.getByTestId('schema-draft-json').textContent ?? '{}')).toMatchObject({
      engineSemanticVersion: '1.0.0',
      content: {
        schemaVersion: 'content-page.v1',
        medicalReview: {
          status: 'not-applicable',
          reviewerId: null,
          reviewedAt: null,
          nextReviewAt: null,
          decisionNote: null,
        },
        publication: { status: 'approved', publishedAt: null, retiredAt: null, changelog: '' },
      },
    });
  });

  it('authors schema-supported review coverage and expiry fields without dropping extensions', () => {
    function Harness() {
      const [draft, setDraft] = useState<JsonRecord>({
        preservedRoot: 'kept',
        content: {
          preservedContent: 'kept',
          claims: [
            {
              id: 'claim-one',
              text: 'Claim one',
              kind: 'medical-fact',
              citationIds: ['citation-one'],
              reviewStatus: 'verified',
            },
          ],
          citations: [
            {
              id: 'citation-one',
              type: 'internal',
              title: 'Citation one',
              localRef: 'source#one',
              verificationStatus: 'source-provided',
              licenseStatus: 'not-applicable',
              reviewExpiresAt: '2027-01-01T00:00:00.000Z',
              preservedCitation: 'kept',
            },
          ],
          medicalReview: {
            status: 'in-review',
            scope: 'clinical-claims',
            reviewerId: 'reviewer-one',
            reviewedAt: null,
            nextReviewAt: null,
            decisionNote: null,
            approvedClaimIds: ['claim-one'],
            preservedMedicalReview: 'kept',
          },
        },
        governance: {
          clinicalStatus: 'in-review',
          sourceReviewStatus: 'partial',
          discrepancyIds: [],
          publishBlockers: ['External review is pending.'],
          sourceReviewExpiresAt: '2027-02-01T00:00:00.000Z',
          preservedGovernance: 'kept',
        },
        uiConfig: { steps: [], result: { layout: [] } },
      });
      return (
        <>
          <LayoutContentEditor draft={draft} onChange={setDraft} />
          <output data-testid="review-draft-json">{JSON.stringify(draft)}</output>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByText(/entering metadata here cannot approve a calculator/i)).toBeVisible();

    const approvedClaims = screen.getByLabelText('Approved claim IDs (one per line)');
    fireEvent.change(approvedClaims, { target: { value: 'claim-one\nclaim-two' } });

    const citationExpiry = screen.getByLabelText('Citation review expires at (ISO 8601)');
    fireEvent.change(citationExpiry, { target: { value: '2028-01-01T00:00:00.000Z' } });

    const sourceExpiry = screen.getByLabelText('Source review expires at (ISO 8601)');
    fireEvent.change(sourceExpiry, { target: { value: '2028-02-01T00:00:00.000Z' } });

    expect(JSON.parse(screen.getByTestId('review-draft-json').textContent ?? '{}')).toMatchObject({
      preservedRoot: 'kept',
      content: {
        preservedContent: 'kept',
        citations: [
          {
            reviewExpiresAt: '2028-01-01T00:00:00.000Z',
            preservedCitation: 'kept',
          },
        ],
        medicalReview: {
          approvedClaimIds: ['claim-one', 'claim-two'],
          preservedMedicalReview: 'kept',
        },
      },
      governance: {
        sourceReviewExpiresAt: '2028-02-01T00:00:00.000Z',
        preservedGovernance: 'kept',
      },
    });
  });

  it('serializes nested condition groups and typed predicate values without free-text logic', async () => {
    const user = userEvent.setup();
    render(<ConditionHarness />);
    expect(screen.getByRole('group', { name: 'Condition 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add condition to ALL' }));
    expect(screen.getByRole('group', { name: 'Condition 1.2' })).toBeInTheDocument();
    const second = screen.getByRole('group', { name: 'Condition 1.2' });
    await user.selectOptions(within(second).getByLabelText('Condition type'), 'any');
    expect(JSON.parse(screen.getByTestId('condition-json').textContent ?? '{}')).toMatchObject({
      all: [{ param: 'age', op: 'gte', value: 18 }, { any: [{ param: '', op: 'eq', value: '' }] }],
    });
  });

  it('prefills a parameter from canonical biomarker fields without copying ranges or provenance', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [parameter, setParameter] = useState<JsonRecord>({
        key: 'marker',
        group: 'labs',
        inputType: 'number',
        order: 1,
      });
      return (
        <>
          <ParameterEditor
            parameter={parameter}
            onChange={setParameter}
            biomarkers={[
              {
                key: 'marker',
                displayName: 'Canonical marker',
                revision: 3,
                status: 'draft',
                definition: {
                  canonicalUnit: { code: 'mg/L' },
                  inputBounds: { hard: { min: 0, max: 20 } },
                  description: { whatItMeasures: 'Synthetic marker description.' },
                  referenceRanges: [{ interval: { min: 5, max: 10 } }],
                  governance: { publishBlockers: ['REVIEW-REQUIRED'] },
                },
                provenance: { clinicalSecret: 99 },
              },
            ]}
          />
          <output data-testid="parameter-json">{JSON.stringify(parameter)}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByText(/1 publish blockers/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Canonical marker' }));
    const parameter = JSON.parse(screen.getByTestId('parameter-json').textContent ?? '{}');
    expect(parameter).toMatchObject({
      biomarkerKey: 'marker',
      label: 'Canonical marker',
      unit: { canonical: 'mg/L' },
      validation: { min: 0, max: 20 },
      helpText: 'Synthetic marker description.',
    });
    expect(JSON.stringify(parameter)).not.toContain('referenceRanges');
    expect(JSON.stringify(parameter)).not.toContain('clinicalSecret');
  });

  it('edits exact band inclusivity and leaves an explicit source warning', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [bands, setBands] = useState<readonly JsonRecord[]>([{ min: 0, max: 10, points: 1 }]);
      return (
        <>
          <BandEditor bands={bands} onChange={setBands} />
          <output data-testid="bands-json">{JSON.stringify(bands)}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toHaveTextContent('Source attribution is required');
    await user.selectOptions(screen.getByLabelText('Lower boundary type'), 'exclusive');
    const bands = JSON.parse(screen.getByTestId('bands-json').textContent ?? '[]');
    expect(bands[0]).toMatchObject({ min: 0, minExclusive: true, max: 10 });
    expect(bands[0]).not.toHaveProperty('minInclusive');
    expect(screen.getByLabelText('Score bands number line')).toHaveTextContent('(0, 10)');
  });

  it('renders inherited [min,max) semantics and true per-bound overrides exactly', () => {
    const band = { min: 0, max: 10 };
    expect(bandBoundaryText(band, 'min-inclusive')).toBe('[0, 10)');
    expect(bandBoundaryText(band, 'explicit')).toBe('(0, 10)');
    expect(
      bandBoundaryText({ ...band, minExclusive: true, maxInclusive: true }, 'min-inclusive'),
    ).toBe('(0, 10]');
    expect(bandBoundaryText({ ...band, minInclusive: true, maxInclusive: true }, 'explicit')).toBe(
      '[0, 10]',
    );
  });

  it('passes scoring and adjustment edge semantics into their band editors', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [draft, setDraft] = useState<JsonRecord>({
        preservedRoot: { value: true },
        parameters: [{ key: 'marker' }],
        scoringRules: [
          {
            parameterKey: 'marker',
            bandEdges: 'explicit',
            preservedRule: 'kept',
            contexts: [{ when: null, bands: [{ min: 0, max: 10, points: 1 }] }],
          },
        ],
        adjustmentRules: [
          {
            key: 'adjustment',
            label: 'Adjustment',
            bandParam: 'marker',
            bandEdges: 'explicit',
            preservedAdjustment: 'kept',
            bands: [{ min: 0, max: 10, points: -1 }],
          },
        ],
      });
      return (
        <>
          <ScoringEditor draft={draft} onChange={setDraft} />
          <output data-testid="scoring-json">{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByText('Rule 1: marker'));
    expect(screen.getByLabelText('Context 1 bands number line')).toHaveTextContent('(0, 10)');

    const adjustmentSummary = screen.getByText('Adjustment 1: Adjustment');
    await user.click(adjustmentSummary);
    const adjustment = adjustmentSummary.closest('details');
    expect(adjustment).not.toBeNull();
    expect(within(adjustment!).getByLabelText('Adjustment 1 bands number line')).toHaveTextContent(
      '(0, 10)',
    );
    await user.selectOptions(
      within(adjustment!).getByLabelText('Default edge semantics'),
      'min-inclusive',
    );
    expect(within(adjustment!).getByLabelText('Adjustment 1 bands number line')).toHaveTextContent(
      '[0, 10)',
    );
    expect(JSON.parse(screen.getByTestId('scoring-json').textContent ?? '{}')).toMatchObject({
      preservedRoot: { value: true },
      scoringRules: [{ preservedRule: 'kept', bandEdges: 'explicit' }],
      adjustmentRules: [{ preservedAdjustment: 'kept', bandEdges: 'min-inclusive' }],
    });
  });

  it('edits and displays effective result-category boundaries without dropping extensions', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [draft, setDraft] = useState<JsonRecord>({
        preservedRoot: 'kept',
        resultCategories: {
          bandEdges: 'explicit',
          preservedCategories: { value: 7 },
          scale: { min: 0, max: 100, direction: 'higher-is-worse' },
          bands: [
            {
              label: 'Low',
              min: 0,
              minInclusive: true,
              max: 50,
              color: '#26734D',
              preservedBand: 'kept',
            },
            {
              label: 'High',
              min: 50,
              minInclusive: true,
              max: 100,
              maxInclusive: true,
              color: '#9A5B00',
            },
          ],
        },
      });
      return (
        <>
          <CategoryEditor draft={draft} onChange={setDraft} />
          <output data-testid="category-json">{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByLabelText('Category bands number line')).toHaveTextContent('[0, 50)');
    expect(screen.getByLabelText('Category bands number line')).toHaveTextContent('[50, 100]');
    expect(
      within(screen.getByRole('region', { name: 'Category coverage' })).getByRole('status'),
    ).toHaveTextContent('without detected gaps or overlaps');

    const firstCategory = screen.getByRole('group', { name: 'Category 1' });
    await user.selectOptions(
      within(firstCategory).getByLabelText('Upper boundary type'),
      'inclusive',
    );
    expect(screen.getByLabelText('Category bands number line')).toHaveTextContent('[0, 50]');
    expect(screen.getByRole('alert')).toHaveTextContent('both include 50');
    const changed = JSON.parse(screen.getByTestId('category-json').textContent ?? '{}');
    expect(changed).toMatchObject({
      preservedRoot: 'kept',
      resultCategories: {
        bandEdges: 'explicit',
        preservedCategories: { value: 7 },
      },
    });
    expect(changed.resultCategories.bands[0]).toMatchObject({
      maxInclusive: true,
      preservedBand: 'kept',
    });
  });

  it('displays percentages but stores domain weights as fractions and reports assignments', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [draft, setDraft] = useState<JsonRecord>({
        parameters: [{ key: 'alpha' }, { key: 'beta' }],
        domains: [{ key: 'first', label: 'First', weight: 0.4, parameterKeys: ['alpha'] }],
      });
      return (
        <>
          <DomainEditor draft={draft} onChange={setDraft} />
          <output data-testid="draft-json">{JSON.stringify(draft)}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByText(/Publication is blocked:/)).toHaveTextContent(/sum exactly to 1.0/);
    expect(screen.getByText(/Unassigned parameters: beta/)).toBeInTheDocument();
    const weight = screen.getByLabelText('Weight (percent)');
    await user.clear(weight);
    await user.type(weight, '100');
    const draft = JSON.parse(screen.getByTestId('draft-json').textContent ?? '{}');
    expect(draft.domains[0].weight).toBe(1);
    expect(screen.getByText('Domain weights sum exactly to 1.0.')).toBeInTheDocument();
  });

  it('does not apply invalid advanced JSON', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <JsonAreaEditor label="Lookup tables JSON" value={[]} expect="array" onChange={onChange} />,
    );
    const editor = screen.getByLabelText('Lookup tables JSON');
    await user.clear(editor);
    await user.type(editor, '{{invalid');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('JSON was not saved');
    expect(onChange).not.toHaveBeenCalled();
  });
});
