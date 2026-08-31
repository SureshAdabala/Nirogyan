// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResultRenderer, humanizeResultIdentifier } from './ResultRenderer';
import type { ResultPresentation, ResultProjection } from './types';

const presentation: ResultPresentation = {
  calculatorSlug: 'synthetic-assessment',
  calculatorVersion: 3,
  calculatorName: 'Synthetic assessment',
  summary: 'A reviewed synthetic assessment summary.',
  disclaimers: ['Educational test fixture only.', 'Consult a qualified professional.'],
  layout: [
    'score-gauge',
    'category',
    'key-contributors',
    'domain-breakdown',
    'biomarker-details',
    'recommendations',
  ],
  scoreDisplay: {
    min: 0,
    max: 100,
    direction: 'higher-is-worse',
    displayDecimals: 1,
  },
  parameters: [
    {
      key: 'hdlValue',
      label: 'HDL cholesterol',
      biomarkerKey: 'hdl-cholesterol',
      kind: 'measurement',
    },
    { key: 'activityLevel', label: 'Activity level', kind: 'questionnaire' },
    { key: 'familyHistory', label: 'Family history', kind: 'questionnaire' },
  ],
  domains: [{ key: 'heartHealth', label: 'Heart health' }],
};

const projection: ResultProjection = {
  score: 27.25,
  category: {
    label: 'Review recommended',
    color: '#A52A2A',
    message: 'Review this educational result with a clinician.',
    recommendation: 'Discuss any concerns with a qualified healthcare professional.',
  },
  parameters: [
    {
      key: 'hdlValue',
      value: 42,
      canonicalUnit: 'mg/dL',
      missing: false,
      applicable: true,
      status: 'scored',
    },
    {
      key: 'activityLevel',
      value: 'regular',
      missing: false,
      applicable: true,
      status: 'scored',
    },
    {
      key: 'familyHistory',
      missing: true,
      applicable: true,
      status: 'excluded',
    },
  ],
  domains: [
    {
      key: 'heartHealth',
      score: 31.5,
      scoredCount: 2,
      missingCount: 1,
      applicableCount: 3,
      coverage: 2 / 3,
      status: 'scored',
    },
  ],
  coverage: {
    scoredParameterCount: 2,
    applicableScoredParameterCount: 3,
    parameterCoverage: 2 / 3,
    domainCoverage: 1,
  },
  contributors: {
    harmful: [{ key: 'familyHistory' }],
    protective: [{ key: 'activityLevel' }],
  },
  warnings: ['One optional value was omitted.'],
};

afterEach(cleanup);

describe('ResultRenderer', () => {
  it('honours layout order and renders accessible, scoring-safe result detail', async () => {
    const { container } = render(
      <ResultRenderer projection={projection} presentation={presentation} />,
    );

    const orderedHeadings = [...container.querySelectorAll('.result-block > h3')].map(
      (heading) => heading.textContent,
    );
    expect(orderedHeadings).toEqual([
      'Result',
      'Category',
      'Why this result',
      'Domain details',
      'Biomarker and input details',
      'Recommendations',
    ]);
    expect(container.querySelector('.result-score-value')).toHaveTextContent('27.3');
    expect(screen.getByRole('meter')).toHaveAttribute('min', '0');
    expect(
      screen.getByText(/higher scores indicate a less favourable result/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Factors increasing the score' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Protective factors' })).toBeInTheDocument();
    expect(screen.getByText('Heart health')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn about HDL cholesterol' })).toHaveAttribute(
      'href',
      '/biomarkers/hdl-cholesterol',
    );
    expect(screen.getByText(/used 2 of 3 applicable inputs/i)).toBeInTheDocument();
    expect(screen.getByText(/measured laboratory inputs: 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByText(/questionnaire and context inputs: 1 of 2/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/confidence/i);
    expect(JSON.stringify(projection)).not.toMatch(
      /formula|trace|possiblePoints|earnedPoints|weight/i,
    );
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it('does not infer a positioned gauge when no safe display scale exists', () => {
    render(
      <ResultRenderer
        projection={{ score: 7, category: { label: 'Available' } }}
        presentation={{ layout: ['score-gauge', 'category'] }}
      />,
    );
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('keeps an unapproved testing warning attached to rendered and shared results', () => {
    render(
      <ResultRenderer
        projection={{ score: 7 }}
        presentation={{ layout: ['score-gauge'], releaseState: 'testing-unapproved' }}
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('Testing result · Unapproved calculator');
    expect(screen.getByRole('note')).toHaveTextContent('must not guide clinical decisions');
  });

  it('renders a complete shared-result presentation once by default and supports page ownership', () => {
    const { rerender } = render(
      <ResultRenderer projection={{ score: 7 }} presentation={presentation} />,
    );

    expect(screen.getAllByText('A reviewed synthetic assessment summary.')).toHaveLength(1);
    expect(screen.getAllByText('Educational test fixture only.')).toHaveLength(1);
    expect(screen.getAllByText('Consult a qualified professional.')).toHaveLength(1);
    expect(screen.getAllByLabelText('Calculator disclaimers')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Important information' })).toHaveLength(1);

    rerender(
      <ResultRenderer
        projection={{ score: 7 }}
        presentation={presentation}
        renderSummary={false}
        renderDisclaimers={false}
      />,
    );

    expect(screen.queryByText('A reviewed synthetic assessment summary.')).not.toBeInTheDocument();
    expect(screen.queryByText('Educational test fixture only.')).not.toBeInTheDocument();
    expect(screen.queryByText('Consult a qualified professional.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Important information' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['higher-is-worse', 'Higher scores indicate a less favourable result.'],
    ['lower-is-worse', 'Lower scores indicate a less favourable result.'],
    ['higher-is-better', 'Higher scores indicate a more favourable result.'],
    ['lower-is-better', 'Lower scores indicate a more favourable result.'],
  ] as const)('describes the locked %s score direction without inference', (direction, copy) => {
    render(
      <ResultRenderer
        projection={{ score: 5 }}
        presentation={{
          layout: ['score-gauge'],
          scoreDisplay: { min: 0, max: 10, direction },
        }}
      />,
    );

    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it('copies a capability link and provides an accessible manual fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onShareCopy = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { rerender } = render(
      <ResultRenderer
        projection={{ score: 1 }}
        presentation={{ layout: ['score-gauge'] }}
        shareUrl="https://example.test/results/random-capability"
        onShareCopy={onShareCopy}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://example.test/results/random-capability'),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Share link copied');
    expect(onShareCopy).toHaveBeenCalledTimes(1);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    rerender(
      <ResultRenderer
        projection={{ score: 1 }}
        presentation={{ layout: ['score-gauge'] }}
        shareUrl="https://example.test/results/random-capability"
        onShareCopy={onShareCopy}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/select and copy/i));
    expect(screen.getByLabelText('Temporary share link')).toHaveFocus();
    expect(onShareCopy).toHaveBeenCalledTimes(1);
  });

  it('keeps the result visible while an explicitly consented, feature-gated lead submits', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onRetake = vi.fn();
    const { container } = render(
      <ResultRenderer
        projection={projection}
        presentation={presentation}
        onRetake={onRetake}
        leadCapture={{
          enabled: true,
          consentText: 'I agree to receive the described educational emails.',
          consentVersion: 'education-email-v1',
          onSubmit,
        }}
      />,
    );

    expect(container.querySelector('.result-score-value')).toHaveTextContent('27.3');
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: ' Reader@Example.Test ' },
    });
    fireEvent.click(screen.getByLabelText('I agree to receive the described educational emails.'));
    fireEvent.submit(screen.getByRole('button', { name: 'Submit email' }).closest('form')!);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'reader@example.test',
        consentVersion: 'education-email-v1',
      }),
    );
    expect(await screen.findByText(/email preference was saved/i)).toBeInTheDocument();
    expect(container.querySelector('.result-score-value')).toHaveTextContent('27.3');

    fireEvent.click(screen.getByRole('button', { name: 'Retake calculator' }));
    expect(onRetake).toHaveBeenCalledOnce();
  });

  it('does not render lead capture when its feature gate is disabled', () => {
    render(
      <ResultRenderer
        projection={{ score: 1 }}
        presentation={{ layout: ['score-gauge'] }}
        leadCapture={{
          enabled: false,
          consentText: 'Explicit consent text',
          consentVersion: 'v1',
          onSubmit: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });

  it('humanizes safe legacy identifiers without calculator-specific mappings', () => {
    expect(humanizeResultIdentifier('familyHistory')).toBe('Family History');
    expect(humanizeResultIdentifier('hdl')).toBe('HDL');
    expect(humanizeResultIdentifier('heart-health')).toBe('Heart Health');
  });
});
