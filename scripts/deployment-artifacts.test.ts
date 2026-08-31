import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function readClientContentSecurityPolicy(
  nodeEnv: 'development' | 'production',
  publicApiBaseUrl = '',
): string {
  const configUrl = pathToFileURL('apps/client/next.config.mjs').href;
  const script = `
    import config from ${JSON.stringify(configUrl)};
    const rules = await config.headers();
    const header = rules
      .flatMap((rule) => rule.headers)
      .find(({ key }) => key === 'Content-Security-Policy');
    if (!header) process.exit(1);
    process.stdout.write(header.value);
  `;
  return execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: nodeEnv,
      NEXT_PUBLIC_API_BASE_URL: publicApiBaseUrl,
    },
  });
}

describe('provider-neutral deployment artifacts', () => {
  it('selects a direct Node deployment and keeps container assets non-selected', () => {
    const rootPackage = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    const clientPackage = JSON.parse(read('apps/client/package.json')) as {
      scripts: Record<string, string>;
    };
    const processes = JSON.parse(read('deploy/native/processes.json')) as {
      selectedDeploymentMode: string;
      containersRequired: boolean;
      runtime: { node: string; packageManager: string };
      processes: Record<
        string,
        {
          buildCommand?: string;
          startCommand: string;
          binding?: { hostVariable: string; hostValue: string; portVariable: string };
        }
      >;
    };
    expect(processes.selectedDeploymentMode).toBe('native-node');
    expect(processes.containersRequired).toBe(false);
    expect(processes.runtime).toEqual({ node: '24.x', packageManager: 'npm@11.6.1' });
    expect(processes.processes.api?.startCommand).toBe('npm run deploy:start:server-native');
    expect(processes.processes.web?.startCommand).toBe('npm run deploy:start:client-native');
    expect(processes.processes.api?.buildCommand).toContain('--scope=server');
    expect(processes.processes.web?.buildCommand).toContain('--scope=client');
    for (const process of Object.values(processes.processes)) {
      const buildCommand = process.buildCommand;
      expect(buildCommand).toBeDefined();
      if (!buildCommand) continue;
      const installDevDependencies = buildCommand.indexOf('npm ci --include=dev');
      const build = buildCommand.indexOf('npm run deploy:build:');
      const verify = buildCommand.indexOf('npm run deploy:native:verify');
      const pruneDevDependencies = buildCommand.indexOf('npm prune --omit=dev');
      expect(buildCommand).not.toMatch(/npm ci(?! --include=dev)/u);
      expect(installDevDependencies).toBeGreaterThan(-1);
      expect(build).toBeGreaterThan(installDevDependencies);
      expect(verify).toBeGreaterThan(build);
      expect(pruneDevDependencies).toBeGreaterThan(verify);
    }
    expect(processes.processes.api?.binding).toEqual({
      hostVariable: 'HOST',
      hostValue: '0.0.0.0',
      portVariable: 'PORT',
    });
    expect(processes.processes.web?.binding).toEqual({
      hostVariable: 'HOSTNAME',
      hostValue: '0.0.0.0',
      portVariable: 'PORT',
    });
    expect(rootPackage.scripts['deploy:start:server-native']).toBe(
      'node apps/server/dist/server.js',
    );
    expect(clientPackage.scripts.start).toBe('node .next/standalone/apps/client/server.js');
    expect(clientPackage.scripts.build).toContain('prepare-next-standalone.mjs');
    expect(read('deploy/native/README.md')).toContain('not the selected launch path');
  });

  it('ships runtime contract schemas in both non-root images', () => {
    const server = read('deploy/docker/server.Dockerfile');
    const client = read('deploy/docker/client.Dockerfile');
    for (const dockerfile of [server, client]) {
      expect(dockerfile).toContain('/app/packages/contracts/schemas');
      expect(dockerfile).toMatch(/USER (?:node|nextjs)/u);
      expect(dockerfile).toContain('npm install --global npm@11.6.1');
    }
    expect(client).not.toMatch(/ARG (?:MONGODB_URI|AUTH_|ANALYTICS_HASH|METRICS_|CACHE_)/u);
    expect(client).toContain("+'/api/healthz'");
  });

  it('pins the package-manager version before immutable CI installation', () => {
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow.indexOf('npm install --global npm@11.6.1')).toBeLessThan(
      workflow.indexOf('npm ci'),
    );
  });

  it('ships the production web security headers required by the release verifier', () => {
    const nextConfig = read('apps/client/next.config.mjs');
    expect(nextConfig).toContain("key: 'Content-Security-Policy'");
    expect(nextConfig).toContain("frame-ancestors 'none'");
    expect(nextConfig).toContain("key: 'Cross-Origin-Opener-Policy'");
    expect(nextConfig).toContain("key: 'Cross-Origin-Resource-Policy'");
    expect(nextConfig).toContain("key: 'Referrer-Policy'");
    expect(nextConfig).toContain("key: 'X-Frame-Options'");
    expect(nextConfig).toContain("key: 'X-Content-Type-Options'");
    expect(nextConfig).toContain("key: 'Strict-Transport-Security'");
    expect(nextConfig).toContain('max-age=31536000; includeSubDomains; preload');
  });

  it('permits the Next.js eval-based debugger only in development CSP', () => {
    const developmentCsp = readClientContentSecurityPolicy('development');
    const productionCsp = readClientContentSecurityPolicy('production');
    const configuredProductionCsp = readClientContentSecurityPolicy(
      'production',
      'https://api.example.test/api/v1',
    );

    expect(developmentCsp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(productionCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(productionCsp).not.toContain("'unsafe-eval'");
    expect(developmentCsp).toContain("connect-src 'self' http://localhost:4000");
    expect(productionCsp).not.toContain('http://localhost:4000');
    expect(configuredProductionCsp).toContain("connect-src 'self' https://api.example.test");
  });

  it('keeps the Next reference workload single-instance until coherent invalidation is selected', () => {
    const workloads = read('deploy/kubernetes/workloads.example.yaml');
    const clientStart = workloads.indexOf('name: niro-client\nspec:');
    const clientEnd = workloads.indexOf('\n---\napiVersion: v1\nkind: Service', clientStart);
    const clientSection = workloads.slice(clientStart, clientEnd);
    expect(clientSection).toContain('replicas: 1');
    expect(clientSection).toContain('mountPath: /app/apps/client/.next/cache');
    expect(clientSection).toContain('path: /api/healthz');
    expect(workloads).toContain('name: niro-client-secrets');
    expect(workloads).toContain('name: niro-server-secrets');
  });

  it('runs rollup and invalidation as external leased jobs from compiled image entry points', () => {
    const jobs = read('deploy/kubernetes/jobs.example.yaml');
    expect(jobs).toContain('concurrencyPolicy: Forbid');
    expect(jobs).toContain('apps/server/dist/ops/analytics-rollup-cli.js');
    expect(jobs).toContain('apps/server/dist/ops/cache-invalidation-cli.js');
    expect(jobs).toContain('--current-day-partial');
  });
});
