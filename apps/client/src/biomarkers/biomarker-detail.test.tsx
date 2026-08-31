// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import type { PublicBiomarkerDetail } from '@niro/contracts';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { BiomarkerDetail } from './biomarker-detail';

afterEach(cleanup);

const fixture: PublicBiomarkerDetail = {
  key: 'synthetic-glucose',
  revision: 2,
  displayName: 'Synthetic Glucose',
  kind: 'laboratory-biomarker',
  canonicalUnit: 'mg/dL',
  definition: {
    aliases: ['Fixture glucose'],
    domainKeys: ['metabolic'],
    valueType: 'number',
    canonicalUnit: {
      code: 'mg/dL',
      display: 'mg/dL',
      dimension: 'mass-concentration',
    },
    acceptedUnits: [
      { code: 'mg/dL', display: 'mg/dL', dimension: 'mass-concentration' },
      { code: 'mmol/L', display: 'mmol/L', dimension: 'substance-concentration' },
    ],
    description: {
      whatItMeasures: 'A nonclinical concentration used for renderer tests.',
      whyItMatters: 'It proves reviewed educational copy can be displayed.',
      collectionNotes: 'Collect with the fixture preparation.',
      limitations: 'This fixture is not medical guidance.',
    },
    referenceRanges: [
      {
        id: 'source-a-range',
        label: 'Reviewed interval A',
        unit: 'mg/dL',
        interval: { min: 70, max: 99, minInclusive: true, maxInclusive: true },
        context: {
          sexAtBirth: 'female',
          ageMinYears: 18,
          ageMaxYears: 65,
          fastingStatus: 'fasting',
          specimen: 'Synthetic serum',
          sampleTiming: 'Morning',
          population: 'Synthetic adults',
          method: 'Fixture assay A',
        },
        interpretation: 'A reviewed fixture interval.',
        interpretationOnly: true,
        sourceClaimIds: ['claim-a'],
        conflictGroup: 'synthetic-conflict',
      },
      {
        id: 'source-b-range',
        label: 'Reviewed interval B',
        unit: 'mg/dL',
        interval: { max: 105, maxInclusive: false },
        context: { population: 'Synthetic adults', method: 'Fixture assay B' },
        interpretationOnly: true,
        sourceClaimIds: ['claim-b'],
        conflictGroup: 'synthetic-conflict',
      },
    ],
  },
  sources: [
    {
      id: 'source-a',
      type: 'external',
      org: 'Organisation A',
      title: 'Reviewed fixture source A',
      url: 'https://example.test/source-a',
      accessed: '2026-08-25',
      verification: 'fetch-verified',
      claimIds: ['claim-a'],
    },
    {
      id: 'source-b',
      type: 'external',
      org: 'Organisation B',
      title: 'Unsafe fixture URL is suppressed',
      url: 'javascript:alert(1)',
      verification: 'source-provided',
      claimIds: ['claim-b'],
    },
  ],
  relatedBiomarkers: [
    {
      key: 'synthetic-insulin',
      displayName: 'Synthetic Insulin',
      relation: 'same-domain',
      canonicalUnit: 'µIU/mL',
      domainKeys: ['metabolic'],
    },
  ],
  usedInCalculators: [
    {
      calculatorSlug: 'synthetic-risk',
      version: 3,
      name: 'Synthetic Risk',
      shortDescription: 'A nonclinical fixture calculator.',
    },
  ],
};

describe('BiomarkerDetail', () => {
  it('keeps conflicting ranges separate and exposes context, provenance, and interlinks', () => {
    render(<BiomarkerDetail biomarker={fixture} />);

    expect(screen.getByRole('heading', { name: 'Sources publish different ranges' })).toBeVisible();
    expect(screen.getByText('≥ 70 and ≤ 99 mg/dL')).toBeVisible();
    expect(screen.getByText('< 105 mg/dL')).toBeVisible();
    expect(screen.getAllByText('Interpretation-only reference')).toHaveLength(2);
    expect(screen.getByText('Sex at birth')).toBeVisible();
    expect(screen.getByText('Specimen')).toBeVisible();
    expect(screen.getByText('Synthetic serum')).toBeVisible();
    expect(screen.getByText('Fixture assay A')).toBeVisible();
    expect(screen.getByLabelText('Reference range caveat')).toHaveTextContent(
      'laboratory, assay, method, population, and individual context',
    );
    expect(screen.getByLabelText('Reference range caveat')).toHaveTextContent(
      'not diagnostic cut-offs or calculator scoring bands',
    );
    expect(screen.getAllByText('Source:')[0]?.closest('p')).toHaveTextContent('Organisation A');

    const sourceADisclosure = screen.getByText('View source provenance for Reviewed interval A');
    fireEvent.click(sourceADisclosure);
    expect(sourceADisclosure.closest('details')).toHaveAttribute('open');

    const sourceALink = screen.getByRole('link', { name: /Open source/ });
    expect(sourceALink).toHaveAttribute('href', 'https://example.test/source-a');
    expect(sourceALink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByText(/Unsafe fixture URL is suppressed/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Open source/ })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Visit evidence source/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'General measurement sources' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /Organisation A: Reviewed fixture source A/ }),
    ).toBeVisible();

    expect(screen.getByRole('link', { name: 'Synthetic Insulin' })).toHaveAttribute(
      'href',
      '/biomarkers/synthetic-insulin',
    );
    expect(screen.getByText(/do not assert a clinical association/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Synthetic Risk' })).toHaveAttribute(
      'href',
      '/c/synthetic-risk',
    );
    expect(screen.queryByText(/averaged range/i)).not.toBeInTheDocument();
  });

  it('renders an explicit lab-specific state when no universal range is available', () => {
    render(
      <BiomarkerDetail
        biomarker={{
          ...fixture,
          definition: { ...fixture.definition, referenceRanges: [] },
          relatedBiomarkers: [],
          usedInCalculators: [],
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No universal reviewed range is published' }),
    ).toBeVisible();
    expect(screen.getByText(/interval printed by your laboratory/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Evidence and sources' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /Organisation A: Reviewed fixture source A/ }),
    ).toBeVisible();
    expect(screen.getByText(/No reviewed related biomarkers/i)).toBeVisible();
    expect(screen.getByText(/No published calculators/i)).toBeVisible();
  });

  it('never treats a source identity as evidence for a claim', () => {
    render(
      <BiomarkerDetail
        biomarker={{
          ...fixture,
          definition: {
            ...fixture.definition,
            referenceRanges: fixture.definition.referenceRanges?.slice(0, 1),
          },
          sources: [
            {
              ...fixture.sources[0]!,
              id: 'claim-a',
              claimIds: undefined,
            },
          ],
          relatedBiomarkers: [],
          usedInCalculators: [],
        }}
      />,
    );

    expect(screen.getByText('No matching public source attribution')).toBeVisible();
    const disclosure = screen.getByText('View source provenance for Reviewed interval A');
    fireEvent.click(disclosure);
    expect(
      screen.getByText('No matching public source record is available for this range.'),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: /Open source/ })).not.toBeInTheDocument();
  });

  it('has no detectable automated accessibility violations', async () => {
    const { container } = render(
      <BiomarkerDetail
        biomarker={{
          ...fixture,
          definition: {
            ...fixture.definition,
            referenceRanges: fixture.definition.referenceRanges?.slice(0, 1),
          },
          relatedBiomarkers: [],
          usedInCalculators: [],
        }}
      />,
    );
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
    expect(within(container).getAllByRole('heading').length).toBeGreaterThan(3);
  });
});
