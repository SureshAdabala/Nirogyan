import type { PublicParameterConfig, PublicScalar } from '../types';

export interface FieldControlProps {
  readonly parameter: PublicParameterConfig;
  readonly value: PublicScalar | undefined;
  readonly selectedUnit: string | undefined;
  readonly inputId: string;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly onChange: (value: PublicScalar | undefined) => void;
  readonly onBlur: () => void;
  readonly onUnitChange: (unit: string) => void;
}
