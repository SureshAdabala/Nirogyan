import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('P10 and P11 validation wiring', () => {
  it('runs the k6 scenario inside the guarded live-fixture lifetime', () => {
    const packageManifest = read('package.json');
    const orchestrator = read('scripts/p10-e2e.ts');
    const workflow = read('.github/workflows/p10-gate.yml');
    const continuousIntegration = read('.github/workflows/ci.yml');

    expect(packageManifest).toContain('"p10:k6": "k6 run tests/performance/public-assess.k6.js"');
    expect(workflow).toContain('uses: grafana/setup-k6-action@v1');
    expect(workflow).toContain("k6-version: '1.7.1'");
    expect(workflow).toContain("P10_RUN_K6: 'true'");
    expect(continuousIntegration).toContain('uses: grafana/setup-k6-action@v1');
    expect(continuousIntegration).toContain("P10_RUN_K6: 'true'");
    expect(orchestrator).toContain("resolve(evidenceDirectory, 'k6-summary.json')");
    expect(orchestrator.indexOf("'k6'")).toBeLessThan(orchestrator.indexOf('await cleanup('));
    expect(orchestrator).toContain('K6_NO_USAGE_REPORT');
  });

  it('reads k6 response headers case-insensitively before ETag revalidation', () => {
    const scenario = read('tests/performance/public-assess.k6.js');

    expect(scenario).toContain('name.toLowerCase() === expected');
    expect(scenario).toContain("const etag = responseHeader(cold, 'etag')");
    expect(scenario).toContain(
      "if (!etag) throw new Error('Cold configuration response omitted its ETag.')",
    );
  });

  it('isolates the two live performance samplers without raising the production quota', () => {
    const orchestrator = read('scripts/p10-e2e.ts');
    const k6Completion = orchestrator.indexOf(
      "await waitForChild(k6, 'k6 P10 performance scenario')",
    );
    const restart = orchestrator.indexOf("server = startApiServer('api-server-node-performance')");
    const nodeSampler = orchestrator.indexOf('performance = await runPerformanceCheck');

    expect(k6Completion).toBeGreaterThan(-1);
    expect(restart).toBeGreaterThan(k6Completion);
    expect(nodeSampler).toBeGreaterThan(restart);
    expect(orchestrator).not.toMatch(/rateLimit:\s*\{\s*max:/u);
  });

  it('does not report a skipped Atlas browser gate as passing CI', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toContain("if: env.P10_ATLAS_CONFIGURED != 'true'");
    expect(workflow).toContain('a skipped live gate is not a passing release gate.');
    expect(workflow).toMatch(/P10_ATLAS_CONFIGURED[\s\S]*?exit 1/u);
  });

  it('archives mirrored child logs as part of both passing and failing evidence', () => {
    const orchestrator = read('scripts/p10-e2e.ts');
    expect(orchestrator).toContain('spawnWithEvidence');
    expect(orchestrator.match(/childProcessLogs/gu)).toHaveLength(2);
    expect(orchestrator).toContain('await entry.logsFlushed');
  });

  it('keeps browser, cleanup, runtime, and hash evidence inside each run-scoped archive', () => {
    const orchestrator = read('scripts/p10-e2e.ts');
    const playwrightConfig = read('playwright.config.ts');
    const workflow = read('.github/workflows/p10-gate.yml');

    expect(orchestrator).toContain("resolve(evidenceDirectory, 'playwright-artifacts')");
    expect(orchestrator).toContain("resolve(evidenceDirectory, 'atlas-cleanup-verification.json')");
    expect(orchestrator).toContain("resolve(evidenceDirectory, 'archive-manifest.json')");
    expect(orchestrator).toContain('protectedImplementationSha256');
    expect(orchestrator).toContain('artifacts: await artifactManifest(evidenceDirectory)');
    expect(playwrightConfig).toContain('P10_PLAYWRIGHT_OUTPUT_DIR');
    expect(playwrightConfig).toContain('P10_PLAYWRIGHT_REPORT_DIR');
    expect(workflow).toContain('tmp/p10-evidence');
    expect(workflow).not.toContain('tmp/p10-playwright');
  });

  it('retains exact cleanup authority before the first fixture write', () => {
    const orchestrator = read('scripts/p10-e2e.ts');
    const authorization = orchestrator.indexOf(
      'authorization = authorizeP7FixtureWrites(environment, nonce, [WRITE_OPT_IN])',
    );
    const fixtureWrite = orchestrator.indexOf('await seed(environment, nonce, authorization)');

    expect(authorization).toBeGreaterThan(-1);
    expect(fixtureWrite).toBeGreaterThan(authorization);
  });

  it('validates the Next.js client in production mode so response headers match deployment', () => {
    const orchestrator = read('scripts/p10-e2e.ts');

    expect(orchestrator).toContain("['build', 'apps/client']");
    expect(orchestrator).toContain(
      "await waitForChild(clientStage, 'Isolated P10 Next.js standalone staging')",
    );
    expect(orchestrator).toContain(
      '`apps/client/${nextDistDirectoryName}/standalone/apps/client/server.js`',
    );
    expect(orchestrator).toContain(
      "await waitForChild(clientBuild, 'Isolated P10 Next.js production build')",
    );
    expect(orchestrator).toContain("HOSTNAME: '127.0.0.1'");
    expect(orchestrator).toContain('NEXT_PUBLIC_RELEASE_ID: executionId');
    expect(orchestrator).not.toContain("['dev', 'apps/client'");
    expect(orchestrator).not.toContain("['start', 'apps/client'");
  });

  it('keeps the quarterly public crawl non-secret and read-only', () => {
    const packageManifest = read('package.json');
    const workflow = read('.github/workflows/quarterly-public-link-check.yml');

    expect(packageManifest).toContain(
      '"p11:links": "tsx scripts/p10-link-check.ts --public-only --external"',
    );
    expect(workflow).toContain("cron: '17 4 1 1,4,7,10 *'");
    expect(workflow).toContain('P11_PUBLIC_SITE_URL: ${{ vars.P11_PUBLIC_SITE_URL }}');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('npm ci --ignore-scripts');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/secrets\.|contents:\s*write|\bPOST\b/iu);
  });
});
