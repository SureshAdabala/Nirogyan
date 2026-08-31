'use client';

import type {
  AdminCalculatorSummary,
  AdminCalculatorVersion,
  AdminCreateCalculatorRequest,
  AdminIdentity,
  AdminTestCase,
  AdminTestRunSummary,
  AdminUpdateCalculatorVersionRequest,
  AdminValidationSummary,
} from '@niro/contracts';
import type {
  AnalyticsEngagementResponse,
  AnalyticsFunnelResponse,
  AnalyticsLeadsResponse,
  AnalyticsOpsResponse,
  AnalyticsOverviewResponse,
  AnalyticsScoresResponse,
  AnalyticsSecurityResponse,
} from '@niro/contracts/analytics-api';

type JsonRecord = Record<string, unknown>;

interface ErrorEnvelope {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly fields?: unknown;
  };
}

interface DataEnvelope<T> extends ErrorEnvelope {
  readonly data?: T;
  readonly validation?: AdminValidationSummary;
  readonly tests?: AdminTestRunSummary;
}

export interface AdminResponse<T> {
  readonly data: T;
  readonly etag?: string;
  readonly validation?: AdminValidationSummary;
  readonly tests?: AdminTestRunSummary;
}

export interface AdminMeasurementRecord extends JsonRecord {
  readonly id: string;
  readonly key: string;
  readonly revision: number;
  readonly status: 'draft' | 'verified' | 'retired';
  readonly displayName: string;
  readonly kind: string;
  readonly canonicalUnit?: string;
  readonly definition: Readonly<JsonRecord>;
  readonly sources: readonly unknown[];
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: unknown;
  readonly retryAfter?: string;

  constructor(options: {
    readonly status: number;
    readonly code?: string;
    readonly message: string;
    readonly fields?: unknown;
    readonly retryAfter?: string;
  }) {
    super(options.message);
    this.name = 'AdminApiError';
    this.status = options.status;
    this.code = options.code ?? 'REQUEST_FAILED';
    this.fields = options.fields;
    this.retryAfter = options.retryAfter;
  }
}

function apiBase(): string {
  const candidate = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('NEXT_PUBLIC_API_BASE_URL must use HTTP or HTTPS.');
  return parsed.toString().replace(/\/$/, '');
}

export function readCsrfCookie(cookie = typeof document === 'undefined' ? '' : document.cookie) {
  const item = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('niro_csrf='));
  return item ? decodeURIComponent(item.slice('niro_csrf='.length)) : undefined;
}

function unsafe(method: string | undefined): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

async function rawRequest<T>(path: string, init: RequestInit = {}): Promise<AdminResponse<T>> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  if (unsafe(init.method)) {
    const csrf = readCsrfCookie();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers,
  });
  const body = (await response.json().catch(() => undefined)) as DataEnvelope<T> | undefined;
  if (!response.ok) {
    throw new AdminApiError({
      status: response.status,
      code: body?.error?.code,
      message: body?.error?.message ?? `Administrative request failed (${response.status}).`,
      fields: body?.error?.fields,
      retryAfter: response.headers.get('retry-after') ?? undefined,
    });
  }
  if (!body || !('data' in body)) {
    if (response.status === 204)
      return { data: undefined as T, etag: response.headers.get('etag') ?? undefined };
    throw new AdminApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The administrative API returned an invalid response.',
    });
  }
  return {
    data: body.data as T,
    etag: response.headers.get('etag') ?? undefined,
    validation: body.validation,
    tests: body.tests,
  };
}

async function refreshSession(): Promise<void> {
  await rawRequest('/admin/auth/refresh', { method: 'POST' });
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAuthentication = true,
): Promise<AdminResponse<T>> {
  try {
    return await rawRequest(path, init);
  } catch (error) {
    if (
      retryAuthentication &&
      error instanceof AdminApiError &&
      error.status === 401 &&
      !path.startsWith('/admin/auth/')
    ) {
      await refreshSession();
      return rawRequest(path, init);
    }
    throw error;
  }
}

export async function login(email: string, password: string): Promise<AdminIdentity> {
  return (
    await adminRequest<{ readonly user: AdminIdentity }>(
      '/admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    )
  ).data.user;
}

export async function logout(): Promise<void> {
  await adminRequest<void>('/admin/auth/logout', { method: 'POST' }, false);
}

export async function currentAdmin(): Promise<AdminIdentity> {
  return (await adminRequest<AdminIdentity>('/admin/me')).data;
}

export async function calculators(): Promise<readonly AdminCalculatorSummary[]> {
  return (await adminRequest<readonly AdminCalculatorSummary[]>('/admin/calculators')).data;
}

export function createCalculator(request: AdminCreateCalculatorRequest): Promise<
  AdminResponse<{
    readonly calculator: AdminCalculatorSummary;
    readonly version: AdminCalculatorVersion;
  }>
> {
  return adminRequest('/admin/calculators', { method: 'POST', body: JSON.stringify(request) });
}

export async function calculatorVersions(slug: string): Promise<readonly AdminCalculatorVersion[]> {
  return (
    await adminRequest<readonly AdminCalculatorVersion[]>(
      `/admin/calculators/${encodeURIComponent(slug)}/versions`,
    )
  ).data;
}

export function calculatorVersion(
  slug: string,
  version: number,
): Promise<AdminResponse<AdminCalculatorVersion>> {
  return adminRequest(
    `/admin/calculators/${encodeURIComponent(slug)}/versions/${encodeURIComponent(String(version))}`,
  );
}

export function createCalculatorVersion(
  slug: string,
  request: Readonly<{
    readonly sourceVersion?: number;
    readonly payload?: Readonly<JsonRecord>;
    readonly measurementRevisionIds?: readonly string[];
  }>,
): Promise<AdminResponse<AdminCalculatorVersion>> {
  return adminRequest(`/admin/calculators/${encodeURIComponent(slug)}/versions`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function saveCalculatorVersion(
  slug: string,
  version: number,
  request: AdminUpdateCalculatorVersionRequest,
  etag: string,
): Promise<AdminResponse<AdminCalculatorVersion>> {
  return adminRequest(`/admin/calculators/${encodeURIComponent(slug)}/versions/${version}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
    headers: { 'If-Match': etag },
  });
}

function versionAction<T>(
  slug: string,
  version: number,
  action: string,
  options: { readonly etag?: string; readonly body?: unknown } = {},
): Promise<AdminResponse<T>> {
  return adminRequest(
    `/admin/calculators/${encodeURIComponent(slug)}/versions/${version}/${action}`,
    {
      method: 'POST',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: options.etag ? { 'If-Match': options.etag } : undefined,
    },
  );
}

export function validateVersion(slug: string, version: number) {
  return versionAction<AdminValidationSummary>(slug, version, 'validate');
}

export function previewVersion(slug: string, version: number, inputs: Readonly<JsonRecord>) {
  return versionAction<{ readonly version: AdminCalculatorVersion; readonly result: JsonRecord }>(
    slug,
    version,
    'preview',
    { body: { inputs } },
  );
}

export function submitReview(slug: string, version: number, etag: string) {
  return versionAction<AdminCalculatorVersion>(slug, version, 'submit-review', { etag });
}

export function approveVersion(slug: string, version: number, etag: string) {
  return versionAction<AdminCalculatorVersion>(slug, version, 'approve', { etag });
}

export function publishVersion(slug: string, version: number, etag: string, changelog: string) {
  return versionAction<AdminCalculatorVersion>(slug, version, 'publish', {
    etag,
    body: { changelog },
  });
}

export function retireVersion(slug: string, version: number, etag: string) {
  return versionAction<AdminCalculatorVersion>(slug, version, 'retire', { etag });
}

export function rollbackVersion(
  slug: string,
  sourceVersion: number,
  publish: boolean,
): Promise<
  AdminResponse<{ readonly version: AdminCalculatorVersion; readonly published: boolean }>
> {
  return adminRequest(`/admin/calculators/${encodeURIComponent(slug)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ sourceVersion, publish }),
  });
}

export async function versionTestCases(slug: string, version: number) {
  return (
    await adminRequest<readonly AdminTestCase[]>(
      `/admin/calculators/${encodeURIComponent(slug)}/versions/${version}/test-cases`,
    )
  ).data;
}

export function saveVersionTestCases(
  slug: string,
  version: number,
  testCases: readonly AdminTestCase[],
  etag: string,
): Promise<
  AdminResponse<{
    readonly version: AdminCalculatorVersion;
    readonly testCases: readonly AdminTestCase[];
  }>
> {
  return adminRequest(
    `/admin/calculators/${encodeURIComponent(slug)}/versions/${version}/test-cases`,
    {
      method: 'PUT',
      body: JSON.stringify({ testCases }),
      headers: { 'If-Match': etag },
    },
  );
}

export function runVersionTestCases(slug: string, version: number) {
  return versionAction<AdminTestRunSummary>(slug, version, 'test-cases/run');
}

export async function biomarkers(): Promise<readonly AdminMeasurementRecord[]> {
  return (await adminRequest<readonly AdminMeasurementRecord[]>('/admin/biomarkers')).data;
}

export interface AdminAuditRecord {
  readonly id: string;
  readonly actorId?: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly diffSummary?: Readonly<JsonRecord>;
  readonly createdAt: string;
}

export interface AdminAuditFilters {
  readonly actor?: string;
  readonly action?: string;
  readonly slug?: string;
  readonly from?: string;
  readonly to?: string;
}

export async function auditRecords(
  filters: AdminAuditFilters = {},
): Promise<readonly AdminAuditRecord[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  return (await adminRequest<readonly AdminAuditRecord[]>(`/admin/audit${suffix}`)).data;
}

export interface AnalyticsDateRange {
  readonly from: string;
  readonly to: string;
}

function analyticsRangeQuery(range: AnalyticsDateRange): string {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  return query.toString();
}

export async function analyticsOverview(
  range: AnalyticsDateRange,
): Promise<AnalyticsOverviewResponse> {
  return (
    await adminRequest<AnalyticsOverviewResponse>(
      `/admin/analytics/overview?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsEngagement(
  range: AnalyticsDateRange,
): Promise<AnalyticsEngagementResponse> {
  return (
    await adminRequest<AnalyticsEngagementResponse>(
      `/admin/analytics/engagement?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsFunnel(
  calculatorSlug: string,
  range: AnalyticsDateRange,
): Promise<AnalyticsFunnelResponse> {
  return (
    await adminRequest<AnalyticsFunnelResponse>(
      `/admin/analytics/funnel/${encodeURIComponent(calculatorSlug)}?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsScores(
  calculatorSlug: string,
  range: AnalyticsDateRange,
): Promise<AnalyticsScoresResponse> {
  return (
    await adminRequest<AnalyticsScoresResponse>(
      `/admin/analytics/scores/${encodeURIComponent(calculatorSlug)}?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsLeads(range: AnalyticsDateRange): Promise<AnalyticsLeadsResponse> {
  return (
    await adminRequest<AnalyticsLeadsResponse>(
      `/admin/analytics/leads?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsSecurity(
  range: AnalyticsDateRange,
): Promise<AnalyticsSecurityResponse> {
  return (
    await adminRequest<AnalyticsSecurityResponse>(
      `/admin/analytics/security?${analyticsRangeQuery(range)}`,
    )
  ).data;
}

export async function analyticsOperations(): Promise<AnalyticsOpsResponse> {
  return (await adminRequest<AnalyticsOpsResponse>('/admin/analytics/ops')).data;
}

export type AnalyticsExportKind = 'leads' | 'assessments';

export interface AnalyticsCsvDownload {
  readonly blob: Blob;
  readonly filename: string;
}

function exportFilename(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  try {
    const candidate = encoded ? decodeURIComponent(encoded) : plain;
    return candidate && /^[A-Za-z0-9._-]+\.csv$/i.test(candidate) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

async function csvRequest(path: string, retryAuthentication = true): Promise<Response> {
  const response = await fetch(`${apiBase()}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { accept: 'text/csv' },
  });
  if (response.status === 401 && retryAuthentication) {
    await refreshSession();
    return csvRequest(path, false);
  }
  if (!response.ok) {
    throw new AdminApiError({
      status: response.status,
      code: 'EXPORT_FAILED',
      message: `The analytics export could not be generated (${response.status}).`,
      retryAfter: response.headers.get('retry-after') ?? undefined,
    });
  }
  return response;
}

export async function downloadAnalyticsExport(
  kind: AnalyticsExportKind,
  range: AnalyticsDateRange,
  calculatorSlug?: string,
): Promise<AnalyticsCsvDownload> {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  if (kind === 'assessments' && calculatorSlug) query.set('calculator', calculatorSlug);
  const response = await csvRequest(`/admin/analytics/exports/${kind}.csv?${query.toString()}`);
  return {
    blob: await response.blob(),
    filename: exportFilename(response, `niro-${kind}-${range.from}-${range.to}.csv`),
  };
}
