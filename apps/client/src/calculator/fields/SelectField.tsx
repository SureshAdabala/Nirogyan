import React from 'react';

import type { FieldControlProps } from './types';

void React;

export function SelectField({
  parameter,
  value,
  inputId,
  labelledBy,
  describedBy,
  disabled,
  invalid,
  onChange,
  onBlur,
}: FieldControlProps) {
  const options = parameter.options ?? [];
  const selectedIndex = options.findIndex((option) => Object.is(option.value, value));
  return (
    <select
      id={inputId}
      value={selectedIndex < 0 ? '' : String(selectedIndex)}
      disabled={disabled}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      aria-required={parameter.validation?.required === true || parameter.missingPolicy === 'block'}
      onChange={(event) => {
        if (event.currentTarget.value === '') {
          onChange(undefined);
          return;
        }
        const option = options[Number(event.currentTarget.value)];
        onChange(option?.value);
      }}
      onBlur={onBlur}
    >
      <option value="">Choose an option</option>
      {options.map((option, index) => (
        <option key={`${index}:${String(option.value)}`} value={String(index)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
