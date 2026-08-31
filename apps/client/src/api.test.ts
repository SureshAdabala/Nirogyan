import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest, fieldErrorsFromApi, publicBiomarker, publicBiomarkers } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('public API client', () => {
  it('retains status, code, fields, and Retry-After on an API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Review the fields.',
              fields: { 'inputs.age': { message: 'Age is invalid.' } },
            },
          }),
          { status: 422, headers: { 'content-type': 'application/json', 'retry-after': '9' } },
        ),
      ),
    );

    const error = await apiRequest('/anything').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      retryAfter: '9',
      fields: { 'inputs.age': { message: 'Age is invalid.' } },
    });
  });

  it('maps only input paths, including nested unit findings, to owning fields', () => {
    expect(
      fieldErrorsFromApi({
        'inputs.age': { message: 'Required.' },
        'inputs.glucose.unit': { message: 'Choose a supported unit.' },
        parameters: { message: 'Protected config issue.' },
        'inputs.invalid key': { message: 'Ignored.' },
      }),
    ).toEqual({ age: 'Required.', glucose: 'Choose a supported unit.' });
  });

  it('rejects a success response without a data envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );
    await expect(apiRequest('/anything')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('encodes composed biomarker list filters and detail keys safely', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await publicBiomarkers({ search: ' fasting glucose ', domain: 'metabolic' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/v1/biomarkers?search=fasting+glucose&domain=metabolic',
    );

    await publicBiomarker('marker/with separator');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:4000/api/v1/biomarkers/marker%2Fwith%20separator',
    );
  });

  it('forces uncached requests and drops Next revalidation metadata in public-test mode', async () => {
    vi.stubEnv('API_BASE_URL', 'http://localhost:4000/api/v1/public-test');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1/public-test');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/calculators', { next: { revalidate: 30, tags: ['calculators'] } });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('next');
  });
});
