import type { PublicCalculatorConfig } from './types';

/** Deliberately nonclinical renderer fixture. */
export function rendererFixture(): PublicCalculatorConfig {
  return {
    slug: 'renderer-fixture',
    calculatorSlug: 'renderer-fixture',
    version: 3,
    name: 'Renderer fixture',
    parameters: [
      {
        key: 'mode',
        label: 'Mode',
        group: 'basics',
        inputType: 'select',
        validation: { required: true },
        missingPolicy: 'block',
        options: [
          { value: 'simple', label: 'Simple' },
          { value: 'extended', label: 'Extended' },
        ],
        order: 2,
      },
      {
        key: 'quantity',
        label: 'Quantity',
        group: 'basics',
        inputType: 'number',
        unit: {
          canonical: 'base-unit',
          allowed: [{ code: 'large-unit', factor: 100, offset: 0 }],
        },
        validation: { required: true, min: 0, max: 1000, softMax: 900 },
        missingPolicy: 'block',
        helpText: 'Enter a nonclinical fixture quantity.',
        order: 1,
      },
      {
        key: 'enabled',
        label: 'Enable optional input?',
        group: 'choices',
        inputType: 'boolean',
        missingPolicy: 'block',
        validation: { required: true },
        order: 3,
      },
      {
        key: 'optionalChoice',
        label: 'Optional choice',
        group: 'basics',
        inputType: 'select',
        options: [{ value: 'available', label: 'Available' }],
        missingPolicy: 'exclude-from-group',
        order: 3,
      },
      {
        key: 'optionalValue',
        label: 'Optional value',
        group: 'details',
        inputType: 'number',
        unit: { canonical: 'unit' },
        missingPolicy: 'exclude-from-max',
        visibility: { param: 'enabled', op: 'eq', value: true },
        order: 1,
      },
      {
        key: 'serverOnlyValue',
        label: 'Server-only visibility value',
        group: 'details',
        inputType: 'number',
        missingPolicy: 'exclude-from-max',
        visibility: { aggregate: 'serverAggregate', op: 'exists' },
        order: 2,
      },
      {
        key: 'derivedValue',
        label: 'Derived value',
        group: 'basics',
        inputType: 'derived',
        order: 99,
      },
    ],
    uiConfig: {
      theme: { accent: '#123456' },
      steps: [
        { key: 'first', title: 'First step', parameterGroups: ['basics', 'choices'] },
        { key: 'second', title: 'Second step', parameterGroups: ['details'] },
      ],
      result: { layout: ['score-gauge', 'category'] },
    },
  };
}

/**
 * Independently authored, deliberately nonclinical fixture. Its single-step,
 * conditionally revealed scalar fields and result layout are intentionally
 * distinct from rendererFixture; it must never be used as medical content.
 */
export function nonclinicalBatchFixture(): PublicCalculatorConfig {
  return {
    slug: 'nonclinical-batch-fixture',
    calculatorSlug: 'nonclinical-batch-fixture',
    version: 1,
    name: 'Nonclinical batch-label fixture',
    shortDescription: 'Synthetic batch-label data used only to verify generic rendering.',
    disclaimers: ['Nonclinical automated test fixture only.'],
    parameters: [
      {
        key: 'labelShape',
        label: 'Label shape',
        group: 'label-options',
        inputType: 'select',
        options: [
          { value: 'round', label: 'Round' },
          { value: 'square', label: 'Square' },
        ],
        missingPolicy: 'not-applicable',
        visibility: { param: 'includeLabel', op: 'eq', value: true },
        order: 1,
      },
      {
        key: 'batchCount',
        label: 'Batch count',
        group: 'quantity',
        inputType: 'number',
        validation: { required: true, min: 1, max: 12, integer: true },
        missingPolicy: 'block',
        helpText: 'Enter a synthetic whole-number batch count.',
        order: 1,
      },
      {
        key: 'includeLabel',
        label: 'Include a label?',
        group: 'decision',
        inputType: 'boolean',
        validation: { required: true },
        missingPolicy: 'block',
        order: 1,
      },
      {
        key: 'computedSlot',
        label: 'Computed slot',
        group: 'quantity',
        inputType: 'derived',
        order: 0,
      },
    ],
    uiConfig: {
      theme: { accent: '#654321' },
      steps: [
        {
          key: 'batch-setup',
          title: 'Configure a synthetic batch',
          parameterGroups: ['decision', 'label-options', 'quantity'],
        },
      ],
      result: { layout: ['category', 'recommendations', 'score-gauge'] },
    },
  };
}
