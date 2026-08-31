import { orderedRenderableParameters, visibleParameterKeys } from './structure';
import type {
  AssessmentInput,
  AssessmentPayload,
  AssessmentPayloadWithoutIdempotency,
  PublicCalculatorConfig,
  RendererState,
  ServerFieldMap,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildAssessmentPayload(
  config: PublicCalculatorConfig,
  state: RendererState,
): AssessmentPayloadWithoutIdempotency {
  const visible = visibleParameterKeys(config, state);
  const inputs: Record<string, AssessmentInput> = {};
  const omitted: string[] = [];
  for (const parameter of orderedRenderableParameters(config)) {
    if (!visible.has(parameter.key)) continue;
    if (state.skipped[parameter.key] === true) {
      omitted.push(parameter.key);
      continue;
    }
    const value = state.values[parameter.key];
    if (value === undefined || value === '') continue;
    if (parameter.inputType === 'number' && typeof value === 'number' && parameter.unit) {
      inputs[parameter.key] = {
        value,
        unit: state.units[parameter.key] ?? parameter.unit.canonical,
      };
    } else {
      inputs[parameter.key] = value;
    }
  }
  omitted.sort((left, right) => left.localeCompare(right, 'en'));
  return { inputs, omitted };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function assessmentPayloadFingerprint(payload: AssessmentPayloadWithoutIdempotency): string {
  return JSON.stringify(stableValue(payload));
}

function secureIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `assessment-${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }
  throw new Error('Secure browser randomness is unavailable; assessment was not submitted.');
}

export interface IdempotencyManager {
  readonly payloadChanged: (payload: AssessmentPayloadWithoutIdempotency) => void;
  readonly attach: (payload: AssessmentPayloadWithoutIdempotency) => AssessmentPayload;
  readonly succeeded: (payload: AssessmentPayloadWithoutIdempotency) => void;
}

export function createIdempotencyManager(
  keyFactory: () => string = secureIdempotencyKey,
): IdempotencyManager {
  let active: { readonly fingerprint: string; readonly key: string } | undefined;
  return {
    payloadChanged(payload) {
      const fingerprint = assessmentPayloadFingerprint(payload);
      if (active && active.fingerprint !== fingerprint) active = undefined;
    },
    attach(payload) {
      const fingerprint = assessmentPayloadFingerprint(payload);
      if (!active || active.fingerprint !== fingerprint) {
        active = { fingerprint, key: keyFactory() };
      }
      return { ...payload, idempotencyKey: active.key };
    },
    succeeded(payload) {
      const fingerprint = assessmentPayloadFingerprint(payload);
      if (active?.fingerprint === fingerprint) active = undefined;
    },
  };
}

export function mapServerFieldErrors(
  fields: ServerFieldMap | undefined,
  knownKeys?: ReadonlySet<string>,
): Readonly<Record<string, string>> {
  if (!fields) return {};
  const mapped: Record<string, string> = {};
  for (const [path, finding] of Object.entries(fields)) {
    const match = /^inputs\.([A-Za-z][A-Za-z0-9_-]*)(?:\..+)?$/.exec(path);
    const key = match?.[1];
    if (!key || (knownKeys && !knownKeys.has(key))) continue;
    const message =
      typeof finding === 'string'
        ? finding
        : typeof finding.message === 'string'
          ? finding.message
          : undefined;
    if (message?.trim()) mapped[key] = message;
  }
  return mapped;
}

export function serverFieldsFromError(error: unknown): ServerFieldMap | undefined {
  if (!isRecord(error)) return undefined;
  if (isRecord(error.fields)) return error.fields as ServerFieldMap;
  if (isRecord(error.error) && isRecord(error.error.fields)) {
    return error.error.fields as ServerFieldMap;
  }
  if (isRecord(error.body) && isRecord(error.body.error) && isRecord(error.body.error.fields)) {
    return error.body.error.fields as ServerFieldMap;
  }
  return undefined;
}

export function submissionErrorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : undefined;
  if (message && isRecord(error) && typeof error.retryAfter === 'string') {
    return /^\d+$/.test(error.retryAfter)
      ? `${message} Try again in ${error.retryAfter} seconds.`
      : `${message} Try again after ${error.retryAfter}.`;
  }
  if (message) return message;
  return 'Assessment could not be submitted. Check your entries and try again.';
}
