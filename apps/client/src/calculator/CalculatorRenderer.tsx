'use client';

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import React from 'react';

import { useAnalytics } from '../analytics/AnalyticsProvider';
import { FieldShell } from './fields/FieldShell';
import { fieldComponentFor } from './fields/registry';
import { clearProgress, restoreProgress, saveProgress, type StorageLike } from './progress-storage';
import { createInitialRendererState, rendererReducer } from './reducer';
import { StepNav } from './StepNav';
import {
  groupsForStep,
  humanizeKey,
  orderedRenderableParameters,
  parameterStepIndex,
  visibleParameterKeys,
} from './structure';
import {
  buildAssessmentPayload,
  createIdempotencyManager,
  mapServerFieldErrors,
  serverFieldsFromError,
  submissionErrorMessage,
} from './submission';
import type { AssessmentPayload, PublicCalculatorConfig, PublicParameterConfig } from './types';
import { switchEnteredUnit } from './units';
import { canSkipParameter, validateParameter, validateParameterSet } from './validation';

void React;

export interface AssessmentSubmissionLifecycle {
  /** Call immediately after the assessment API transaction succeeds. */
  readonly assessmentSucceeded: () => void;
}

export interface CalculatorRendererProps {
  readonly config: PublicCalculatorConfig;
  readonly onSubmit: (
    payload: AssessmentPayload,
    lifecycle: AssessmentSubmissionLifecycle,
  ) => void | Promise<void>;
  readonly submitLabel?: string;
  /** `null` disables progress storage; omitted uses the current tab's sessionStorage. */
  readonly storage?: StorageLike | null;
}

type FocusIntent = { readonly type: 'heading' } | { readonly type: 'field'; readonly key: string };

export function isUnprocessableAssessmentError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'status' in error && Number(error.status) === 422
  );
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * During hydration React uses the server snapshot first, then rechecks the
 * client snapshot after the server HTML is attached. This gives SSR and the
 * first hydrated render identical form state without delaying useful SSR
 * content or abandoning tab-scoped progress restoration.
 */
function useBrowserStateReady(): boolean {
  return useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
}

function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

function fieldIds(config: PublicCalculatorConfig, parameter: PublicParameterConfig) {
  const base = `calculator-${safeIdPart(config.calculatorSlug)}-${safeIdPart(parameter.key)}`;
  return {
    input: base,
    label: `${base}-label`,
    help: `${base}-help`,
    error: `${base}-error`,
    warning: `${base}-warning`,
  };
}

export function CalculatorRenderer({
  config,
  onSubmit,
  submitLabel = 'Calculate',
  storage,
}: CalculatorRendererProps) {
  const configIdentity = `${config.calculatorSlug}@${config.version}`;
  const browserStateReady = useBrowserStateReady();
  const restoreProgressOnMount = storage !== null && browserStateReady;
  return (
    <CalculatorRendererSession
      key={`${configIdentity}:${restoreProgressOnMount ? 'restored' : 'initial'}`}
      config={config}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
      storage={restoreProgressOnMount ? storage : null}
    />
  );
}

function CalculatorRendererSession({
  config,
  onSubmit,
  submitLabel,
  storage,
}: Required<Pick<CalculatorRendererProps, 'config' | 'onSubmit' | 'submitLabel'>> &
  Pick<CalculatorRendererProps, 'storage'>) {
  const activeStorage = useMemo(
    () => (storage === null ? undefined : (storage ?? browserStorage())),
    [storage],
  );
  const configIdentity = `${config.calculatorSlug}@${config.version}`;
  const [state, dispatch] = useReducer(rendererReducer, undefined, () => {
    return activeStorage
      ? (restoreProgress(activeStorage, config) ?? createInitialRendererState(config))
      : createInitialRendererState(config);
  });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const { track } = useAnalytics();
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const focusIntent = useRef<FocusIntent | undefined>(undefined);
  const idempotency = useRef(createIdempotencyManager());
  const trackedAssessmentSubmissions = useRef<string[]>([]);
  const startedConfig = useRef<string | undefined>(undefined);
  const trackedStep = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (activeStorage) {
      saveProgress(activeStorage, config, state);
    }
  }, [activeStorage, config, state]);

  const visibleKeys = useMemo(() => visibleParameterKeys(config, state), [config, state]);
  const orderedParameters = useMemo(() => orderedRenderableParameters(config), [config]);
  const visibleParameters = useMemo(
    () => orderedParameters.filter((parameter) => visibleKeys.has(parameter.key)),
    [orderedParameters, visibleKeys],
  );
  const validation = useMemo(
    () => validateParameterSet(visibleParameters, state),
    [state, visibleParameters],
  );
  const payload = useMemo(() => buildAssessmentPayload(config, state), [config, state]);

  useEffect(() => {
    idempotency.current.payloadChanged(payload);
  }, [payload]);

  useEffect(() => {
    if (startedConfig.current !== configIdentity) return;
    const visibleStep = config.uiConfig.steps[state.currentStep];
    if (visibleStep) {
      const identity = `${configIdentity}:${visibleStep.key}`;
      if (trackedStep.current === identity) return;
      trackedStep.current = identity;
      track('step_view', {
        calculatorSlug: config.calculatorSlug,
        step: visibleStep.key,
        stepIndex: state.currentStep,
      });
    }
  }, [config.calculatorSlug, config.uiConfig.steps, configIdentity, state.currentStep, track]);

  useEffect(() => {
    const intent = focusIntent.current;
    if (!intent || typeof document === 'undefined') return;
    focusIntent.current = undefined;
    if (intent.type === 'heading') {
      stepHeading.current?.focus();
      return;
    }
    document
      .getElementById(`calculator-${safeIdPart(config.calculatorSlug)}-${safeIdPart(intent.key)}`)
      ?.focus();
  }, [config.calculatorSlug, state.currentStep, state.errors]);

  const steps = config.uiConfig.steps;
  if (steps.length === 0) {
    return (
      <p role="alert">
        This calculator cannot be displayed because its published layout has no steps.
      </p>
    );
  }
  const currentStep = Math.min(Math.max(0, state.currentStep), steps.length - 1);
  const step = steps[currentStep];
  if (!step) return null;
  const groups = groupsForStep(config, step)
    .map((group) => ({
      ...group,
      parameters: group.parameters.filter((parameter) => visibleKeys.has(parameter.key)),
    }))
    .filter((group) => group.parameters.length > 0);

  function beginInteraction(): void {
    if (startedConfig.current === configIdentity) return;
    startedConfig.current = configIdentity;
    track('calc_start', { calculatorSlug: config.calculatorSlug });
    const visibleStep = config.uiConfig.steps[currentStep];
    if (!visibleStep) return;
    trackedStep.current = `${configIdentity}:${visibleStep.key}`;
    track('step_view', {
      calculatorSlug: config.calculatorSlug,
      step: visibleStep.key,
      stepIndex: currentStep,
    });
  }

  function focusFirstError(errors: Readonly<Record<string, string>>): void {
    const first = orderedParameters.find((parameter) => errors[parameter.key]);
    if (!first) return;
    const targetStep = parameterStepIndex(config, first.key) ?? currentStep;
    focusIntent.current = { type: 'field', key: first.key };
    if (targetStep !== currentStep) {
      dispatch({ type: 'set-current-step', currentStep: targetStep });
    }
  }

  function validateCurrentStep(): boolean {
    const parameters = groups.flatMap((group) => group.parameters);
    const result = validateParameterSet(parameters, state);
    dispatch({
      type: 'replace-errors-for-keys',
      keys: parameters.map((parameter) => parameter.key),
      errors: result.errors,
    });
    if (Object.keys(result.errors).length > 0) {
      focusFirstError(result.errors);
      return false;
    }
    return true;
  }

  function goNext(): void {
    setSubmitError(undefined);
    if (!validateCurrentStep()) return;
    focusIntent.current = { type: 'heading' };
    dispatch({
      type: 'set-current-step',
      currentStep: Math.min(currentStep + 1, steps.length - 1),
    });
  }

  function goBack(): void {
    setSubmitError(undefined);
    focusIntent.current = { type: 'heading' };
    dispatch({ type: 'set-current-step', currentStep: Math.max(0, currentStep - 1) });
  }

  function startOver(): void {
    if (activeStorage) clearProgress(activeStorage, config);
    idempotency.current = createIdempotencyManager();
    trackedAssessmentSubmissions.current = [];
    setSubmitError(undefined);
    focusIntent.current = { type: 'heading' };
    dispatch({ type: 'reset', state: createInitialRendererState(config) });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    beginInteraction();
    setSubmitError(undefined);
    const result = validateParameterSet(visibleParameters, state);
    dispatch({ type: 'replace-errors', errors: result.errors });
    if (Object.keys(result.errors).length > 0) {
      focusFirstError(result.errors);
      return;
    }

    let submitted: AssessmentPayload;
    try {
      submitted = idempotency.current.attach(payload);
    } catch (error) {
      setSubmitError(submissionErrorMessage(error));
      return;
    }

    setBusy(true);
    try {
      await onSubmit(submitted, {
        assessmentSucceeded() {
          if (trackedAssessmentSubmissions.current.includes(submitted.idempotencyKey)) return;
          trackedAssessmentSubmissions.current.push(submitted.idempotencyKey);
          if (trackedAssessmentSubmissions.current.length > 20) {
            trackedAssessmentSubmissions.current.shift();
          }
          track('assess_submit', { calculatorSlug: config.calculatorSlug });
        },
      });
      idempotency.current.succeeded(payload);
    } catch (error) {
      if (isUnprocessableAssessmentError(error)) {
        track('assess_error', { calculatorSlug: config.calculatorSlug });
      }
      const knownKeys = new Set(orderedParameters.map((parameter) => parameter.key));
      const fieldErrors = mapServerFieldErrors(serverFieldsFromError(error), knownKeys);
      if (Object.keys(fieldErrors).length > 0) {
        dispatch({ type: 'replace-errors', errors: fieldErrors });
        setSubmitError('Check the highlighted inputs and try again.');
        focusFirstError(fieldErrors);
      } else {
        setSubmitError(submissionErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="calculator-renderer"
      noValidate
      onChangeCapture={beginInteraction}
      onFocusCapture={beginInteraction}
      onSubmit={(event) => void submit(event)}
    >
      <StepNav steps={steps} currentStep={currentStep} />
      <section aria-labelledby={`calculator-step-${safeIdPart(step.key)}`}>
        <h2 id={`calculator-step-${safeIdPart(step.key)}`} tabIndex={-1} ref={stepHeading}>
          {step.title}
        </h2>
        {groups.length === 0 ? (
          <p>No inputs are needed on this step based on your previous answers.</p>
        ) : (
          groups.map((group) => (
            <fieldset className="calculator-group" key={group.key}>
              <legend>{humanizeKey(group.key)}</legend>
              {group.parameters.map((parameter) => {
                const Field = fieldComponentFor(parameter.inputType);
                if (!Field) return null;
                const ids = fieldIds(config, parameter);
                const error = state.errors[parameter.key];
                const warning = validation.warnings[parameter.key];
                const describedBy = [
                  parameter.helpText ? ids.help : undefined,
                  error ? ids.error : undefined,
                  !error && warning ? ids.warning : undefined,
                ]
                  .filter(Boolean)
                  .join(' ');
                const skipped = state.skipped[parameter.key] === true;
                return (
                  <FieldShell
                    key={parameter.key}
                    parameter={parameter}
                    labelId={ids.label}
                    helpId={ids.help}
                    errorId={ids.error}
                    warningId={ids.warning}
                    error={error}
                    warning={warning}
                    skipped={skipped}
                    skippable={canSkipParameter(parameter)}
                    onSkippedChange={(next) =>
                      dispatch({ type: 'set-skipped', key: parameter.key, skipped: next })
                    }
                  >
                    <Field
                      parameter={parameter}
                      value={state.values[parameter.key]}
                      selectedUnit={state.units[parameter.key]}
                      inputId={ids.input}
                      labelledBy={ids.label}
                      describedBy={describedBy || undefined}
                      disabled={skipped || busy}
                      invalid={Boolean(error)}
                      onChange={(value) =>
                        dispatch({ type: 'set-value', key: parameter.key, value })
                      }
                      onBlur={() => {
                        const next = validateParameter(
                          parameter,
                          state.values[parameter.key],
                          state.units[parameter.key],
                          skipped,
                        );
                        dispatch({
                          type: 'replace-errors-for-keys',
                          keys: [parameter.key],
                          errors: next.error ? { [parameter.key]: next.error } : {},
                        });
                      }}
                      onUnitChange={(unit) => {
                        const current = state.values[parameter.key];
                        const converted = switchEnteredUnit(
                          typeof current === 'number' ? current : undefined,
                          state.units[parameter.key] ?? parameter.unit?.canonical,
                          unit,
                          parameter.unit,
                        );
                        if (typeof current === 'number' && converted === undefined) {
                          setSubmitError(
                            'That unit conversion is unavailable. The value was not changed.',
                          );
                          return;
                        }
                        dispatch({
                          type: 'set-unit-and-value',
                          key: parameter.key,
                          unit,
                          value: converted,
                        });
                        track('unit_switch', {
                          calculatorSlug: config.calculatorSlug,
                          parameterKey: parameter.key,
                          unit,
                        });
                      }}
                    />
                  </FieldShell>
                );
              })}
            </fieldset>
          ))
        )}
      </section>

      {submitError ? (
        <p className="calculator-submit-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="calculator-actions">
        {currentStep > 0 ? (
          <button type="button" onClick={goBack} disabled={busy}>
            Back
          </button>
        ) : null}
        {currentStep < steps.length - 1 ? (
          <button type="button" onClick={goNext} disabled={busy}>
            Continue
          </button>
        ) : (
          <button type="submit" disabled={busy}>
            {busy ? 'Calculating…' : submitLabel}
          </button>
        )}
        <button type="button" onClick={startOver} disabled={busy}>
          Start over
        </button>
      </div>
    </form>
  );
}
