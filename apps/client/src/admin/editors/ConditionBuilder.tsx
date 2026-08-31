'use client';

import React, { useId } from 'react';

void React;

import {
  isJsonRecord,
  jsonArray,
  jsonRecord,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  type JsonRecord,
} from '../editor-helpers';

export type ConditionKind = 'predicate' | 'all' | 'any' | 'not';

export interface ConditionBuilderProps {
  readonly value: unknown;
  readonly onChange: (condition: JsonRecord) => void;
  readonly parameterKeys?: readonly string[];
  readonly aggregateKeys?: readonly string[];
  readonly formulaKeys?: readonly string[];
  readonly disabled?: boolean;
  readonly legend?: string;
}

function conditionKind(value: unknown): ConditionKind {
  const condition = jsonRecord(value);
  if (Array.isArray(condition.all)) return 'all';
  if (Array.isArray(condition.any)) return 'any';
  if (isJsonRecord(condition.not)) return 'not';
  return 'predicate';
}

function blankPredicate(): JsonRecord {
  return { param: '', op: 'eq', value: '' };
}

function changeKind(kind: ConditionKind): JsonRecord {
  if (kind === 'all') return { all: [blankPredicate()] };
  if (kind === 'any') return { any: [blankPredicate()] };
  if (kind === 'not') return { not: blankPredicate() };
  return blankPredicate();
}

function scalarKind(value: unknown): 'string' | 'number' | 'boolean' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function scalarText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return value === undefined ? '' : String(value);
}

function parseScalar(text: string, kind: 'string' | 'number' | 'boolean'): unknown {
  if (kind === 'number') return parseOptionalNumber(text) ?? 0;
  if (kind === 'boolean') return text === 'true';
  return text;
}

function PredicateEditor({
  value,
  onChange,
  parameterKeys,
  aggregateKeys,
  formulaKeys,
  disabled,
  idPrefix,
}: Readonly<{
  value: JsonRecord;
  onChange: (next: JsonRecord) => void;
  parameterKeys: readonly string[];
  aggregateKeys: readonly string[];
  formulaKeys: readonly string[];
  disabled?: boolean;
  idPrefix: string;
}>) {
  const sourceKind =
    typeof value.aggregate === 'string'
      ? 'aggregate'
      : typeof value.formula === 'string'
        ? 'formula'
        : 'param';
  const sourceOptions =
    sourceKind === 'aggregate'
      ? aggregateKeys
      : sourceKind === 'formula'
        ? formulaKeys
        : parameterKeys;
  const sourceValue = typeof value[sourceKind] === 'string' ? value[sourceKind] : '';
  const operator = typeof value.op === 'string' ? value.op : 'eq';
  const hasValue = !['exists', 'missing'].includes(operator);
  const listValue = ['in', 'not-in'].includes(operator);
  const firstValue = Array.isArray(value.value) ? value.value[0] : value.value;
  const valueKind = scalarKind(firstValue);

  function setSourceKind(nextKind: 'param' | 'aggregate' | 'formula') {
    const output = { ...value };
    delete output.param;
    delete output.aggregate;
    delete output.formula;
    output[nextKind] = '';
    onChange(output);
  }

  function setOperator(nextOperator: string) {
    let output = setJsonField(value, 'op', nextOperator);
    if (['exists', 'missing'].includes(nextOperator))
      output = setJsonField(output, 'value', undefined);
    else if (output.value === undefined) output = setJsonField(output, 'value', '');
    onChange(output);
  }

  function setValueKind(nextKind: 'string' | 'number' | 'boolean') {
    if (listValue) {
      const values = jsonArray(value.value).map((item) => parseScalar(String(item), nextKind));
      onChange(setJsonField(value, 'value', values.length ? values : [parseScalar('', nextKind)]));
      return;
    }
    onChange(setJsonField(value, 'value', parseScalar(String(firstValue ?? ''), nextKind)));
  }

  return (
    <div className="studio-condition-predicate">
      <label htmlFor={`${idPrefix}-source-kind`}>
        Value source
        <select
          id={`${idPrefix}-source-kind`}
          value={sourceKind}
          disabled={disabled}
          onChange={(event) =>
            setSourceKind(event.currentTarget.value as 'param' | 'aggregate' | 'formula')
          }
        >
          <option value="param">Parameter</option>
          <option value="aggregate">Aggregate</option>
          <option value="formula">Formula</option>
        </select>
      </label>
      <label htmlFor={`${idPrefix}-source-key`}>
        Source key
        <input
          id={`${idPrefix}-source-key`}
          list={`${idPrefix}-source-options`}
          value={String(sourceValue)}
          disabled={disabled}
          onChange={(event) => onChange(setJsonField(value, sourceKind, event.currentTarget.value))}
        />
      </label>
      <datalist id={`${idPrefix}-source-options`}>
        {sourceOptions.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
      <label htmlFor={`${idPrefix}-operator`}>
        Operator
        <select
          id={`${idPrefix}-operator`}
          value={operator}
          disabled={disabled}
          onChange={(event) => setOperator(event.currentTarget.value)}
        >
          {['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not-in', 'exists', 'missing'].map(
            (item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ),
          )}
        </select>
      </label>
      {hasValue ? (
        <>
          <label htmlFor={`${idPrefix}-value-kind`}>
            Value type
            <select
              id={`${idPrefix}-value-kind`}
              value={valueKind}
              disabled={disabled}
              onChange={(event) =>
                setValueKind(event.currentTarget.value as 'string' | 'number' | 'boolean')
              }
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </select>
          </label>
          {valueKind === 'boolean' && !listValue ? (
            <label htmlFor={`${idPrefix}-value`}>
              Value
              <select
                id={`${idPrefix}-value`}
                value={String(firstValue ?? false)}
                disabled={disabled}
                onChange={(event) =>
                  onChange(setJsonField(value, 'value', event.currentTarget.value === 'true'))
                }
              >
                <option value="false">False</option>
                <option value="true">True</option>
              </select>
            </label>
          ) : (
            <label htmlFor={`${idPrefix}-value`}>
              {listValue ? 'Values (comma separated)' : 'Value'}
              <input
                id={`${idPrefix}-value`}
                type={valueKind === 'number' && !listValue ? 'number' : 'text'}
                value={scalarText(value.value)}
                disabled={disabled}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  const next = listValue
                    ? text
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((item) => parseScalar(item, valueKind))
                    : parseScalar(text, valueKind);
                  onChange(setJsonField(value, 'value', next));
                }}
              />
            </label>
          )}
        </>
      ) : null}
    </div>
  );
}

function ConditionNode({
  value,
  onChange,
  parameterKeys,
  aggregateKeys,
  formulaKeys,
  disabled,
  path,
  idBase,
}: Readonly<{
  value: unknown;
  onChange: (condition: JsonRecord) => void;
  parameterKeys: readonly string[];
  aggregateKeys: readonly string[];
  formulaKeys: readonly string[];
  disabled?: boolean;
  path: string;
  idBase: string;
}>) {
  const condition = jsonRecord(value);
  const kind = conditionKind(condition);
  const childKey = kind === 'all' ? 'all' : 'any';
  const children = kind === 'all' || kind === 'any' ? jsonArray(condition[childKey]) : [];

  return (
    <fieldset className="studio-condition-node">
      <legend>Condition {path}</legend>
      <label>
        Condition type
        <select
          value={kind}
          disabled={disabled}
          onChange={(event) => onChange(changeKind(event.currentTarget.value as ConditionKind))}
        >
          <option value="predicate">Comparison</option>
          <option value="all">ALL</option>
          <option value="any">ANY</option>
          <option value="not">NOT</option>
        </select>
      </label>
      {kind === 'predicate' ? (
        <PredicateEditor
          value={condition}
          onChange={onChange}
          parameterKeys={parameterKeys}
          aggregateKeys={aggregateKeys}
          formulaKeys={formulaKeys}
          disabled={disabled}
          idPrefix={`${idBase}-${path.replace(/[^a-z0-9]/gi, '-')}`}
        />
      ) : null}
      {kind === 'all' || kind === 'any' ? (
        <div className="studio-condition-children">
          {children.map((child, index) => (
            <div key={`${path}-${index}`}>
              <ConditionNode
                value={child}
                onChange={(next) =>
                  onChange(
                    setJsonField(condition, childKey, replaceArrayItem(children, index, next)),
                  )
                }
                parameterKeys={parameterKeys}
                aggregateKeys={aggregateKeys}
                formulaKeys={formulaKeys}
                disabled={disabled}
                path={`${path}.${index + 1}`}
                idBase={idBase}
              />
              <button
                type="button"
                disabled={disabled || children.length <= 1}
                onClick={() =>
                  onChange(setJsonField(condition, childKey, removeArrayItem(children, index)))
                }
              >
                Remove condition {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(setJsonField(condition, childKey, [...children, blankPredicate()]))
            }
          >
            Add condition to {kind.toUpperCase()}
          </button>
        </div>
      ) : null}
      {kind === 'not' ? (
        <ConditionNode
          value={condition.not}
          onChange={(next) => onChange(setJsonField(condition, 'not', next))}
          parameterKeys={parameterKeys}
          aggregateKeys={aggregateKeys}
          formulaKeys={formulaKeys}
          disabled={disabled}
          path={`${path}.not`}
          idBase={idBase}
        />
      ) : null}
    </fieldset>
  );
}

export function ConditionBuilder({
  value,
  onChange,
  parameterKeys = [],
  aggregateKeys = [],
  formulaKeys = [],
  disabled,
  legend = 'Rule condition',
}: Readonly<ConditionBuilderProps>) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-heading`} className="studio-condition-builder">
      <h4 id={`${id}-heading`}>{legend}</h4>
      <ConditionNode
        value={value}
        onChange={onChange}
        parameterKeys={parameterKeys}
        aggregateKeys={aggregateKeys}
        formulaKeys={formulaKeys}
        disabled={disabled}
        path="1"
        idBase={`condition-${id.replace(/[^a-z0-9]/gi, '-')}`}
      />
    </section>
  );
}

export function isCondition(value: unknown): value is JsonRecord {
  return isJsonRecord(value);
}
