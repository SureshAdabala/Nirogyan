import React from 'react';

import type { PublicCalculatorStep } from './types';

void React;

export function StepNav({
  steps,
  currentStep,
}: {
  readonly steps: readonly PublicCalculatorStep[];
  readonly currentStep: number;
}) {
  return (
    <nav className="calculator-step-nav" aria-label="Calculator progress">
      <p>
        Step {currentStep + 1} of {steps.length}
      </p>
      <progress value={currentStep + 1} max={steps.length}>
        Step {currentStep + 1} of {steps.length}
      </progress>
      <ol>
        {steps.map((step, index) => (
          <li key={step.key}>
            <span aria-current={index === currentStep ? 'step' : undefined}>{step.title}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
