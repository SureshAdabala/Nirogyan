import type {
  PublicAssessmentRequest,
  PublicAssessmentResponse,
  PublicBiomarkerDetail,
  PublicBiomarkerSummary,
  PublicCalculatorConfig,
  PublicCalculatorSummary,
  PublicLeadRequest,
  PublicSharedResult,
} from '@niro/contracts';

export type {
  PublicAssessmentRequest,
  PublicAssessmentResponse as AssessmentResponse,
  PublicBiomarkerDetail,
  PublicBiomarkerSummary,
  PublicCalculatorConfig as CalculatorConfig,
  PublicCalculatorSummary,
  PublicSharedResult,
};

interface ApiErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly fields?: Readonly<Record<string, unknown>>;
  };
}

export type ApiFetchInit = RequestInit & {
  readonly next?: { readonly revalidate?: number | false; readonly tags?: readonly string[] };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly retryAfter?: string;

  constructor(options: {
    readonly status: number;
    readonly code?: string;
    readonly message: string;
    readonly fields?: Readonly<Record<string, unknown>>;
    readonly retryAfter?: string;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code ?? 'REQUEST_FAILED';
    this.fields = options.fields;
    this.retryAfter = options.retryAfter;
  }
}

function configuredApiBase(): string {
  const configured =
    typeof window === 'undefined'
      ? (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL)
      : process.env.NEXT_PUBLIC_API_BASE_URL;
  const candidate = configured ?? 'http://localhost:4000/api/v1';
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('The configured public API base URL must be an absolute URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('The configured public API base URL must use HTTP or HTTPS.');
  return parsed.toString().replace(/\/$/, '');
}

export async function apiRequest<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const apiBase = configuredApiBase();
  const publicTestRelease = new URL(apiBase).pathname.replace(/\/+$/, '').endsWith('/public-test');
  const { next: _next, ...standardInit } = init ?? {};
  void _next;
  const effectiveInit: ApiFetchInit = publicTestRelease
    ? { ...standardInit, cache: 'no-store' }
    : (init ?? {});
  const response = await fetch(`${apiBase}${path}`, {
    ...effectiveInit,
    headers: {
      accept: 'application/json',
      ...(effectiveInit.body ? { 'content-type': 'application/json' } : {}),
      ...effectiveInit.headers,
    },
  });
  const body = (await response.json().catch(() => undefined)) as
    ({ readonly data?: T } & ApiErrorBody) | undefined;
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after') ?? undefined;
    throw new ApiError({
      status: response.status,
      code: body?.error?.code,
      message: body?.error?.message ?? `Request failed (${response.status}).`,
      fields: body?.error?.fields,
      retryAfter,
    });
  }
  if (!body || !('data' in body))
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The server returned an invalid response.',
    });
  return body.data as T;
}

export function publicCalculators(
  init?: ApiFetchInit,
): Promise<readonly PublicCalculatorSummary[]> {
  return apiRequest('/calculators', init);
}

export function publicCalculator(
  slug: string,
  init?: ApiFetchInit,
): Promise<PublicCalculatorConfig> {
  return apiRequest(`/calculators/${encodeURIComponent(slug)}`, init);
}

export function assessCalculator(
  slug: string,
  request: PublicAssessmentRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PublicAssessmentResponse> {
  return apiRequest(`/calculators/${encodeURIComponent(slug)}/assess`, {
    method: 'POST',
    body: JSON.stringify(request),
    headers: { 'Idempotency-Key': idempotencyKey },
    signal,
  });
}

export function sharedResult(token: string, init?: ApiFetchInit): Promise<PublicSharedResult> {
  return apiRequest(`/results/${encodeURIComponent(token)}`, init);
}

export function publicBiomarkers(
  query: Readonly<{ readonly search?: string; readonly domain?: string }> = {},
  init?: ApiFetchInit,
): Promise<readonly PublicBiomarkerSummary[]> {
  const parameters = new URLSearchParams();
  const search = query.search?.trim();
  const domain = query.domain?.trim();
  if (search) parameters.set('search', search);
  if (domain) parameters.set('domain', domain);
  const suffix = parameters.size ? `?${parameters.toString()}` : '';
  return apiRequest(`/biomarkers${suffix}`, init);
}

export function publicBiomarker(key: string, init?: ApiFetchInit): Promise<PublicBiomarkerDetail> {
  return apiRequest(`/biomarkers/${encodeURIComponent(key)}`, init);
}

export function submitLead(request: PublicLeadRequest): Promise<{ readonly accepted: true }> {
  return apiRequest('/leads', { method: 'POST', body: JSON.stringify(request) });
}

export function fieldErrorsFromApi(
  fields: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, string>> {
  if (!fields) return {};
  const output: Record<string, string> = {};
  for (const [path, finding] of Object.entries(fields)) {
    const match = /^inputs\.([A-Za-z][A-Za-z0-9_-]*)(?:\..+)?$/.exec(path);
    if (!match?.[1] || typeof finding !== 'object' || finding === null || Array.isArray(finding))
      continue;
    const message = (finding as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) output[match[1]] = message;
  }
  return output;
}
