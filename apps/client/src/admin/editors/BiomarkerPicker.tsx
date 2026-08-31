'use client';

import React, { useMemo, useState } from 'react';

void React;

import { jsonRecord, nonEmptyString, type JsonRecord } from '../editor-helpers';

export interface BiomarkerPickerProps {
  readonly biomarkers: readonly JsonRecord[];
  readonly onSelect: (biomarker: JsonRecord) => void;
  readonly disabled?: boolean;
  readonly selectedKey?: string;
}

function displayName(biomarker: JsonRecord): string {
  return (
    nonEmptyString(biomarker.displayName) ??
    nonEmptyString(jsonRecord(biomarker.definition).displayName) ??
    nonEmptyString(biomarker.key) ??
    'Unnamed measurement'
  );
}

export function BiomarkerPicker({
  biomarkers,
  onSelect,
  disabled,
  selectedKey,
}: Readonly<BiomarkerPickerProps>) {
  const [search, setSearch] = useState('');
  const normalized = search.trim().toLocaleLowerCase('en-IN');
  const filtered = useMemo(
    () =>
      [...biomarkers]
        .filter((biomarker) => {
          if (!normalized) return true;
          const definition = jsonRecord(biomarker.definition);
          const aliases = Array.isArray(definition.aliases) ? definition.aliases.join(' ') : '';
          return `${displayName(biomarker)} ${String(biomarker.key ?? '')} ${aliases}`
            .toLocaleLowerCase('en-IN')
            .includes(normalized);
        })
        .sort((left, right) => displayName(left).localeCompare(displayName(right), 'en-IN')),
    [biomarkers, normalized],
  );

  return (
    <section className="studio-biomarker-picker" aria-labelledby="studio-biomarker-picker-title">
      <h4 id="studio-biomarker-picker-title">Central biomarker library</h4>
      <p>
        Prefill copies canonical authoring hints only. Reference ranges, scoring bands and migration
        provenance are never copied.
      </p>
      <label>
        Search measurements
        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </label>
      <ul className="studio-biomarker-picker__results">
        {filtered.map((biomarker, index) => {
          const key = nonEmptyString(biomarker.key) ?? `measurement-${index}`;
          const status = nonEmptyString(biomarker.status) ?? 'unknown';
          const revision = typeof biomarker.revision === 'number' ? biomarker.revision : undefined;
          const blockers = jsonRecord(jsonRecord(biomarker.definition).governance).publishBlockers;
          const blockerCount = Array.isArray(blockers) ? blockers.length : 0;
          return (
            <li key={`${key}@${revision ?? 'unknown'}`}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selectedKey === key}
                onClick={() => onSelect(biomarker)}
              >
                {displayName(biomarker)}
              </button>{' '}
              <span>
                {key} · revision {revision ?? 'unknown'} · {status}
                {blockerCount ? ` · ${blockerCount} publish blockers` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      {!filtered.length ? <p role="status">No measurements match this search.</p> : null}
    </section>
  );
}
