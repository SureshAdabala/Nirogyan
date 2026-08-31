'use client';

import React from 'react';

void React;

import { bandBoundaryText, boundaryMode, setBoundaryMode } from './BandEditor';
import {
  jsonRecord,
  jsonRecordArray,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  summarizeCategoryCoverage,
  normalizeBandEdges,
  type JsonRecord,
} from '../editor-helpers';

export interface CategoryEditorProps {
  readonly draft: JsonRecord;
  readonly onChange: (draft: JsonRecord) => void;
  readonly disabled?: boolean;
}

function recordGuard(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function CategoryEditor({ draft, onChange, disabled }: Readonly<CategoryEditorProps>) {
  const categories = jsonRecord(draft.resultCategories);
  const scale = jsonRecord(categories.scale);
  const bands = jsonRecordArray(categories.bands);
  const bandEdges = normalizeBandEdges(categories.bandEdges);
  const coverage = summarizeCategoryCoverage(scale, bands, bandEdges);

  function setCategories(next: JsonRecord) {
    onChange(setJsonField(draft, 'resultCategories', next));
  }

  function setScaleField(key: string, value: unknown) {
    setCategories(setJsonField(categories, 'scale', setJsonField(scale, key, value)));
  }

  function setBands(next: readonly JsonRecord[]) {
    setCategories(setJsonField(categories, 'bands', next));
  }

  function changeBand(index: number, band: JsonRecord) {
    setBands(replaceArrayItem(bands, index, band).filter(recordGuard));
  }

  return (
    <section className="studio-category-editor" aria-labelledby="studio-category-editor-title">
      <h3 id="studio-category-editor-title">Result categories</h3>
      <label>
        Default edge semantics
        <select
          value={typeof categories.bandEdges === 'string' ? categories.bandEdges : ''}
          disabled={disabled}
          onChange={(event) =>
            setCategories(
              setJsonField(categories, 'bandEdges', event.currentTarget.value || undefined),
            )
          }
        >
          <option value="">Choose semantics</option>
          <option value="min-inclusive">Minimum inclusive [min, max)</option>
          <option value="explicit">Explicit per-bound flags</option>
        </select>
      </label>
      <fieldset>
        <legend>Score scale</legend>
        <label>
          Minimum
          <input
            type="number"
            value={typeof scale.min === 'number' ? scale.min : ''}
            disabled={disabled}
            onChange={(event) =>
              setScaleField('min', parseOptionalNumber(event.currentTarget.value))
            }
          />
        </label>
        <label>
          Maximum
          <input
            type="number"
            value={typeof scale.max === 'number' ? scale.max : ''}
            disabled={disabled}
            onChange={(event) =>
              setScaleField('max', parseOptionalNumber(event.currentTarget.value))
            }
          />
        </label>
        <label>
          Direction
          <select
            value={typeof scale.direction === 'string' ? scale.direction : ''}
            disabled={disabled}
            onChange={(event) => setScaleField('direction', event.currentTarget.value || undefined)}
          >
            <option value="">Choose direction</option>
            <option value="higher-is-worse">Higher is worse</option>
            <option value="lower-is-worse">Lower is worse</option>
            <option value="higher-is-better">Higher is better</option>
            <option value="lower-is-better">Lower is better</option>
          </select>
        </label>
        <label>
          Unit
          <input
            value={typeof scale.unit === 'string' ? scale.unit : ''}
            disabled={disabled}
            onChange={(event) => setScaleField('unit', event.currentTarget.value || undefined)}
          />
        </label>
        <label>
          Display decimal places
          <input
            type="number"
            min="0"
            max="6"
            value={typeof scale.displayDecimals === 'number' ? scale.displayDecimals : ''}
            disabled={disabled}
            onChange={(event) =>
              setScaleField('displayDecimals', parseOptionalNumber(event.currentTarget.value))
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={scale.clamp === true}
            disabled={disabled}
            onChange={(event) => setScaleField('clamp', event.currentTarget.checked || undefined)}
          />
          Explicitly clamp score to scale
        </label>
      </fieldset>

      <section aria-label="Category coverage">
        <h4>Coverage</h4>
        {coverage.complete ? (
          <p role="status">Category bands cover the scale without detected gaps or overlaps.</p>
        ) : (
          <div role="alert">
            {coverage.gaps.map((finding) => (
              <p key={`gap-${finding}`}>Gap: {finding}</p>
            ))}
            {coverage.overlaps.map((finding) => (
              <p key={`overlap-${finding}`}>Overlap: {finding}</p>
            ))}
          </div>
        )}
      </section>

      <ol aria-label="Category bands number line" className="studio-band-number-line">
        {bands.map((band, index) => (
          <li key={`${String(band.label ?? 'category')}-boundary-${index}`}>
            <strong>{bandBoundaryText(band, bandEdges)}</strong>
            {` → ${String(band.label ?? 'unnamed category')}`}
          </li>
        ))}
      </ol>

      {bands.map((band, index) => (
        <fieldset key={`${String(band.label ?? 'category')}-${index}`}>
          <legend>Category {index + 1}</legend>
          <label>
            Label
            <input
              value={typeof band.label === 'string' ? band.label : ''}
              disabled={disabled}
              onChange={(event) =>
                changeBand(index, setJsonField(band, 'label', event.currentTarget.value))
              }
            />
          </label>
          <label>
            Color
            <input
              value={typeof band.color === 'string' ? band.color : ''}
              disabled={disabled}
              onChange={(event) =>
                changeBand(index, setJsonField(band, 'color', event.currentTarget.value))
              }
            />
          </label>
          {(['min', 'max'] as const).map((side) => {
            const effectiveMode = boundaryMode(band, side, bandEdges);
            return (
              <div key={side}>
                <label>
                  {side === 'min' ? 'Lower boundary type' : 'Upper boundary type'}
                  <select
                    value={effectiveMode}
                    disabled={disabled}
                    onChange={(event) =>
                      changeBand(
                        index,
                        setBoundaryMode(
                          band,
                          side,
                          event.currentTarget.value as 'unbounded' | 'inclusive' | 'exclusive',
                        ),
                      )
                    }
                  >
                    <option value="unbounded">Unbounded</option>
                    <option value="inclusive">Inclusive</option>
                    <option value="exclusive">Exclusive</option>
                  </select>
                </label>
                {effectiveMode !== 'unbounded' ? (
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
          {(['message', 'recommendation'] as const).map((key) => (
            <label key={key}>
              {key === 'message' ? 'Message' : 'Recommendation'}
              <textarea
                value={typeof band[key] === 'string' ? band[key] : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeBand(index, setJsonField(band, key, event.currentTarget.value || undefined))
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setBands(removeArrayItem(bands, index).filter(recordGuard))}
          >
            Remove category {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setBands([...bands, { label: '', color: '' }])}
      >
        Add category
      </button>
    </section>
  );
}
