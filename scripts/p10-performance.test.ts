import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { runPerformanceCheck } from './p10-performance';

const servers: Server[] = [];

async function fixtureServer(options: { readonly assessmentDelayMs?: number } = {}) {
  const app = express();
  app.use(express.json());
  app.get('/api/v1/calculators/performance-fixture', (request, response) => {
    const etag = '"p10-performance-fixture"';
    response.setHeader('ETag', etag);
    if (request.header('if-none-match') === etag) {
      response.status(304).end();
      return;
    }
    response.json({ data: { calculatorSlug: 'performance-fixture', version: 1 } });
  });
  app.post('/api/v1/calculators/performance-fixture/assess', async (_request, response) => {
    if (options.assessmentDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.assessmentDelayMs));
    }
    response.json({ data: { id: 'fixture', score: 0, category: { label: 'fixture' } } });
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server unavailable.');
  return `http://127.0.0.1:${address.port}/api/v1`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe('P10 local assess performance gate', () => {
  it('verifies cold/warm ETag behavior and computes the strict p95 budget', async () => {
    const result = await runPerformanceCheck({
      apiBaseUrl: await fixtureServer(),
      calculatorSlug: 'performance-fixture',
      inputs: { value: 1 },
      requests: 12,
      concurrency: 3,
      p95BudgetMs: 300,
    });
    expect(result).toMatchObject({
      status: 'ok',
      warmCacheStatus: 304,
      requestCount: 12,
      concurrency: 3,
      budgetMs: 300,
    });
    expect(result.assessmentP95Ms).toBeLessThan(300);
  });

  it('fails closed when the p95 budget is exceeded', async () => {
    await expect(
      runPerformanceCheck({
        apiBaseUrl: await fixtureServer({ assessmentDelayMs: 20 }),
        calculatorSlug: 'performance-fixture',
        inputs: { value: 1 },
        requests: 4,
        concurrency: 1,
        p95BudgetMs: 5,
      }),
    ).rejects.toThrow('does not satisfy');
  });
});
