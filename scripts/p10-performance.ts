import { randomUUID } from 'node:crypto';

export interface PerformanceCheckOptions {
  readonly apiBaseUrl: string;
  readonly calculatorSlug: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly requests?: number;
  readonly concurrency?: number;
  readonly p95BudgetMs?: number;
}

export interface PerformanceCheckResult {
  readonly status: 'ok';
  readonly calculatorSlug: string;
  readonly coldConfigMs: number;
  readonly warmConfigMs: number;
  readonly warmCacheStatus: 304;
  readonly requestCount: number;
  readonly concurrency: number;
  readonly assessmentP50Ms: number;
  readonly assessmentP95Ms: number;
  readonly assessmentMaxMs: number;
  readonly budgetMs: number;
}

function finitePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be positive.`);
  return value;
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<{
  readonly response: Response;
  readonly durationMs: number;
}> {
  const startedAt = performance.now();
  const response = await fetch(url, init);
  return { response, durationMs: performance.now() - startedAt };
}

export async function runPerformanceCheck(
  options: PerformanceCheckOptions,
): Promise<PerformanceCheckResult> {
  const requests = finitePositiveInteger(options.requests ?? 40, 'requests');
  const concurrency = finitePositiveInteger(options.concurrency ?? 4, 'concurrency');
  const budgetMs = options.p95BudgetMs ?? 300;
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) throw new Error('p95BudgetMs must be positive.');
  const apiBaseUrl = options.apiBaseUrl.replace(/\/$/u, '');
  const configUrl = `${apiBaseUrl}/calculators/${encodeURIComponent(options.calculatorSlug)}`;
  const cold = await timedFetch(configUrl, { headers: { 'cache-control': 'no-cache' } });
  if (cold.response.status !== 200) {
    throw new Error(`Cold config request failed with ${cold.response.status}.`);
  }
  const etag = cold.response.headers.get('etag');
  if (!etag) throw new Error('Cold config response did not provide an ETag.');
  await cold.response.arrayBuffer();
  const warm = await timedFetch(configUrl, { headers: { 'if-none-match': etag } });
  if (warm.response.status !== 304) {
    throw new Error(`Warm config revalidation returned ${warm.response.status}, expected 304.`);
  }

  const durations = new Array<number>(requests);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < requests) {
      const index = next++;
      const idempotencyKey = `p10-perf-${randomUUID()}`;
      const measured = await timedFetch(
        `${apiBaseUrl}/calculators/${encodeURIComponent(options.calculatorSlug)}/assess`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({ inputs: options.inputs }),
        },
      );
      await measured.response.arrayBuffer();
      if (measured.response.status !== 200) {
        throw new Error(`Assessment ${index + 1} failed with ${measured.response.status}.`);
      }
      durations[index] = measured.durationMs;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, requests) }, async () => await worker()),
  );
  const sorted = durations.slice().sort((left, right) => left - right);
  const p95 = percentile(sorted, 0.95);
  if (p95 >= budgetMs) {
    throw new Error(
      `Assessment p95 ${rounded(p95)}ms does not satisfy the strict < ${budgetMs}ms budget.`,
    );
  }
  return {
    status: 'ok',
    calculatorSlug: options.calculatorSlug,
    coldConfigMs: rounded(cold.durationMs),
    warmConfigMs: rounded(warm.durationMs),
    warmCacheStatus: 304,
    requestCount: requests,
    concurrency,
    assessmentP50Ms: rounded(percentile(sorted, 0.5)),
    assessmentP95Ms: rounded(p95),
    assessmentMaxMs: rounded(sorted.at(-1) ?? 0),
    budgetMs,
  };
}

async function main(): Promise<void> {
  const apiBaseUrl = process.env.P10_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
  const calculatorSlug = process.env.P10_CALCULATOR_SLUG;
  const inputText = process.env.P10_PERFORMANCE_INPUTS;
  if (!calculatorSlug || !inputText) {
    throw new Error('P10_CALCULATOR_SLUG and P10_PERFORMANCE_INPUTS are required.');
  }
  const inputs = JSON.parse(inputText) as unknown;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new Error('P10_PERFORMANCE_INPUTS must be a JSON object.');
  }
  console.log(
    JSON.stringify(
      await runPerformanceCheck({
        apiBaseUrl,
        calculatorSlug,
        inputs: inputs as Record<string, unknown>,
        requests: Number(process.env.P10_PERFORMANCE_REQUESTS ?? 40),
        concurrency: Number(process.env.P10_PERFORMANCE_CONCURRENCY ?? 4),
        p95BudgetMs: Number(process.env.P10_PERFORMANCE_P95_MS ?? 300),
      }),
    ),
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
