import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadEnvironment } from '../apps/server/src/config/env';
import {
  assertProductionJobEnvironment,
  type ProductionJobKind,
} from '../apps/server/src/config/production';

interface RenderEnvironmentVariable {
  readonly key?: string;
  readonly value?: string;
  readonly sync?: boolean;
  readonly generateValue?: boolean;
  readonly fromService?: {
    readonly type: string;
    readonly name: string;
    readonly envVarKey: string;
  };
}

interface RenderService {
  readonly type: string;
  readonly name: string;
  readonly runtime: string;
  readonly region: string;
  readonly autoDeployTrigger: string;
  readonly numInstances?: number;
  readonly healthCheckPath?: string;
  readonly schedule?: string;
  readonly buildCommand: string;
  readonly startCommand: string;
  readonly envVars: readonly RenderEnvironmentVariable[];
}

function blueprint(): { readonly services: readonly RenderService[] } {
  return JSON.parse(readFileSync('render.yaml', 'utf8')) as {
    readonly services: readonly RenderService[];
  };
}

const promptedApiValues: Readonly<Record<string, string>> = {
  DEPLOYMENT_ENVIRONMENT: 'staging',
  TRUST_PROXY_HOPS: '1',
  MONGODB_URI: 'mongodb+srv://render-job:encoded-password@cluster.example/niro_staging',
  MONGODB_DB_NAME: 'niro_staging',
  ASSESSMENT_RETENTION_DAYS: '90',
  ANALYTICS_EVENTS_RETENTION_DAYS: '90',
  LEAD_RETENTION_DAYS: '90',
  LEAD_CONSENT_VERSION: 'lead-v1',
  CORS_ORIGINS: 'https://web.example.test',
  API_BASE_URL: 'https://api.example.test/api/v1',
  NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1',
  SITE_URL: 'https://web.example.test',
  NEXT_PUBLIC_SITE_URL: 'https://web.example.test',
  CACHE_INVALIDATION_ENDPOINT: 'https://web.example.test/api/v1/internal/revalidate',
};

function resolvedApiEnvironment(service: RenderService): ReadonlyMap<string, string> {
  return new Map(
    service.envVars.map((variable) => {
      const key = variable.key;
      if (!key) throw new Error('Every Render API environment variable must have a key.');
      const value =
        variable.value ??
        (variable.sync === false ? promptedApiValues[key] : undefined) ??
        (variable.generateValue
          ? `${key.toLowerCase()}-generated-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
          : undefined);
      if (!value) throw new Error(`No test value exists for Render API variable ${key}.`);
      return [key, value] as const;
    }),
  );
}

function resolvedJobEnvironment(
  service: RenderService,
  apiEnvironment: ReadonlyMap<string, string>,
): NodeJS.ProcessEnv {
  return {
    RELEASE_ID: 'sha-render-job-0123456789abcdef',
    ...Object.fromEntries(
      service.envVars.map((variable) => {
        const key = variable.key;
        if (!key) throw new Error('Every Render job environment variable must have a key.');
        const value = variable.value ?? apiEnvironment.get(variable.fromService?.envVarKey ?? '');
        if (!value) throw new Error(`Render job variable ${key} does not resolve.`);
        return [key, value] as const;
      }),
    ),
  };
}

describe('Render native Node Blueprint', () => {
  it('selects only native Node services in Singapore with manual immutable deploys', () => {
    const services = blueprint().services;

    expect(services.map(({ name }) => name)).toEqual([
      'niro-api',
      'niro-web',
      'niro-analytics-partial',
      'niro-analytics-final',
      'niro-cache-invalidation',
    ]);
    for (const service of services) {
      expect(service.runtime).toBe('node');
      expect(service.region).toBe('singapore');
      expect(service.autoDeployTrigger).toBe('off');
      expect(service.buildCommand).toContain('npm install --global npm@11.6.1');
      const installDevDependencies = service.buildCommand.indexOf('npm ci --include=dev');
      const build = service.buildCommand.indexOf('npm run deploy:build:');
      const verify = service.buildCommand.indexOf('npm run deploy:native:verify');
      const pruneDevDependencies = service.buildCommand.indexOf('npm prune --omit=dev');
      expect(service.buildCommand).not.toMatch(/npm ci(?! --include=dev)/u);
      expect(installDevDependencies).toBeGreaterThan(-1);
      expect(build).toBeGreaterThan(installDevDependencies);
      expect(verify).toBeGreaterThan(build);
      expect(pruneDevDependencies).toBeGreaterThan(verify);
      expect(service.buildCommand).toContain('npm run deploy:native:verify');
      expect(service.startCommand).toContain('$RENDER_GIT_COMMIT');
      expect(service.envVars).toContainEqual({ key: 'NODE_VERSION', value: '24.x' });
    }
    expect(JSON.stringify(services)).not.toMatch(/"runtime":"(?:docker|image)"/u);
  });

  it('wires health checks, single-instance web caching, and UTC schedules', () => {
    const byName = new Map(blueprint().services.map((service) => [service.name, service]));

    expect(byName.get('niro-api')).toMatchObject({ type: 'web', healthCheckPath: '/readyz' });
    expect(byName.get('niro-web')).toMatchObject({
      type: 'web',
      healthCheckPath: '/api/healthz',
      numInstances: 1,
    });
    expect(byName.get('niro-analytics-partial')).toMatchObject({
      type: 'cron',
      schedule: '*/5 * * * *',
    });
    expect(byName.get('niro-analytics-final')).toMatchObject({
      type: 'cron',
      schedule: '45 18 * * *',
    });
    expect(byName.get('niro-cache-invalidation')).toMatchObject({
      type: 'cron',
      schedule: '* * * * *',
    });
  });

  it('never commits external credentials or policy decisions', () => {
    const api = blueprint().services.find(({ name }) => name === 'niro-api');
    expect(api).toBeDefined();
    const variables = new Map(api?.envVars.map((variable) => [variable.key, variable]));

    for (const key of [
      'DEPLOYMENT_ENVIRONMENT',
      'TRUST_PROXY_HOPS',
      'MONGODB_URI',
      'MONGODB_DB_NAME',
      'ASSESSMENT_RETENTION_DAYS',
      'ANALYTICS_EVENTS_RETENTION_DAYS',
      'LEAD_RETENTION_DAYS',
      'LEAD_CONSENT_VERSION',
      'CORS_ORIGINS',
      'API_BASE_URL',
      'NEXT_PUBLIC_API_BASE_URL',
      'SITE_URL',
      'NEXT_PUBLIC_SITE_URL',
      'CACHE_INVALIDATION_ENDPOINT',
    ]) {
      expect(variables.get(key)).toEqual({ key, sync: false });
    }
    for (const key of [
      'AUTH_ACCESS_SECRET',
      'AUTH_REFRESH_SECRET',
      'ANALYTICS_HASH_SECRET',
      'METRICS_SCRAPE_TOKEN',
      'CACHE_INVALIDATION_SIGNING_SECRET',
    ]) {
      expect(variables.get(key)).toEqual({ key, generateValue: true });
    }
  });

  it('resolves every cron into its real least-privilege production validator', () => {
    const services = blueprint().services;
    const api = services.find(({ name }) => name === 'niro-api');
    if (!api) throw new Error('The Render Blueprint must contain niro-api.');
    const apiEnvironment = resolvedApiEnvironment(api);
    const jobs = services.filter(({ type }) => type === 'cron');

    for (const job of jobs) {
      const source = resolvedJobEnvironment(job, apiEnvironment);
      const kind: ProductionJobKind = job.name.includes('analytics') ? 'analytics' : 'cache';
      expect(() =>
        assertProductionJobEnvironment(source, loadEnvironment(source), kind),
      ).not.toThrow();
      for (const apiOnlyKey of [
        'AUTH_ACCESS_SECRET',
        'AUTH_REFRESH_SECRET',
        'METRICS_SCRAPE_TOKEN',
        'NEXT_PUBLIC_API_BASE_URL',
        'NEXT_PUBLIC_SITE_URL',
      ]) {
        expect(source[apiOnlyKey]).toBeUndefined();
      }
    }
  });
});
