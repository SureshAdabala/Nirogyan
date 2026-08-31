// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PublicBiomarkerSummary } from '@niro/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import React, { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicBiomarkers } from './api';
import { BiomarkerDirectory } from './biomarker-directory';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, publicBiomarkers: vi.fn() };
});

const records: readonly PublicBiomarkerSummary[] = [
  {
    key: 'alpha-marker',
    revision: 1,
    displayName: 'Alpha Marker',
    kind: 'laboratory-biomarker',
    canonicalUnit: 'mg/L',
    definition: {
      aliases: ['First marker'],
      domainKeys: ['metabolic'],
      description: { whatItMeasures: 'The alpha fixture measurement.' },
    },
    sources: [],
  },
  {
    key: 'beta-marker',
    revision: 1,
    displayName: 'Beta Marker',
    kind: 'laboratory-biomarker',
    canonicalUnit: 'mg/L',
    definition: {
      domainKeys: ['thyroid'],
      description: { whatItMeasures: 'The beta fixture measurement.' },
    },
    sources: [],
  },
  {
    key: 'glucose-marker',
    revision: 2,
    displayName: 'Glucose Marker',
    kind: 'laboratory-biomarker',
    canonicalUnit: 'mg/dL',
    definition: {
      aliases: ['Fasting glucose'],
      domainKeys: ['metabolic'],
      description: { whatItMeasures: 'The glucose fixture measurement.' },
    },
    sources: [],
  },
];

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDirectory(props?: {
  readonly initialLoadFailed?: boolean;
  readonly initialItems?: readonly PublicBiomarkerSummary[];
}) {
  return render(
    <BiomarkerDirectory
      initialItems={props?.initialItems ?? records}
      initialLoadFailed={props?.initialLoadFailed}
    />,
    { wrapper: Wrapper },
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('BiomarkerDirectory', () => {
  it('composes A–Z, domain, and alias search filters with canonical detail links', async () => {
    vi.mocked(publicBiomarkers).mockImplementation(async (query) => {
      const searchValue = query?.search;
      const domainValue = query?.domain;
      const needle = searchValue?.toLocaleLowerCase('en-IN');
      return records.filter((record) => {
        const domainMatch =
          !domainValue || record.definition.domainKeys?.includes(domainValue) === true;
        const text =
          `${record.displayName} ${record.key} ${(record.definition.aliases ?? []).join(' ')}`.toLocaleLowerCase(
            'en-IN',
          );
        return Boolean(domainMatch && (!needle || text.includes(needle)));
      });
    });
    const user = userEvent.setup();
    renderDirectory();

    expect(screen.getByRole('status')).toHaveTextContent('3 reviewed measurements shown');
    expect(screen.getByRole('link', { name: 'Alpha Marker' })).toHaveAttribute(
      'href',
      '/biomarkers/alpha-marker',
    );
    expect(screen.getByRole('button', { name: 'C' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('heading', { name: 'Beta Marker' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Alpha Marker' })).not.toBeInTheDocument();
    expect(window.location.search).toContain('letter=B');

    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.selectOptions(screen.getByLabelText('Browse by health domain'), 'metabolic');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2 reviewed measurements'),
    );
    expect(vi.mocked(publicBiomarkers)).toHaveBeenCalledWith(
      { domain: 'metabolic', search: undefined },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const search = screen.getByRole('searchbox', { name: 'Search biomarkers and measurements' });
    await user.type(search, 'fasting glucose');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Glucose Marker' })).toBeVisible(),
    );
    expect(screen.queryByRole('heading', { name: 'Alpha Marker' })).not.toBeInTheDocument();
    expect(window.location.search).toContain('search=fasting+glucose');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('3 reviewed measurements'),
    );
    expect(window.location.search).toBe('');
  });

  it('distinguishes an initial service failure from a genuinely empty library', async () => {
    vi.mocked(publicBiomarkers).mockRejectedValue(new Error('offline'));
    renderDirectory({ initialLoadFailed: true });
    expect(
      await screen.findByRole('heading', { name: 'Reviewed biomarkers could not be loaded' }),
    ).toBeVisible();
    expect(screen.queryByText('No reviewed biomarkers yet')).not.toBeInTheDocument();
  });

  it('labels API-tagged testing records without describing them as reviewed', () => {
    const testingRecord: PublicBiomarkerSummary = {
      ...records[0]!,
      releaseState: 'testing-unapproved',
    };
    renderDirectory({ initialItems: [testingRecord] });
    expect(screen.getByRole('note')).toHaveTextContent('Testing mode · Unapproved measurements');
    expect(screen.getByText('Testing · Unapproved')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 measurement shown · 1 testing/unapproved',
    );
    expect(screen.getByRole('link', { name: 'Alpha Marker' })).toHaveAttribute(
      'href',
      '/biomarkers/alpha-marker',
    );
  });

  it('reports a no-match state and has no detectable automated accessibility violations', async () => {
    vi.mocked(publicBiomarkers).mockResolvedValue([]);
    const user = userEvent.setup();
    const { container } = renderDirectory();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search biomarkers and measurements' }),
      'no matching marker',
    );
    expect(
      await screen.findByRole('heading', { name: 'No reviewed biomarkers match' }),
    ).toBeVisible();
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
});
