import type { JSX } from 'react';

import { BooleanField } from './BooleanField';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import type { FieldControlProps } from './types';

export type FieldComponent = (props: FieldControlProps) => JSX.Element;

export const FieldRegistry: Readonly<Record<'number' | 'select' | 'boolean', FieldComponent>> = {
  number: NumberField,
  select: SelectField,
  boolean: BooleanField,
};

export function fieldComponentFor(
  inputType: 'number' | 'select' | 'boolean' | 'derived',
): FieldComponent | undefined {
  return inputType === 'derived' ? undefined : FieldRegistry[inputType];
}
