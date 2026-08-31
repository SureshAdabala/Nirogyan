'use client';

import React from 'react';

void React;

import {
  jsonArray,
  jsonRecordArray,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  summarizeDomainAssignments,
  summarizeDomainWeights,
  type JsonRecord,
} from '../editor-helpers';

export interface DomainEditorProps {
  readonly draft: JsonRecord;
  readonly onChange: (draft: JsonRecord) => void;
  readonly disabled?: boolean;
}

function recordGuard(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function percentValue(weight: unknown): string | number {
  return typeof weight === 'number' && Number.isFinite(weight) ? weight * 100 : '';
}

export function DomainEditor({ draft, onChange, disabled }: Readonly<DomainEditorProps>) {
  const parameters = jsonRecordArray(draft.parameters);
  const domains = jsonRecordArray(draft.domains);
  const parameterKeys = parameters
    .map((parameter) => parameter.key)
    .filter((key): key is string => typeof key === 'string');
  const aggregateKeys = jsonRecordArray(draft.parameterGroupsAggregation)
    .map((aggregate) => aggregate.key)
    .filter((key): key is string => typeof key === 'string');
  const weightSummary = summarizeDomainWeights(domains);
  const assignments = summarizeDomainAssignments(parameters, domains);

  function setDomains(next: readonly JsonRecord[]) {
    onChange(setJsonField(draft, 'domains', next));
  }

  function changeDomain(index: number, domain: JsonRecord) {
    setDomains(replaceArrayItem(domains, index, domain).filter(recordGuard));
  }

  return (
    <section className="studio-domain-editor" aria-labelledby="studio-domain-editor-title">
      <h3 id="studio-domain-editor-title">Domains and weights</h3>
      <div className="studio-weight-meter">
        <label htmlFor="studio-domain-weight-meter">
          Domain weights: {weightSummary.percent.toFixed(6).replace(/\.0+$/, '')}%
        </label>
        <meter
          id="studio-domain-weight-meter"
          min={0}
          max={100}
          value={Math.max(0, Math.min(weightSummary.percent, 100))}
        />
        {!weightSummary.exact ? (
          <p role="alert">
            Publication is blocked: stored domain weights must sum exactly to 1.0 (displayed as
            100%). Current stored sum: {weightSummary.total}.
          </p>
        ) : (
          <p role="status">Domain weights sum exactly to 1.0.</p>
        )}
      </div>
      {assignments.unassigned.length ? (
        <p role="alert">Unassigned parameters: {assignments.unassigned.join(', ')}.</p>
      ) : null}
      {assignments.multiplyAssigned.length ? (
        <p role="alert">
          Parameters assigned to multiple domains: {assignments.multiplyAssigned.join(', ')}.
        </p>
      ) : null}

      {domains.map((domain, index) => {
        const assigned = new Set(
          jsonArray(domain.parameterKeys).filter((key): key is string => typeof key === 'string'),
        );
        const assignedAggregates = new Set(
          jsonArray(domain.aggregateKeys).filter((key): key is string => typeof key === 'string'),
        );
        return (
          <fieldset key={`${String(domain.key ?? 'domain')}-${index}`}>
            <legend>Domain {index + 1}</legend>
            <label>
              Key
              <input
                value={typeof domain.key === 'string' ? domain.key : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeDomain(index, setJsonField(domain, 'key', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Label
              <input
                value={typeof domain.label === 'string' ? domain.label : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeDomain(index, setJsonField(domain, 'label', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Weight (percent)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentValue(domain.weight)}
                disabled={disabled}
                onChange={(event) => {
                  const percent = parseOptionalNumber(event.currentTarget.value);
                  changeDomain(
                    index,
                    setJsonField(
                      domain,
                      'weight',
                      percent === undefined ? undefined : percent / 100,
                    ),
                  );
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={domain.implicit === true}
                disabled={disabled}
                onChange={(event) =>
                  changeDomain(
                    index,
                    setJsonField(domain, 'implicit', event.currentTarget.checked || undefined),
                  )
                }
              />
              Implicit domain
            </label>
            <fieldset>
              <legend>Assigned parameters</legend>
              {parameterKeys.map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={assigned.has(key)}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = new Set(assigned);
                      if (event.currentTarget.checked) next.add(key);
                      else next.delete(key);
                      changeDomain(index, setJsonField(domain, 'parameterKeys', [...next]));
                    }}
                  />
                  {key}
                </label>
              ))}
            </fieldset>
            {aggregateKeys.length ? (
              <fieldset>
                <legend>Assigned aggregates</legend>
                {aggregateKeys.map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={assignedAggregates.has(key)}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = new Set(assignedAggregates);
                        if (event.currentTarget.checked) next.add(key);
                        else next.delete(key);
                        changeDomain(index, setJsonField(domain, 'aggregateKeys', [...next]));
                      }}
                    />
                    {key}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => setDomains(removeArrayItem(domains, index).filter(recordGuard))}
            >
              Remove domain {index + 1}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          setDomains([...domains, { key: '', label: '', weight: 0, parameterKeys: [] }])
        }
      >
        Add domain
      </button>
    </section>
  );
}
