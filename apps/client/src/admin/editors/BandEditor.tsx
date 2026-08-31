'use client';

import React, { useState } from 'react';

void React;

import { ConditionBuilder } from './ConditionBuilder';
import {
  finiteNumber,
  bandBoundaryInclusive,
  jsonArray,
  jsonRecord,
  jsonRecordArray,
  nonEmptyString,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  normalizeBandEdges,
  type BandEdges,
  type JsonRecord,
} from '../editor-helpers';

export interface BandEditorProps {
  readonly bands: readonly JsonRecord[];
  readonly onChange: (bands: readonly JsonRecord[]) => void;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly includePoints?: boolean;
  readonly bandEdges?: BandEdges;
}

type BoundaryMode = 'unbounded' | 'inclusive' | 'exclusive';

export function boundaryMode(
  band: JsonRecord,
  side: 'min' | 'max',
  bandEdges: unknown = 'min-inclusive',
): BoundaryMode {
  if (finiteNumber(band[side]) === undefined) return 'unbounded';
  return bandBoundaryInclusive(band, side, bandEdges) ? 'inclusive' : 'exclusive';
}

export function setBoundaryMode(
  band: JsonRecord,
  side: 'min' | 'max',
  mode: BoundaryMode,
): JsonRecord {
  const output = { ...band };
  delete output[`${side}Inclusive`];
  delete output[`${side}Exclusive`];
  if (mode === 'unbounded') {
    delete output[side];
    return output;
  }
  if (finiteNumber(output[side]) === undefined) output[side] = 0;
  output[`${side}${mode === 'inclusive' ? 'Inclusive' : 'Exclusive'}`] = true;
  return output;
}

export function bandBoundaryText(band: JsonRecord, bandEdges: unknown = 'min-inclusive'): string {
  const min = finiteNumber(band.min);
  const max = finiteNumber(band.max);
  const left = min === undefined ? '−∞' : String(min);
  const right = max === undefined ? '+∞' : String(max);
  const leftBracket =
    min === undefined || boundaryMode(band, 'min', bandEdges) === 'exclusive' ? '(' : '[';
  const rightBracket =
    max === undefined || boundaryMode(band, 'max', bandEdges) === 'exclusive' ? ')' : ']';
  return `${leftBracket}${left}, ${right}${rightBracket}`;
}

function sourceNeedsReview(source: JsonRecord): boolean {
  return (
    !nonEmptyString(source.type) || (!nonEmptyString(source.ref) && !nonEmptyString(source.title))
  );
}

function SourceEditor({
  value,
  onChange,
  disabled,
  label,
}: Readonly<{
  value: unknown;
  onChange: (source: JsonRecord | undefined) => void;
  disabled?: boolean;
  label: string;
}>) {
  const source = jsonRecord(value);
  return (
    <fieldset className="studio-source-editor">
      <legend>{label}</legend>
      {sourceNeedsReview(source) ? (
        <p role="alert" className="studio-source-nag">
          Source attribution is required for a medical threshold or rule.
        </p>
      ) : null}
      <label>
        Source type
        <select
          value={typeof source.type === 'string' ? source.type : ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(source, 'type', event.currentTarget.value || undefined))
          }
        >
          <option value="">Choose a source type</option>
          <option value="niro">Niro</option>
          <option value="external">External</option>
          <option value="internal">Internal</option>
          <option value="needs-clarification">Needs clarification</option>
        </select>
      </label>
      <label>
        Source reference
        <input
          value={typeof source.ref === 'string' ? source.ref : ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(source, 'ref', event.currentTarget.value || undefined))
          }
        />
      </label>
      <label>
        Source title
        <input
          value={typeof source.title === 'string' ? source.title : ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(source, 'title', event.currentTarget.value || undefined))
          }
        />
      </label>
      <label>
        Source organization
        <input
          value={typeof source.org === 'string' ? source.org : ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(source, 'org', event.currentTarget.value || undefined))
          }
        />
      </label>
      {Object.keys(source).length ? (
        <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>
          Remove source attribution
        </button>
      ) : null}
    </fieldset>
  );
}

export function BandEditor({
  bands,
  onChange,
  disabled,
  title = 'Score bands',
  includePoints = true,
  bandEdges = 'min-inclusive',
}: Readonly<BandEditorProps>) {
  const effectiveBandEdges = normalizeBandEdges(bandEdges);
  function changeBand(index: number, band: JsonRecord) {
    onChange(replaceArrayItem(bands, index, band).filter(jsonRecordGuard));
  }

  return (
    <section className="studio-band-editor" aria-label={title}>
      <h4>{title}</h4>
      <ol className="studio-band-number-line" aria-label={`${title} number line`}>
        {bands.map((band, index) => (
          <li key={index}>
            <strong>{bandBoundaryText(band, effectiveBandEdges)}</strong>
            {includePoints ? ` → ${String(band.points ?? 'unset')} points` : ''}
          </li>
        ))}
      </ol>
      {bands.map((band, index) => (
        <fieldset key={index} className="studio-band-card">
          <legend>Band {index + 1}</legend>
          {(['min', 'max'] as const).map((side) => {
            const mode = boundaryMode(band, side, effectiveBandEdges);
            return (
              <div key={side}>
                <label>
                  {side === 'min' ? 'Lower boundary type' : 'Upper boundary type'}
                  <select
                    value={mode}
                    disabled={disabled}
                    onChange={(event) =>
                      changeBand(
                        index,
                        setBoundaryMode(band, side, event.currentTarget.value as BoundaryMode),
                      )
                    }
                  >
                    <option value="unbounded">Unbounded</option>
                    <option value="inclusive">Inclusive</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </label>
                {mode !== 'unbounded' ? (
                  <label>
                    {side === 'min' ? 'Lower boundary value' : 'Upper boundary value'}
                    <input
                      type="number"
                      value={typeof band[side] === 'number' ? band[side] : ''}
                      disabled={disabled}
                      onChange={(event) =>
                        changeBand(
                          index,
                          setJsonField(band, side, parseOptionalNumber(event.currentTarget.value)),
                        )
                      }
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          {includePoints ? (
            <label>
              Points
              <input
                type="number"
                value={typeof band.points === 'number' ? band.points : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeBand(
                    index,
                    setJsonField(band, 'points', parseOptionalNumber(event.currentTarget.value)),
                  )
                }
              />
            </label>
          ) : null}
          <label>
            Interpretation
            <textarea
              value={typeof band.interpretation === 'string' ? band.interpretation : ''}
              disabled={disabled}
              onChange={(event) =>
                changeBand(
                  index,
                  setJsonField(band, 'interpretation', event.currentTarget.value || undefined),
                )
              }
            />
          </label>
          <label>
            Clarification IDs (comma separated)
            <input
              value={jsonArray(band.clarificationRefs).join(', ')}
              disabled={disabled}
              onChange={(event) =>
                changeBand(
                  index,
                  setJsonField(
                    band,
                    'clarificationRefs',
                    event.currentTarget.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  ),
                )
              }
            />
          </label>
          <SourceEditor
            label={`Band ${index + 1} source`}
            value={band.source}
            disabled={disabled}
            onChange={(source) => changeBand(index, setJsonField(band, 'source', source))}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(removeArrayItem(bands, index).filter(jsonRecordGuard))}
          >
            Remove band {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...bands, includePoints ? { points: 0 } : {}])}
      >
        Add band
      </button>
    </section>
  );
}

function jsonRecordGuard(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface ContextBandEditorProps {
  readonly contexts: readonly JsonRecord[];
  readonly onChange: (contexts: readonly JsonRecord[]) => void;
  readonly parameterKeys?: readonly string[];
  readonly aggregateKeys?: readonly string[];
  readonly formulaKeys?: readonly string[];
  readonly disabled?: boolean;
  readonly bandEdges?: BandEdges;
}

export function ContextBandEditor({
  contexts,
  onChange,
  parameterKeys = [],
  aggregateKeys = [],
  formulaKeys = [],
  disabled,
  bandEdges = 'min-inclusive',
}: Readonly<ContextBandEditorProps>) {
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, contexts.length - 1));
  const context = contexts[activeIndex];

  function changeContext(next: JsonRecord) {
    onChange(replaceArrayItem(contexts, activeIndex, next).filter(jsonRecordGuard));
  }

  return (
    <section className="studio-context-band-editor" aria-label="Scoring contexts">
      <div role="tablist" aria-label="Scoring context tabs">
        {contexts.map((item, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={activeIndex === index}
            onClick={() => setActive(index)}
          >
            {item.when === null
              ? `Default context ${index + 1}`
              : `Conditional context ${index + 1}`}
          </button>
        ))}
      </div>
      {context ? (
        <div role="tabpanel">
          <ConditionBuilder
            legend={`Context ${activeIndex + 1} condition`}
            value={context.when}
            onChange={(condition) => changeContext(setJsonField(context, 'when', condition))}
            parameterKeys={parameterKeys}
            aggregateKeys={aggregateKeys}
            formulaKeys={formulaKeys}
            disabled={disabled}
          />
          <BandEditor
            title={`Context ${activeIndex + 1} bands`}
            bands={jsonRecordArray(context.bands)}
            onChange={(bands) => changeContext(setJsonField(context, 'bands', bands))}
            disabled={disabled}
            bandEdges={bandEdges}
          />
          <SourceEditor
            label={`Context ${activeIndex + 1} source`}
            value={context.source}
            onChange={(source) => changeContext(setJsonField(context, 'source', source))}
            disabled={disabled}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(removeArrayItem(contexts, activeIndex).filter(jsonRecordGuard))}
          >
            Remove context {activeIndex + 1}
          </button>
        </div>
      ) : (
        <p>No scoring contexts are defined.</p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onChange([...contexts, { when: null, bands: [] }]);
          setActive(contexts.length);
        }}
      >
        Add scoring context
      </button>
    </section>
  );
}

export { SourceEditor };
