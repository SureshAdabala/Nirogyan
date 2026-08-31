'use client';

import React from 'react';

void React;

import { ConditionBuilder } from './ConditionBuilder';
import { BiomarkerPicker } from './BiomarkerPicker';
import {
  jsonArray,
  jsonRecord,
  jsonRecordArray,
  parseOptionalNumber,
  prefillParameterFromBiomarker,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  type JsonRecord,
} from '../editor-helpers';

export interface ParameterEditorProps {
  readonly parameter: JsonRecord;
  readonly onChange: (parameter: JsonRecord) => void;
  readonly onClose?: () => void;
  readonly open?: boolean;
  readonly biomarkers?: readonly JsonRecord[];
  readonly parameterKeys?: readonly string[];
  readonly aggregateKeys?: readonly string[];
  readonly formulaKeys?: readonly string[];
  readonly disabled?: boolean;
}

function setText(parameter: JsonRecord, key: string, value: string): JsonRecord {
  return setJsonField(parameter, key, value.trim() ? value : undefined);
}

export function ParameterEditor({
  parameter,
  onChange,
  onClose,
  open = true,
  biomarkers = [],
  parameterKeys = [],
  aggregateKeys = [],
  formulaKeys = [],
  disabled,
}: Readonly<ParameterEditorProps>) {
  if (!open) return null;
  const unit = jsonRecord(parameter.unit);
  const validation = jsonRecord(parameter.validation);
  const options = jsonRecordArray(parameter.options);
  const derived = jsonRecord(parameter.derived);
  const inputType = typeof parameter.inputType === 'string' ? parameter.inputType : '';

  function setUnitField(key: string, value: unknown) {
    const nextUnit = setJsonField(unit, key, value);
    onChange(setJsonField(parameter, 'unit', Object.keys(nextUnit).length ? nextUnit : undefined));
  }

  function setValidationField(key: string, value: unknown) {
    const nextValidation = setJsonField(validation, key, value);
    onChange(
      setJsonField(
        parameter,
        'validation',
        Object.keys(nextValidation).length ? nextValidation : undefined,
      ),
    );
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-parameter-editor-title"
      className="studio-parameter-editor"
    >
      <header>
        <h3 id="studio-parameter-editor-title">Parameter editor</h3>
        {onClose ? (
          <button type="button" onClick={onClose}>
            Close parameter editor
          </button>
        ) : null}
      </header>
      {biomarkers.length ? (
        <BiomarkerPicker
          biomarkers={biomarkers}
          selectedKey={
            typeof parameter.biomarkerKey === 'string' ? parameter.biomarkerKey : undefined
          }
          disabled={disabled}
          onSelect={(biomarker) => onChange(prefillParameterFromBiomarker(parameter, biomarker))}
        />
      ) : null}
      <div className="studio-form-grid">
        <label>
          Parameter key
          <input
            value={typeof parameter.key === 'string' ? parameter.key : ''}
            disabled={disabled}
            onChange={(event) => onChange(setText(parameter, 'key', event.currentTarget.value))}
          />
        </label>
        <label>
          Label
          <input
            value={typeof parameter.label === 'string' ? parameter.label : ''}
            disabled={disabled}
            onChange={(event) => onChange(setText(parameter, 'label', event.currentTarget.value))}
          />
        </label>
        <label>
          Group key
          <input
            value={typeof parameter.group === 'string' ? parameter.group : ''}
            disabled={disabled}
            onChange={(event) => onChange(setText(parameter, 'group', event.currentTarget.value))}
          />
        </label>
        <label>
          Input type
          <select
            value={inputType}
            disabled={disabled}
            onChange={(event) =>
              onChange(setJsonField(parameter, 'inputType', event.currentTarget.value))
            }
          >
            <option value="">Choose a type</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="boolean">Boolean</option>
            <option value="derived">Derived</option>
          </select>
        </label>
        <label>
          Order
          <input
            type="number"
            value={typeof parameter.order === 'number' ? parameter.order : ''}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                setJsonField(parameter, 'order', parseOptionalNumber(event.currentTarget.value)),
              )
            }
          />
        </label>
        <label>
          Missing-value policy
          <select
            value={typeof parameter.missingPolicy === 'string' ? parameter.missingPolicy : ''}
            disabled={disabled}
            onChange={(event) =>
              onChange(setText(parameter, 'missingPolicy', event.currentTarget.value))
            }
          >
            <option value="">No policy selected</option>
            {[
              'block',
              'default-option',
              'impute-rule',
              'exclude-from-max',
              'exclude-from-group',
              'zero-points',
              'not-applicable',
            ].map((policy) => (
              <option key={policy} value={policy}>
                {policy}
              </option>
            ))}
          </select>
        </label>
        <label>
          Help text
          <textarea
            value={typeof parameter.helpText === 'string' ? parameter.helpText : ''}
            disabled={disabled}
            onChange={(event) =>
              onChange(setText(parameter, 'helpText', event.currentTarget.value))
            }
          />
        </label>
        <label>
          Placeholder
          <input
            value={typeof parameter.placeholder === 'string' ? parameter.placeholder : ''}
            disabled={disabled}
            onChange={(event) =>
              onChange(setText(parameter, 'placeholder', event.currentTarget.value))
            }
          />
        </label>
      </div>

      {inputType === 'number' ? (
        <fieldset>
          <legend>Units and validation</legend>
          <label>
            Canonical unit
            <input
              value={typeof unit.canonical === 'string' ? unit.canonical : ''}
              disabled={disabled}
              onChange={(event) =>
                setUnitField('canonical', event.currentTarget.value || undefined)
              }
            />
          </label>
          {(['min', 'max', 'softMin', 'softMax'] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                type="number"
                value={typeof validation[key] === 'number' ? validation[key] : ''}
                disabled={disabled}
                onChange={(event) =>
                  setValidationField(key, parseOptionalNumber(event.currentTarget.value))
                }
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={validation.required === true}
              disabled={disabled}
              onChange={(event) =>
                setValidationField('required', event.currentTarget.checked || undefined)
              }
            />
            Required
          </label>
          <label>
            <input
              type="checkbox"
              checked={validation.integer === true}
              disabled={disabled}
              onChange={(event) =>
                setValidationField('integer', event.currentTarget.checked || undefined)
              }
            />
            Integer only
          </label>
          <details>
            <summary>Allowed affine unit conversions</summary>
            {jsonRecordArray(unit.allowed).map((choice, index) => (
              <fieldset key={index}>
                <legend>Conversion {index + 1}</legend>
                {(['code', 'factor', 'offset'] as const).map((key) => (
                  <label key={key}>
                    {key}
                    <input
                      type={key === 'code' ? 'text' : 'number'}
                      value={
                        typeof choice[key] === 'string' || typeof choice[key] === 'number'
                          ? String(choice[key])
                          : ''
                      }
                      disabled={disabled}
                      onChange={(event) => {
                        const nextChoice = setJsonField(
                          choice,
                          key,
                          key === 'code'
                            ? event.currentTarget.value
                            : parseOptionalNumber(event.currentTarget.value),
                        );
                        setUnitField(
                          'allowed',
                          replaceArrayItem(jsonArray(unit.allowed), index, nextChoice),
                        );
                      }}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setUnitField('allowed', removeArrayItem(jsonArray(unit.allowed), index))
                  }
                >
                  Remove conversion {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setUnitField('allowed', [
                  ...jsonArray(unit.allowed),
                  { code: '', factor: 1, offset: 0 },
                ])
              }
            >
              Add conversion
            </button>
          </details>
        </fieldset>
      ) : null}

      {inputType === 'select' ? (
        <fieldset>
          <legend>Selectable options</legend>
          {options.map((option, index) => (
            <div key={index}>
              <label>
                Option {index + 1} value
                <input
                  value={String(option.value ?? '')}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      setJsonField(
                        parameter,
                        'options',
                        replaceArrayItem(
                          options,
                          index,
                          setJsonField(option, 'value', event.currentTarget.value),
                        ),
                      ),
                    )
                  }
                />
              </label>
              <label>
                Option {index + 1} label
                <input
                  value={typeof option.label === 'string' ? option.label : ''}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      setJsonField(
                        parameter,
                        'options',
                        replaceArrayItem(
                          options,
                          index,
                          setJsonField(option, 'label', event.currentTarget.value),
                        ),
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(setJsonField(parameter, 'options', removeArrayItem(options, index)))
                }
              >
                Remove option {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(setJsonField(parameter, 'options', [...options, { value: '', label: '' }]))
            }
          >
            Add option
          </button>
        </fieldset>
      ) : null}

      {inputType === 'derived' ? (
        <fieldset>
          <legend>Derived value</legend>
          <label>
            Formula
            <input
              value={typeof derived.formula === 'string' ? derived.formula : ''}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  setJsonField(
                    parameter,
                    'derived',
                    setJsonField(derived, 'formula', event.currentTarget.value),
                  ),
                )
              }
            />
          </label>
          <label>
            Dependencies (comma separated)
            <input
              value={jsonArray(derived.dependsOn).join(', ')}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  setJsonField(
                    parameter,
                    'derived',
                    setJsonField(
                      derived,
                      'dependsOn',
                      event.currentTarget.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    ),
                  ),
                )
              }
            />
          </label>
        </fieldset>
      ) : null}

      <ConditionBuilder
        legend="Visibility condition"
        value={parameter.visibility}
        onChange={(condition) => onChange(setJsonField(parameter, 'visibility', condition))}
        parameterKeys={parameterKeys}
        aggregateKeys={aggregateKeys}
        formulaKeys={formulaKeys}
        disabled={disabled}
      />
      {parameter.visibility !== undefined ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(setJsonField(parameter, 'visibility', undefined))}
        >
          Remove visibility condition
        </button>
      ) : null}
    </section>
  );
}
