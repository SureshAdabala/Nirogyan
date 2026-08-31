// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicCalculatorSummary } from '@niro/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicCalculators } from './api';
import { CalculatorDirectory } from './directory';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, publicCalculators: vi.fn() };
});

vi.mock('./analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const testingRecord: PublicCalculatorSummary = {
  slug: 'live-database-calculator',
  calculatorSlug: 'live-database-calculator',
  version: 3,
  releaseState: 'testing-unapproved',
  name: 'Live database calculator',
  shortDescription: 'Loaded from the API.',
};

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CalculatorDirectory', () => {
  it('labels an API-tagged testing record and preserves its dynamic route', () => {
    render(<CalculatorDirectory initialItems={[testingRecord]} />, { wrapper: Wrapper });
    expect(screen.getByRole('note')).toHaveTextContent('Testing mode · Unapproved calculators');
    expect(screen.getByText('Testing · Unapproved')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Live database calculator' })).toHaveAttribute(
      'href',
      '/c/live-database-calculator',
    );
  });

  it('reports an initial API failure instead of presenting an empty catalog', async () => {
    vi.mocked(publicCalculators).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<CalculatorDirectory initialItems={[]} initialLoadFailed />, { wrapper: Wrapper });
    expect(
      await screen.findByRole('heading', { name: 'Calculators could not be loaded' }),
    ).toBeVisible();
    expect(screen.queryByText('No calculators are published yet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(publicCalculators).toHaveBeenCalled();
  });
});
