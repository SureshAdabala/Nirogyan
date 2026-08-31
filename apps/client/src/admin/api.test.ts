// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  adminRequest,
  analyticsFunnel,
  downloadAnalyticsExport,
  login,
  readCsrfCookie,
  saveCalculatorVersion,
} from './api';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  });
}

describe('admin API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    document.cookie = 'niro_csrf=; Max-Age=0; Path=/';
  });

  it('reads the browser-readable CSRF cookie without touching HttpOnly credentials', () => {
    expect(readCsrfCookie('other=1; niro_csrf=bound%20token; theme=light')).toBe('bound token');
    expect(readCsrfCookie('other=1')).toBeUndefined();
  });

  it('uses credentialed no-store requests, CSRF, If-Match, and exposed ETags', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    document.cookie = 'niro_csrf=csrf-value; Path=/';
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          data: {
            id: 'version-id',
            calculatorSlug: 'safe-fixture',
            version: 1,
            status: 'draft',
            payload: {},
            measurements: { revisionIds: [], count: 0 },
          },
        },
        { headers: { ETag: '"next-etag"' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await saveCalculatorVersion(
      'safe-fixture',
      1,
      { payload: {}, measurementRevisionIds: [] },
      '"current-etag"',
    );

    expect(response.etag).toBe('"next-etag"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect(headers.get('x-csrf-token')).toBe('csrf-value');
    expect(headers.get('if-match')).toBe('"current-etag"');
  });

  it('refreshes a cookie session once on 401 and retries the original request', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    document.cookie = 'niro_csrf=csrf-value; Path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { user: { id: 'a', email: 'a@example.test', role: 'admin' } } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminRequest<readonly unknown[]>('/admin/calculators');

    expect(response.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:4000/api/v1/admin/auth/refresh');
  });

  it('does not retry rejected login credentials', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' } },
          { status: 401 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('admin@example.test', 'wrong')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('encodes analytics filters and downloads credentialed CSV without parsing it as JSON', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            calculatorSlug: 'heart-risk',
            range: { from: '2026-08-01', to: '2026-08-30', timezone: 'Asia/Kolkata' },
            stages: [],
            steps: [],
            completionRate: 0,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response('assessmentId,calculatorSlug\n', {
          status: 200,
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="safe-assessments.csv"',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await analyticsFunnel('heart-risk', { from: '2026-08-01', to: '2026-08-30' });
    const file = await downloadAnalyticsExport(
      'assessments',
      { from: '2026-08-01', to: '2026-08-30' },
      'heart-risk',
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/v1/admin/analytics/funnel/heart-risk?from=2026-08-01&to=2026-08-30',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:4000/api/v1/admin/analytics/exports/assessments.csv?from=2026-08-01&to=2026-08-30&calculator=heart-risk',
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).credentials).toBe('include');
    expect(file.filename).toBe('safe-assessments.csv');
    expect(await file.blob.text()).toContain('calculatorSlug');
  });
});
