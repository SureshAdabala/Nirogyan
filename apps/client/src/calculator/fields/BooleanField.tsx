import React from 'react';

import type { FieldControlProps } from './types';

void React;

export function BooleanField({
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
  const name = `${inputId}-choice`;
  return (
    <fieldset
      className="calculator-boolean-field"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    >
      <legend className="calculator-visually-hidden">Choose Yes or No</legend>
      <label>
        <input
          id={inputId}
          type="radio"
          name={name}
          value="yes"
          checked={value === true}
          disabled={disabled}
          required={parameter.validation?.required === true || parameter.missingPolicy === 'block'}
          onChange={() => onChange(true)}
          onBlur={onBlur}
        />{' '}
        Yes
      </label>
      <label>
        <input
          id={`${inputId}-no`}
          type="radio"
          name={name}
          value="no"
          checked={value === false}
          disabled={disabled}
          onChange={() => onChange(false)}
          onBlur={onBlur}
        />{' '}
        No
      </label>
    </fieldset>
  );
}
