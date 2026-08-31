import type {
  PublicCalculatorConfig as ContractPublicCalculatorConfig,
  PublicCondition as ContractPublicCondition,
  PublicConditionPredicate,
  PublicParameter as ContractPublicParameter,
  PublicResultBlock,
  PublicScalar as ContractPublicScalar,
} from '@niro/contracts';

/** Renderer types are aliases of the frozen, presentation-only public DTOs. */
export type PublicScalar = ContractPublicScalar;
export type PublicCondition = ContractPublicCondition;
export type PublicConditionOperator = PublicConditionPredicate['op'];
export type PublicParameterConfig = ContractPublicParameter;
export type PublicUnitConfig = NonNullable<PublicParameterConfig['unit']>;
export type PublicUnitChoice = NonNullable<PublicUnitConfig['allowed']>[number];
export type PublicParameterValidation = NonNullable<PublicParameterConfig['validation']>;
export type PublicParameterOption = NonNullable<PublicParameterConfig['options']>[number];
export type PublicMissingPolicy = NonNullable<PublicParameterConfig['missingPolicy']>;
export type PublicCalculatorConfig = ContractPublicCalculatorConfig;
export type PublicCalculatorStep = PublicCalculatorConfig['uiConfig']['steps'][number];
export type PublicResultBlockKey = PublicResultBlock;

export interface RendererState {
  readonly values: Readonly<Record<string, PublicScalar>>;
  readonly units: Readonly<Record<string, string>>;
  readonly skipped: Readonly<Record<string, boolean>>;
  readonly errors: Readonly<Record<string, string>>;
  readonly currentStep: number;
}

export type AssessmentInput = PublicScalar | { readonly value: number; readonly unit: string };

export interface AssessmentPayloadWithoutIdempotency {
  readonly inputs: Readonly<Record<string, AssessmentInput>>;
  readonly omitted: readonly string[];
}

export interface AssessmentPayload extends AssessmentPayloadWithoutIdempotency {
  readonly idempotencyKey: string;
}

export interface ServerFieldFinding {
  readonly code?: string;
  readonly message?: string;
}

export type ServerFieldMap = Readonly<Record<string, string | ServerFieldFinding>>;
