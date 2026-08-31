import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './env';
import { assertProductionJobEnvironment, assertProductionRuntimeEnvironment } from './production';

function validSource(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DEPLOYMENT_ENVIRONMENT: 'staging',
    RELEASE_ID: 'sha-0123456789abcdef',
    NEXT_PUBLIC_RELEASE_ID: 'sha-0123456789abcdef',
    HOST: '0.0.0.0',
    PORT: '4000',
    TRUST_PROXY_HOPS: '1',
    MONGODB_URI: 'mongodb+srv://runtime-user:encoded-password@cluster.example/niro_staging',
    MONGODB_DB_NAME: 'niro_staging',
    ASSESSMENT_RETENTION_DAYS: '90',
    AUTH_ACCESS_SECRET: 'access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    AUTH_REFRESH_SECRET: 'refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    METRICS_SCRAPE_TOKEN: 'metrics-secret-cccccccccccccccccccccccccccccccc',
    CACHE_INVALIDATION_ENDPOINT: 'https://web.example.test/api/v1/internal/revalidate',
    CACHE_INVALIDATION_SIGNING_SECRET: 'invalidation-secret-dddddddddddddddddddddddddddddddd',
    CORS_ORIGINS: 'https://web.example.test',
    SITE_URL: 'https://web.example.test',
    NEXT_PUBLIC_SITE_URL: 'https://web.example.test',
    API_BASE_URL: 'https://api.example.test/api/v1',
    NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1',
    NEXT_PUBLIC_ANALYTICS_ENABLED: 'false',
    NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'false',
    NEXT_PUBLIC_LEAD_CAPTURE_ENABLED: 'false',
    ...overrides,
  };
}

describe('production runtime validation', () => {
  it('accepts an explicit, internally consistent staging runtime without exposing secrets', () => {
    const source = validSource();
    expect(assertProductionRuntimeEnvironment(source, loadEnvironment(source))).toEqual({
      deploymentEnvironment: 'staging',
      releaseId: 'sha-0123456789abcdef',
      siteUrl: 'https://web.example.test',
      apiBaseUrl: 'https://api.example.test/api/v1',
    });
  });

  it('accepts a production-labelled database and rejects lower-environment names', () => {
    const production = validSource({
      DEPLOYMENT_ENVIRONMENT: 'production',
      MONGODB_DB_NAME: 'niro_prod',
    });
    expect(() =>
      assertProductionRuntimeEnvironment(production, loadEnvironment(production)),
    ).not.toThrow();
    const unsafe = validSource({
      DEPLOYMENT_ENVIRONMENT: 'production',
      MONGODB_DB_NAME: 'niro_dev',
    });
    expect(() => assertProductionRuntimeEnvironment(unsafe, loadEnvironment(unsafe))).toThrow(
      /must not look like/,
    );
  });

  it('requires distinct strong secrets and explicit signed invalidation', () => {
    const duplicate = validSource({
      AUTH_REFRESH_SECRET: 'access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(() => assertProductionRuntimeEnvironment(duplicate, loadEnvironment(duplicate))).toThrow(
      /must be distinct/,
    );
    const missing = validSource({
      CACHE_INVALIDATION_ENDPOINT: '',
      CACHE_INVALIDATION_SIGNING_SECRET: '',
    });
    expect(() => assertProductionRuntimeEnvironment(missing, loadEnvironment(missing))).toThrow(
      /cache invalidation/,
    );
  });

  it('rejects insecure origins and browser/server privacy-policy drift', () => {
    const insecure = validSource({
      SITE_URL: 'http://web.example.test',
      NEXT_PUBLIC_SITE_URL: 'http://web.example.test',
      CORS_ORIGINS: 'http://web.example.test',
    });
    expect(() => assertProductionRuntimeEnvironment(insecure, loadEnvironment(insecure))).toThrow(
      /HTTPS/,
    );

    const visitorDrift = validSource({
      NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'true',
    });
    expect(() =>
      assertProductionRuntimeEnvironment(visitorDrift, loadEnvironment(visitorDrift)),
    ).toThrow(/enable flags must match/);
  });

  it('requires analytics retention and timezone alignment when browser telemetry is enabled', () => {
    const source = validSource({
      NEXT_PUBLIC_ANALYTICS_ENABLED: 'true',
      ANALYTICS_HASH_SECRET: 'analytics-secret-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      ANALYTICS_EVENTS_RETENTION_DAYS: '180',
      ANALYTICS_REPORTING_TIMEZONE: 'Asia/Kolkata',
      NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE: 'UTC',
    });
    expect(() => assertProductionRuntimeEnvironment(source, loadEnvironment(source))).toThrow(
      /timezones must match/,
    );
  });

  it('accepts a least-privilege production analytics job environment', () => {
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DEPLOYMENT_ENVIRONMENT: 'staging',
      RELEASE_ID: 'sha-analytics-job',
      MONGODB_URI: 'mongodb+srv://job-user:encoded-password@cluster.example/niro_staging',
      MONGODB_DB_NAME: 'niro_staging',
      ASSESSMENT_RETENTION_DAYS: '90',
      ANALYTICS_HASH_SECRET: 'analytics-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ANALYTICS_IDENTITY_KEY_VERSION: 'v1',
      ANALYTICS_EVENTS_RETENTION_DAYS: '90',
      ANALYTICS_REPORTING_TIMEZONE: 'Asia/Kolkata',
      ANALYTICS_JOB_LEASE_SECONDS: '900',
      ANALYTICS_MIN_COHORT_SIZE: '5',
      ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'false',
      LEAD_RETENTION_DAYS: '90',
      LEAD_CONSENT_VERSION: 'lead-v1',
    };
    expect(assertProductionJobEnvironment(source, loadEnvironment(source), 'analytics')).toEqual({
      deploymentEnvironment: 'staging',
      releaseId: 'sha-analytics-job',
      databaseName: 'niro_staging',
      job: 'analytics',
    });
  });

  it('accepts a least-privilege cache job and rejects an insecure callback', () => {
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      DEPLOYMENT_ENVIRONMENT: 'staging',
      RELEASE_ID: 'sha-cache-job',
      MONGODB_URI: 'mongodb+srv://job-user:encoded-password@cluster.example/niro_staging',
      MONGODB_DB_NAME: 'niro_staging',
      ASSESSMENT_RETENTION_DAYS: '90',
      CACHE_INVALIDATION_ENDPOINT: 'https://web.example.test/api/v1/internal/revalidate',
      CACHE_INVALIDATION_SIGNING_SECRET: 'cache-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      CACHE_INVALIDATION_LEASE_SECONDS: '60',
      CACHE_INVALIDATION_BATCH_SIZE: '25',
    };
    expect(assertProductionJobEnvironment(source, loadEnvironment(source), 'cache')).toEqual({
      deploymentEnvironment: 'staging',
      releaseId: 'sha-cache-job',
      databaseName: 'niro_staging',
      job: 'cache',
    });

    const insecure = {
      ...source,
      CACHE_INVALIDATION_ENDPOINT: 'http://web.example.test/api/v1/internal/revalidate',
    };
    expect(() =>
      assertProductionJobEnvironment(insecure, loadEnvironment(insecure), 'cache'),
    ).toThrow(/HTTPS/);
  });

  it('makes release identity and deployment classification mandatory for jobs', () => {
    const source: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://job-user:encoded-password@cluster.example/niro_staging',
      MONGODB_DB_NAME: 'niro_staging',
      ASSESSMENT_RETENTION_DAYS: '90',
    };
    expect(() => assertProductionJobEnvironment(source, loadEnvironment(source), 'cache')).toThrow(
      /DEPLOYMENT_ENVIRONMENT/,
    );
  });
});
