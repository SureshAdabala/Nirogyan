import React, { type ReactNode } from 'react';
import Link from 'next/link';

import type { PublicParameterConfig } from '../types';

void React;

export interface FieldShellProps {
  readonly parameter: PublicParameterConfig;
  readonly labelId: string;
  readonly helpId: string;
  readonly errorId: string;
  readonly warningId: string;
  readonly error?: string;
  readonly warning?: string;
  readonly skipped: boolean;
  readonly skippable: boolean;
  readonly onSkippedChange: (skipped: boolean) => void;
  readonly children: ReactNode;
}

function skipLabel(parameter: PublicParameterConfig): string {
  if (parameter.missingPolicy === 'not-applicable') return 'This does not apply to me';
  if (parameter.missingPolicy === 'default-option') return 'Use the reviewed default option';
  return "I don't have this value";
}

function skippedExplanation(parameter: PublicParameterConfig): string {
  if (parameter.missingPolicy === 'default-option') {
    return 'The authored default option will be used; it will not be recorded as your answer.';
  }
  if (parameter.missingPolicy === 'impute-rule') {
    return 'The calculator will apply its reviewed fallback rule.';
  }
  if (parameter.missingPolicy === 'not-applicable') {
    return 'This input will be recorded as not applicable.';
  }
  if (
    parameter.missingPolicy === 'exclude-from-max' ||
    parameter.missingPolicy === 'exclude-from-group'
  ) {
    return 'This input will be omitted and coverage will reflect the missing information.';
  }
  return 'The calculator will apply its reviewed missing-value rule.';
}

export function FieldShell({
  parameter,
  labelId,
  helpId,
  errorId,
  warningId,
  error,
  warning,
  skipped,
  skippable,
  onSkippedChange,
  children,
}: FieldShellProps) {
  return (
    <div className="calculator-field" data-field-key={parameter.key}>
      <div className="calculator-field__heading" id={labelId}>
        <span>{parameter.label}</span>
        {parameter.validation?.required === true || parameter.missingPolicy === 'block' ? (
          <span aria-label="required"> Required</span>
        ) : null}
      </div>
      {parameter.helpText ? (
        <p className="calculator-field__help" id={helpId}>
          {parameter.helpText}
        </p>
      ) : null}
      {parameter.biomarkerKey ? (
        <p className="calculator-field__learn-more">
          <Link href={`/biomarkers/${encodeURIComponent(parameter.biomarkerKey)}`}>
            Learn more about {parameter.label}
          </Link>
        </p>
      ) : null}
      {children}
      {skippable ? (
        <label className="calculator-field__skip">
          <input
            type="checkbox"
            checked={skipped}
            onChange={(event) => onSkippedChange(event.currentTarget.checked)}
          />{' '}
          {skipLabel(parameter)}
        </label>
      ) : null}
      {skipped ? (
        <p className="calculator-field__skipped">{skippedExplanation(parameter)}</p>
      ) : null}
      {error ? (
        <p className="calculator-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {!error && warning ? (
        <p className="calculator-field__warning" id={warningId}>
          {warning}
        </p>
      ) : null}
    </div>
  );
}
