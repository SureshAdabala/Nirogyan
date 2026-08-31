import React from 'react';

import { availableUnits, displayBound } from '../units';
import type { FieldControlProps } from './types';

void React;

export function NumberField({
  parameter,
  value,
  selectedUnit,
  inputId,
  labelledBy,
  describedBy,
  disabled,
  invalid,
  onChange,
  onBlur,
  onUnitChange,
}: FieldControlProps) {
  const units = availableUnits(parameter.unit);
  const activeUnit = selectedUnit ?? parameter.unit?.canonical;
  const min = displayBound(parameter.validation?.min, activeUnit, parameter.unit);
  const max = displayBound(parameter.validation?.max, activeUnit, parameter.unit);
  const integerStep =
    parameter.validation?.integer === true && activeUnit === parameter.unit?.canonical;
  return (
    <div className="calculator-number-field">
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        value={typeof value === 'number' ? value : ''}
        min={min}
        max={max}
        step={integerStep ? 1 : 'any'}
        placeholder={parameter.placeholder}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-required={
          parameter.validation?.required === true || parameter.missingPolicy === 'block'
        }
        onChange={(event) => {
          const source = event.currentTarget.value;
          const parsed = event.currentTarget.valueAsNumber;
          onChange(source === '' || !Number.isFinite(parsed) ? undefined : parsed);
        }}
        onBlur={onBlur}
      />
      {units.length > 1 ? (
        <select
          value={activeUnit}
          disabled={disabled}
          aria-label={`Unit for ${parameter.label}`}
          onChange={(event) => onUnitChange(event.currentTarget.value)}
        >
          {units.map((unit) => (
            <option key={unit.code} value={unit.code}>
              {unit.code}
            </option>
          ))}
        </select>
      ) : parameter.unit ? (
        <span className="calculator-number-field__unit">{parameter.unit.canonical}</span>
      ) : null}
    </div>
  );
}
