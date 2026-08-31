'use client';

import React from 'react';

void React;

import { BandEditor, ContextBandEditor, SourceEditor } from './BandEditor';
import {
  jsonArray,
  jsonRecordArray,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  type JsonRecord,
} from '../editor-helpers';

export interface OptionPointEditorProps {
  readonly values: readonly JsonRecord[];
  readonly onChange: (values: readonly JsonRecord[]) => void;
  readonly disabled?: boolean;
  readonly title?: string;
}

function recordGuard(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function OptionPointEditor({
  values,
  onChange,
  disabled,
  title = 'Option points',
}: Readonly<OptionPointEditorProps>) {
  function change(index: number, next: JsonRecord) {
    onChange(replaceArrayItem(values, index, next).filter(recordGuard));
  }
  return (
    <section aria-label={title} className="studio-option-points">
      <h4>{title}</h4>
      {values.map((item, index) => (
        <fieldset key={index}>
          <legend>Option point {index + 1}</legend>
          <label>
            Option value
            <input
              value={String(item.value ?? '')}
              disabled={disabled}
              onChange={(event) =>
                change(index, setJsonField(item, 'value', event.currentTarget.value))
              }
            />
          </label>
          <label>
            Points
            <input
              type="number"
              value={typeof item.points === 'number' ? item.points : ''}
              disabled={disabled}
              onChange={(event) =>
                change(
                  index,
                  setJsonField(item, 'points', parseOptionalNumber(event.currentTarget.value)),
                )
              }
            />
          </label>
          <SourceEditor
            label={`Option point ${index + 1} source`}
            value={item.source}
            disabled={disabled}
            onChange={(source) => change(index, setJsonField(item, 'source', source))}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(removeArrayItem(values, index).filter(recordGuard))}
          >
            Remove option point {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...values, { value: '', points: 0 }])}
      >
        Add option point
      </button>
    </section>
  );
}

export interface ScoringEditorProps {
  readonly draft: JsonRecord;
  readonly onChange: (draft: JsonRecord) => void;
  readonly disabled?: boolean;
}

export function ScoringEditor({ draft, onChange, disabled }: Readonly<ScoringEditorProps>) {
  const parameters = jsonRecordArray(draft.parameters);
  const parameterKeys = parameters
    .map((parameter) => parameter.key)
    .filter((key): key is string => typeof key === 'string');
  const aggregateKeys = jsonRecordArray(draft.parameterGroupsAggregation)
    .map((aggregate) => aggregate.key)
    .filter((key): key is string => typeof key === 'string');
  const formulaKeys = jsonRecordArray(draft.formulas)
    .map((formula) => formula.key)
    .filter((key): key is string => typeof key === 'string');
  const scoringRules = jsonRecordArray(draft.scoringRules);
  const adjustments = jsonRecordArray(draft.adjustmentRules);

  function setRules(rules: readonly JsonRecord[]) {
    onChange(setJsonField(draft, 'scoringRules', rules));
  }

  function changeRule(index: number, rule: JsonRecord) {
    setRules(replaceArrayItem(scoringRules, index, rule).filter(recordGuard));
  }

  function setAdjustments(rules: readonly JsonRecord[]) {
    onChange(setJsonField(draft, 'adjustmentRules', rules.length ? rules : undefined));
  }

  function changeAdjustment(index: number, rule: JsonRecord) {
    setAdjustments(replaceArrayItem(adjustments, index, rule).filter(recordGuard));
  }

  return (
    <section className="studio-scoring-editor" aria-labelledby="studio-scoring-editor-title">
      <h3 id="studio-scoring-editor-title">Scoring and adjustment rules</h3>
      <p>
        All values serialize directly to calculator-version.v1; no executable code is generated.
      </p>
      {scoringRules.map((rule, index) => {
        const contexts = jsonRecordArray(rule.contexts);
        const optionPoints = jsonRecordArray(rule.optionPoints);
        const mode = contexts.length ? 'bands' : optionPoints.length ? 'options' : 'unset';
        return (
          <details key={`${String(rule.parameterKey ?? 'rule')}-${index}`}>
            <summary>
              Rule {index + 1}: {String(rule.parameterKey ?? 'parameter not selected')}
            </summary>
            <label>
              Parameter
              <select
                value={typeof rule.parameterKey === 'string' ? rule.parameterKey : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeRule(index, setJsonField(rule, 'parameterKey', event.currentTarget.value))
                }
              >
                <option value="">Choose a parameter</option>
                {parameterKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rule type
              <select
                value={mode}
                disabled={disabled}
                onChange={(event) => {
                  const nextMode = event.currentTarget.value;
                  const next = { ...rule };
                  delete next.contexts;
                  delete next.optionPoints;
                  if (nextMode === 'bands') next.contexts = [{ when: null, bands: [] }];
                  if (nextMode === 'options') next.optionPoints = [];
                  changeRule(index, next);
                }}
              >
                <option value="unset">Not configured</option>
                <option value="bands">Numeric/context bands</option>
                <option value="options">Option points</option>
              </select>
            </label>
            {mode === 'bands' ? (
              <>
                <label>
                  Default edge semantics
                  <select
                    value={typeof rule.bandEdges === 'string' ? rule.bandEdges : ''}
                    disabled={disabled}
                    onChange={(event) =>
                      changeRule(
                        index,
                        setJsonField(rule, 'bandEdges', event.currentTarget.value || undefined),
                      )
                    }
                  >
                    <option value="">Choose semantics</option>
                    <option value="min-inclusive">Minimum inclusive [min, max)</option>
                    <option value="explicit">Explicit per-bound flags</option>
                  </select>
                </label>
                <ContextBandEditor
                  contexts={contexts}
                  onChange={(next) => changeRule(index, setJsonField(rule, 'contexts', next))}
                  parameterKeys={parameterKeys}
                  aggregateKeys={aggregateKeys}
                  formulaKeys={formulaKeys}
                  disabled={disabled}
                  bandEdges={rule.bandEdges === 'explicit' ? 'explicit' : 'min-inclusive'}
                />
              </>
            ) : null}
            {mode === 'options' ? (
              <OptionPointEditor
                values={optionPoints}
                onChange={(next) => changeRule(index, setJsonField(rule, 'optionPoints', next))}
                disabled={disabled}
              />
            ) : null}
            <SourceEditor
              label={`Rule ${index + 1} source`}
              value={rule.source}
              disabled={disabled}
              onChange={(source) => changeRule(index, setJsonField(rule, 'source', source))}
            />
            <label>
              Clarification IDs (comma separated)
              <input
                value={jsonArray(rule.clarificationRefs).join(', ')}
                disabled={disabled}
                onChange={(event) =>
                  changeRule(
                    index,
                    setJsonField(
                      rule,
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
            <button
              type="button"
              disabled={disabled}
              onClick={() => setRules(removeArrayItem(scoringRules, index).filter(recordGuard))}
            >
              Remove scoring rule {index + 1}
            </button>
          </details>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setRules([...scoringRules, { parameterKey: '' }])}
      >
        Add scoring rule
      </button>

      <h3>Adjustment rules</h3>
      {adjustments.map((rule, index) => {
        const mode =
          typeof rule.bandParam === 'string'
            ? 'bands'
            : typeof rule.optionParam === 'string'
              ? 'options'
              : 'unset';
        return (
          <details key={`${String(rule.key ?? 'adjustment')}-${index}`}>
            <summary>
              Adjustment {index + 1}: {String(rule.label ?? rule.key ?? 'unnamed')}
            </summary>
            <label>
              Key
              <input
                value={typeof rule.key === 'string' ? rule.key : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeAdjustment(index, setJsonField(rule, 'key', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Label
              <input
                value={typeof rule.label === 'string' ? rule.label : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeAdjustment(index, setJsonField(rule, 'label', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Adjustment type
              <select
                value={mode}
                disabled={disabled}
                onChange={(event) => {
                  const nextMode = event.currentTarget.value;
                  const next = { ...rule };
                  for (const key of ['bandParam', 'bands', 'optionParam', 'optionPoints'])
                    delete next[key];
                  if (nextMode === 'bands') {
                    next.bandParam = '';
                    next.bands = [];
                  }
                  if (nextMode === 'options') {
                    next.optionParam = '';
                    next.optionPoints = [];
                  }
                  changeAdjustment(index, next);
                }}
              >
                <option value="unset">Not configured</option>
                <option value="bands">Numeric bands</option>
                <option value="options">Option points</option>
              </select>
            </label>
            {mode === 'bands' ? (
              <>
                <label>
                  Default edge semantics
                  <select
                    value={typeof rule.bandEdges === 'string' ? rule.bandEdges : ''}
                    disabled={disabled}
                    onChange={(event) =>
                      changeAdjustment(
                        index,
                        setJsonField(rule, 'bandEdges', event.currentTarget.value || undefined),
                      )
                    }
                  >
                    <option value="">Choose semantics</option>
                    <option value="min-inclusive">Minimum inclusive [min, max)</option>
                    <option value="explicit">Explicit per-bound flags</option>
                  </select>
                </label>
                <label>
                  Band parameter
                  <select
                    value={typeof rule.bandParam === 'string' ? rule.bandParam : ''}
                    disabled={disabled}
                    onChange={(event) =>
                      changeAdjustment(
                        index,
                        setJsonField(rule, 'bandParam', event.currentTarget.value),
                      )
                    }
                  >
                    <option value="">Choose a parameter</option>
                    {parameterKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <BandEditor
                  title={`Adjustment ${index + 1} bands`}
                  bands={jsonRecordArray(rule.bands)}
                  onChange={(bands) => changeAdjustment(index, setJsonField(rule, 'bands', bands))}
                  disabled={disabled}
                  bandEdges={rule.bandEdges === 'explicit' ? 'explicit' : 'min-inclusive'}
                />
              </>
            ) : null}
            {mode === 'options' ? (
              <>
                <label>
                  Option parameter
                  <select
                    value={typeof rule.optionParam === 'string' ? rule.optionParam : ''}
                    disabled={disabled}
                    onChange={(event) =>
                      changeAdjustment(
                        index,
                        setJsonField(rule, 'optionParam', event.currentTarget.value),
                      )
                    }
                  >
                    <option value="">Choose a parameter</option>
                    {parameterKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <OptionPointEditor
                  title={`Adjustment ${index + 1} option points`}
                  values={jsonRecordArray(rule.optionPoints)}
                  onChange={(next) =>
                    changeAdjustment(index, setJsonField(rule, 'optionPoints', next))
                  }
                  disabled={disabled}
                />
              </>
            ) : null}
            <SourceEditor
              label={`Adjustment ${index + 1} source`}
              value={rule.source}
              disabled={disabled}
              onChange={(source) => changeAdjustment(index, setJsonField(rule, 'source', source))}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setAdjustments(removeArrayItem(adjustments, index).filter(recordGuard))
              }
            >
              Remove adjustment {index + 1}
            </button>
          </details>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAdjustments([...adjustments, { key: '', label: '' }])}
      >
        Add adjustment rule
      </button>
    </section>
  );
}
