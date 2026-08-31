'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { publicCalculators, type PublicCalculatorSummary } from './api';
import { useAnalytics } from './analytics/AnalyticsProvider';

export function CalculatorDirectory({
  initialItems,
  initialLoadFailed = false,
}: Readonly<{
  initialItems: readonly PublicCalculatorSummary[];
  initialLoadFailed?: boolean;
}>) {
  const [search, setSearch] = useState('');
  const { track } = useAnalytics();
  const trackedSearch = useRef('');
  const query = useQuery({
    queryKey: ['public-calculators'],
    queryFn: () => publicCalculators(),
    ...(initialLoadFailed ? {} : { initialData: initialItems }),
  });
  const items = useMemo(() => {
    const records = query.data ?? [];
    const needle = search.trim().toLocaleLowerCase('en-IN');
    if (!needle) return records;
    return records.filter((item) =>
      `${item.name ?? ''} ${item.shortDescription ?? ''} ${item.calculatorSlug}`
        .toLocaleLowerCase('en-IN')
        .includes(needle),
    );
  }, [query.data, search]);
  const hasTestingRecords = items.some((item) => item.releaseState === 'testing-unapproved');

  useEffect(() => {
    const normalized = search.trim();
    if (!normalized) {
      trackedSearch.current = '';
      return;
    }
    const signature = `${normalized}\u0000${items.length}`;
    const timer = window.setTimeout(() => {
      if (trackedSearch.current === signature) return;
      trackedSearch.current = signature;
      track('search', { path: '/', query: normalized, zeroResults: items.length === 0 });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [items.length, search, track]);

  return (
    <div>
      <label className="search-field" htmlFor="calculator-search">
        <span>Search calculators</span>
        <input
          id="calculator-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or topic"
        />
      </label>
      {hasTestingRecords ? (
        <div className="testing-warning" role="note">
          <strong>Testing mode · Unapproved calculators</strong>
          <span>These database records are for functional testing only, not clinical use.</span>
        </div>
      ) : null}
      {query.isError ? (
        <div role="alert" className="error-state">
          <h3>Calculators could not be loaded</h3>
          <p>
            {initialItems.length
              ? 'The server-rendered list remains available below.'
              : 'Check the API connection and try again.'}
          </p>
          {!initialItems.length ? (
            <button className="button" type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
      {items.length ? (
        <div className="card-grid" aria-live="polite">
          {items.map((item) => (
            <article
              className="card calculator-card"
              key={`${item.calculatorSlug}@${item.version}`}
            >
              <p className="eyebrow">
                {item.releaseState === 'testing-unapproved' ? (
                  <span className="testing-badge">Testing · Unapproved</span>
                ) : null}
                Version {item.version}
              </p>
              <h3>
                <Link href={`/c/${encodeURIComponent(item.calculatorSlug)}`}>
                  {item.name ?? item.calculatorSlug}
                </Link>
              </h3>
              <p>{item.shortDescription ?? 'A contract-driven health assessment.'}</p>
              <Link className="text-link" href={`/c/${encodeURIComponent(item.calculatorSlug)}`}>
                Open calculator <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : !query.isError && !query.isPending ? (
        <div className="empty-state" role="status">
          <h3>
            {search ? 'No calculators match that search' : 'No calculators are published yet'}
          </h3>
          <p>{search ? 'Try a shorter or different term.' : 'Please check back later.'}</p>
        </div>
      ) : null}
    </div>
  );
}
