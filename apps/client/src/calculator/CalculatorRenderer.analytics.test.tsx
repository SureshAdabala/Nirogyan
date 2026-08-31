// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('../analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ enabled: true, track, flush: vi.fn() }),
}));

import {
  CalculatorRenderer,
  isUnprocessableAssessmentError,
  type AssessmentSubmissionLifecycle,
} from './CalculatorRenderer';
import { rendererFixture } from './test-fixture';

afterEach(() => {
  cleanup();
  track.mockClear();
});

describe('CalculatorRenderer analytics boundary', () => {
  it('starts only after interaction and deduplicates the initial step under Strict Mode', async () => {
    render(
      <StrictMode>
        <CalculatorRenderer config={rendererFixture()} storage={null} onSubmit={() => undefined} />
      </StrictMode>,
    );
    expect(track).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Quantity/ }), {
      target: { value: '5' },
    });
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('calc_start', { calculatorSlug: 'renderer-fixture' }),
    );
    expect(track.mock.calls.filter(([type]) => type === 'calc_start')).toHaveLength(1);
    expect(track.mock.calls.filter(([type]) => type === 'step_view')).toEqual([
      ['step_view', { calculatorSlug: 'renderer-fixture', step: 'first', stepIndex: 0 }],
    ]);
  });

  it('classifies only validation responses as assess errors', () => {
    expect(isUnprocessableAssessmentError({ status: 422 })).toBe(true);
    expect(isUnprocessableAssessmentError({ status: 503 })).toBe(false);
    expect(isUnprocessableAssessmentError(new Error('offline'))).toBe(false);
  });

  it('records assessment success once even when the shared-result fetch then fails', async () => {
    const fixture = rendererFixture();
    const config = {
      ...fixture,
      parameters: [],
      uiConfig: {
        ...fixture.uiConfig,
        steps: [{ key: 'first', title: 'First step', parameterGroups: [] }],
      },
    };
    const onSubmit = vi.fn(async (_payload: unknown, lifecycle: AssessmentSubmissionLifecycle) => {
      lifecycle.assessmentSucceeded();
      lifecycle.assessmentSucceeded();
      throw new Error('Shared result fetch failed.');
    });
    render(<CalculatorRenderer config={config} storage={null} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Shared result fetch failed.'),
    );
    expect(track.mock.calls.filter(([type]) => type === 'assess_submit')).toEqual([
      ['assess_submit', { calculatorSlug: 'renderer-fixture' }],
    ]);
  });
});
