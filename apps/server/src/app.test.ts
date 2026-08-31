import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createApp, redactCapabilityUrl, safeRequestLogUrl } from './app';
import { loadEnvironment } from './config/env';

describe('server foundation', () => {
  it('creates an Express app with health endpoints', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }));
    const server = app.listen(0);

    try {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('Test server did not expose a TCP address');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      await expect(response.json()).resolves.toMatchObject({
        status: 'ok',
        releaseId: 'local-unversioned',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('mounts the injected public-test catalog only when the local development gate is enabled', async () => {
    const testRecord = {
      id: 'draft-version-id',
      calculatorSlug: 'draft-calculator',
      version: 3,
      releaseState: 'testing-unapproved' as const,
      payload: {
        name: 'Draft calculator',
        shortDescription: 'Live development draft.',
        disclaimers: ['Testing only.'],
      },
    };
    const testBiomarker = {
      key: 'draft-marker',
      revision: 2,
      status: 'draft',
      displayName: 'Draft marker',
      kind: 'biomarker',
      definition: {
        schemaVersion: 'measurement-definition.v1',
        key: 'draft-marker',
        version: 2,
        status: 'draft',
        displayName: 'Draft marker',
        kind: 'laboratory-biomarker',
        canonicalUnit: {
          code: 'mg/dL',
          dimension: 'mass-concentration',
          display: 'mg/dL',
        },
        sources: [],
      },
      sources: [],
    };
    const options = {
      catalog: {
        listPublished: async () => [testRecord],
        getPublished: async (slug: string) =>
          slug === testRecord.calculatorSlug ? testRecord : undefined,
      },
      biomarker: {
        list: async () => [testBiomarker],
        get: async (key: string) => (key === testBiomarker.key ? testBiomarker : undefined),
      },
    };
    const disabled = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, options);
    const disabledServer = disabled.listen(0);
    const enabled = createApp(
      loadEnvironment({
        NODE_ENV: 'development',
        PUBLIC_TEST_CATALOG_ENABLED: 'true',
        HOST: '127.0.0.1',
        CORS_ORIGINS: 'http://localhost:3000',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB_NAME: 'niro_dev',
      }),
      undefined,
      options,
    );
    const enabledServer = enabled.listen(0);

    try {
      const disabledAddress = disabledServer.address();
      const enabledAddress = enabledServer.address();
      if (
        !disabledAddress ||
        typeof disabledAddress === 'string' ||
        !enabledAddress ||
        typeof enabledAddress === 'string'
      )
        throw new Error('Test server did not expose a TCP address');

      const disabledResponse = await fetch(
        `http://127.0.0.1:${disabledAddress.port}/api/v1/public-test/calculators`,
      );
      expect(disabledResponse.status).toBe(404);

      const calculatorResponse = await fetch(
        `http://127.0.0.1:${enabledAddress.port}/api/v1/public-test/calculators`,
      );
      expect(calculatorResponse.status).toBe(200);
      expect(calculatorResponse.headers.get('cache-control')).toBe('no-store');
      expect(calculatorResponse.headers.get('x-robots-tag')).toContain('noindex');
      expect(calculatorResponse.headers.get('x-niro-mode')).toBe('public-testing');
      await expect(calculatorResponse.json()).resolves.toMatchObject({
        data: [
          {
            calculatorSlug: 'draft-calculator',
            releaseState: 'testing-unapproved',
          },
        ],
      });

      const biomarkerResponse = await fetch(
        `http://127.0.0.1:${enabledAddress.port}/api/v1/public-test/biomarkers`,
      );
      expect(biomarkerResponse.status).toBe(200);
      expect(biomarkerResponse.headers.get('x-niro-mode')).toBe('public-testing');
      await expect(biomarkerResponse.json()).resolves.toMatchObject({
        data: [{ key: 'draft-marker', releaseState: 'testing-unapproved' }],
      });
    } finally {
      await Promise.all(
        [disabledServer, enabledServer].map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
      );
    }
  });

  it('keeps fleet metrics disabled by default and bearer-protects configured scraping', async () => {
    const token = 'metrics-token-that-is-at-least-thirty-two-characters';
    const disabled = createApp(loadEnvironment({ NODE_ENV: 'test' }));
    const disabledServer = disabled.listen(0);
    const enabled = createApp(loadEnvironment({ NODE_ENV: 'test', METRICS_SCRAPE_TOKEN: token }));
    const enabledServer = enabled.listen(0);
    try {
      const disabledAddress = disabledServer.address();
      const enabledAddress = enabledServer.address();
      if (
        disabledAddress === null ||
        typeof disabledAddress === 'string' ||
        enabledAddress === null ||
        typeof enabledAddress === 'string'
      ) {
        throw new Error('Test server did not expose a TCP address');
      }
      expect((await fetch(`http://127.0.0.1:${disabledAddress.port}/metrics`)).status).toBe(404);
      expect((await fetch(`http://127.0.0.1:${enabledAddress.port}/metrics`)).status).toBe(401);
      const response = await fetch(`http://127.0.0.1:${enabledAddress.port}/metrics`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(await response.text()).toContain('niro_http_requests_total');
    } finally {
      await Promise.all(
        [disabledServer, enabledServer].map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
      );
    }
  });

  it('exposes concurrency and retry headers to the credentialed Studio origin', async () => {
    const app = createApp(
      loadEnvironment({ NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:3000' }),
    );
    const server = app.listen(0);
    try {
      const address = server.address();
      if (address === null || typeof address === 'string')
        throw new Error('Test server did not expose a TCP address');
      const response = await fetch(`http://127.0.0.1:${address.port}/healthz`, {
        headers: { origin: 'http://localhost:3000' },
      });
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-expose-headers')).toContain('ETag');
      expect(response.headers.get('access-control-expose-headers')).toContain('Retry-After');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('does not charge administrative traffic to the public assessment rate limit', async () => {
    const app = createApp(loadEnvironment({ NODE_ENV: 'test' }), undefined, {
      rateLimit: { max: 1, windowMs: 60_000 },
    });
    const server = app.listen(0);
    try {
      const address = server.address();
      if (address === null || typeof address === 'string')
        throw new Error('Test server did not expose a TCP address');
      const url = `http://127.0.0.1:${address.port}/api/v1/admin/calculators`;
      const first = await fetch(url);
      const second = await fetch(url);
      expect(first.status).toBe(503);
      expect(second.status).toBe(503);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('logs only a query-free capability-redacted request path and omits identifying headers', async () => {
    // Deliberately malformed so the route rejects it before any persistence lookup.
    const token = `${'A'.repeat(41)}.`;
    const requestLogStream = new PassThrough();
    let logs = '';
    requestLogStream.on('data', (chunk: Buffer) => {
      logs += chunk.toString('utf8');
    });
    const app = createApp(loadEnvironment({ NODE_ENV: 'test', LOG_LEVEL: 'info' }), undefined, {
      requestLogStream,
    });
    const server = app.listen(0);

    try {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('Test server did not expose a TCP address');
      }
      const privateQuery = 'private-medical-search-phrase';
      const privateAgent = 'PrivateBrowser/123.45 identifying-agent';
      const privateLocale = 'xx-PRIVATE-secret';
      const privateReferrer = `https://public.example.test/person@example.test/results/${token}`;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/results/${token}/?search=${privateQuery}`,
        {
          headers: {
            referer: privateReferrer,
            'user-agent': privateAgent,
            'accept-language': privateLocale,
          },
        },
      );
      expect(response.status).toBe(404);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(logs).not.toContain(token);
      expect(logs).not.toContain(privateQuery);
      expect(logs).not.toContain(privateAgent);
      expect(logs).not.toContain(privateLocale);
      expect(logs).not.toContain(privateReferrer);
      expect(logs).not.toContain('person@example.test');
      expect(logs).toContain('/api/v1/results/[REDACTED]');
      expect(safeRequestLogUrl(`/api/v1/results/${token}?search=${privateQuery}`)).toBe(
        '/api/v1/results/[REDACTED]',
      );
      expect(redactCapabilityUrl(`/api/v1/results/${token}?source=test`)).toBe(
        '/api/v1/results/[REDACTED]?source=test',
      );
      expect(redactCapabilityUrl(`/api/v1/results/${token}/unexpected`)).toBe(
        '/api/v1/results/[REDACTED]/unexpected',
      );
      expect(redactCapabilityUrl(`/api/v1/results/${'B'.repeat(43)}`)).toBe(
        '/api/v1/results/[REDACTED]',
      );
      expect(redactCapabilityUrl(`https://public.example.test/results/${token}?from=test`)).toBe(
        'https://public.example.test/results/[REDACTED]?from=test',
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
