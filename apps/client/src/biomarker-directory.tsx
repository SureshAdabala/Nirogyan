'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { publicBiomarkers, type PublicBiomarkerSummary } from './api';
import { useAnalytics } from './analytics/AnalyticsProvider';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function biomarkerName(item: PublicBiomarkerSummary): string {
  return item.displayName || item.key;
}

function biomarkerDescription(item: PublicBiomarkerSummary): string {
  return (
    item.definition.description?.whatItMeasures ??
    item.definition.description?.whyItMatters ??
    (item.releaseState === 'testing-unapproved'
      ? 'Unapproved database measurement draft.'
      : 'Reviewed measurement definition.')
  );
}

function biomarkerLetter(item: PublicBiomarkerSummary): string {
  return biomarkerName(item).trim().charAt(0).toLocaleUpperCase('en-IN');
}

export function humanizeBiomarkerKey(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase('en-IN')}${part.slice(1)}`)
    .join(' ');
}

function updateBrowserQuery(search: string, domain: string, letter: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const values = { search: search.trim(), domain, letter };
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export interface BiomarkerDirectoryProps {
  readonly initialItems: readonly PublicBiomarkerSummary[];
  readonly initialLoadFailed?: boolean;
  readonly initialFilters?: {
    readonly search?: string;
    readonly domain?: string;
    readonly letter?: string;
  };
}

export function BiomarkerDirectory({
  initialItems,
  initialLoadFailed = false,
  initialFilters,
}: Readonly<BiomarkerDirectoryProps>) {
  const [search, setSearch] = useState(initialFilters?.search ?? '');
  const { track } = useAnalytics();
  const trackedSearch = useRef('');
  const [domain, setDomain] = useState(initialFilters?.domain ?? '');
  const normalizedInitialLetter = initialFilters?.letter?.toLocaleUpperCase('en-IN') ?? '';
  const [letter, setLetter] = useState(
    ALPHABET.includes(normalizedInitialLetter) ? normalizedInitialLetter : '',
  );
  const deferredSearch = useDeferredValue(search.trim());
  const hasRemoteFilter = Boolean(deferredSearch || domain);
  const query = useQuery({
    queryKey: ['public-biomarkers', { search: deferredSearch, domain }],
    queryFn: ({ signal }) =>
      publicBiomarkers(
        { search: deferredSearch || undefined, domain: domain || undefined },
        { signal },
      ),
    ...(initialLoadFailed || hasRemoteFilter ? {} : { initialData: initialItems }),
    placeholderData: (previous) => previous,
  });

  useEffect(() => updateBrowserQuery(search, domain, letter), [domain, letter, search]);

  const domains = useMemo(
    () =>
      [...new Set(initialItems.flatMap((item) => item.definition.domainKeys ?? []))].sort((a, b) =>
        a.localeCompare(b, 'en-IN'),
      ),
    [initialItems],
  );
  const availableLetters = useMemo(
    () => new Set(initialItems.map(biomarkerLetter).filter((value) => ALPHABET.includes(value))),
    [initialItems],
  );
  const items = useMemo(() => {
    const records = query.data ?? [];
    return [...records]
      .filter((item) => !letter || biomarkerLetter(item) === letter)
      .sort((left, right) => biomarkerName(left).localeCompare(biomarkerName(right), 'en-IN'));
  }, [letter, query.data]);
  const filtersActive = Boolean(search.trim() || domain || letter);
  const testingCount = items.filter((item) => item.releaseState === 'testing-unapproved').length;

  useEffect(() => {
    if (!deferredSearch || query.isPending || query.isFetching || query.isError) {
      if (!deferredSearch) trackedSearch.current = '';
      return;
    }
    const signature = `${deferredSearch}\u0000${items.length}`;
    const timer = window.setTimeout(() => {
      if (trackedSearch.current === signature) return;
      trackedSearch.current = signature;
      track('search', {
        path: '/biomarkers',
        query: deferredSearch,
        zeroResults: items.length === 0,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, items.length, query.isError, query.isFetching, query.isPending, track]);

  function clearFilters() {
    setSearch('');
    setDomain('');
    setLetter('');
  }

  return (
    <div className="biomarker-directory">
      {testingCount ? (
        <div className="testing-warning" role="note">
          <strong>Testing mode · Unapproved measurements</strong>
          <span>These live database drafts are for functional testing only, not clinical use.</span>
        </div>
      ) : null}
      <div className="biomarker-directory__controls">
        <label className="search-field" htmlFor="biomarker-search">
          <span>Search biomarkers and measurements</span>
          <input
            id="biomarker-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="For example, fasting glucose"
          />
        </label>
        <label className="search-field" htmlFor="biomarker-domain">
          <span>Browse by health domain</span>
          <select
            id="biomarker-domain"
            value={domain}
            onChange={(event) => setDomain(event.currentTarget.value)}
          >
            <option value="">All domains</option>
            {domains.map((key) => (
              <option key={key} value={key}>
                {humanizeBiomarkerKey(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="biomarker-alphabet" aria-label="Browse biomarkers alphabetically">
        <button type="button" aria-pressed={!letter} onClick={() => setLetter('')}>
          All
        </button>
        {ALPHABET.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={letter === value}
            disabled={!availableLetters.has(value)}
            onClick={() => setLetter(value)}
          >
            {value}
          </button>
        ))}
      </nav>

      <div className="biomarker-directory__status-row">
        <p role="status" aria-live="polite">
          {query.isPending
            ? 'Loading biomarkers…'
            : testingCount
              ? `${items.length} ${items.length === 1 ? 'measurement' : 'measurements'} shown · ${testingCount} testing/unapproved.`
              : `${items.length} reviewed ${items.length === 1 ? 'measurement' : 'measurements'} shown.`}
        </p>
        {filtersActive ? (
          <button className="text-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>

      {query.isFetching && !query.isPending ? <p className="muted">Updating results…</p> : null}
      {query.isError ? (
        <div role="alert" className="error-state">
          <h2>Reviewed biomarkers could not be loaded</h2>
          <p>Please check your connection and try again.</p>
          <button className="button" type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : null}
      {!query.isError && items.length ? (
        <div className="card-grid biomarker-card-grid">
          {items.map((item) => (
            <article className="card biomarker-card" key={`${item.key}@${item.revision}`}>
              <p className="eyebrow">
                {item.releaseState === 'testing-unapproved' ? (
                  <span className="testing-badge">Testing · Unapproved</span>
                ) : null}
                {humanizeBiomarkerKey(item.kind)}
                {item.canonicalUnit ? ` · ${item.canonicalUnit}` : ''}
              </p>
              <h2>
                <Link href={`/biomarkers/${encodeURIComponent(item.key)}`}>
                  {biomarkerName(item)}
                </Link>
              </h2>
              <p>{biomarkerDescription(item)}</p>
              <Link className="text-link" href={`/biomarkers/${encodeURIComponent(item.key)}`}>
                View ranges and sources <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : null}
      {!query.isError && !query.isPending && !items.length ? (
        <div className="empty-state" role="status">
          <h2>{filtersActive ? 'No reviewed biomarkers match' : 'No reviewed biomarkers yet'}</h2>
          <p>
            {filtersActive
              ? 'Try another search term, domain, or letter.'
              : 'The library will appear after measurements complete review.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
