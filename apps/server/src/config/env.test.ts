import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadEnvironment, loadProjectEnvironment, projectRootEnvPath } from './env';

describe('server environment foundation', () => {
  it('loads safe defaults without connecting to persistence', () => {
    const environment = loadEnvironment({ NODE_ENV: 'test' });

    expect(environment.nodeEnv).toBe('test');
    expect(environment.port).toBe(4000);
    expect(environment.trustProxyHops).toBe(0);
    expect(environment.logLevel).toBe('silent');
    expect(environment.mongoUri).toBeUndefined();
    expect(environment.mongoDbName).toBe('niro_dev');
    expect(environment.mongoServerSelectionTimeoutMs).toBe(10_000);
    expect(environment.mongoMaxPoolSize).toBe(10);
    expect(environment.authAccessSecret).toBeUndefined();
    expect(environment.authRefreshSecret).toBeUndefined();
    expect(environment.analyticsHashSecret).toBeUndefined();
    expect(environment.analyticsIdentityKeyVersion).toBe('v1');
    expect(environment.analyticsEventsRetentionDays).toBe(180);
    expect(environment.analyticsReportingTimezone).toBe('Asia/Kolkata');
    expect(environment.analyticsVisitorPersistenceEnabled).toBe(false);
    expect(environment.analyticsVisitorRetentionDays).toBeUndefined();
    expect(environment.analyticsVisitorConsentVersion).toBeUndefined();
    expect(environment.analyticsJobLeaseSeconds).toBe(900);
    expect(environment.analyticsMinimumCohortSize).toBe(5);
    expect(environment.assessmentRetentionDays).toBeUndefined();
    expect(environment.leadRetentionDays).toBeUndefined();
    expect(environment.leadConsentVersion).toBeUndefined();
    expect(environment.publicTestCatalogEnabled).toBe(false);
  });

  it('enables the public-test catalog only for an explicit loopback development database', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'development',
      PUBLIC_TEST_CATALOG_ENABLED: 'true',
      HOST: '127.0.0.1',
      CORS_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3001',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      MONGODB_DB_NAME: 'niro_dev',
    });

    expect(environment.publicTestCatalogEnabled).toBe(true);
    expect(environment.mongoUri).toBe('mongodb://127.0.0.1:27017');
    expect(environment.mongoDbName).toBe('niro_dev');
    expect(environment.host).toBe('127.0.0.1');
    expect(environment.corsOrigins).toEqual(['http://localhost:3000', 'http://127.0.0.1:3001']);
  });

  it('rejects the public-test catalog outside an unclassified development runtime', () => {
    const local = {
      PUBLIC_TEST_CATALOG_ENABLED: 'true',
      HOST: '127.0.0.1',
      CORS_ORIGINS: 'http://localhost:3000',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      MONGODB_DB_NAME: 'niro_dev',
    };

    expect(() =>
      loadEnvironment({
        ...local,
        NODE_ENV: 'production',
        ASSESSMENT_RETENTION_DAYS: '1',
      }),
    ).toThrow(/requires NODE_ENV=development/);
    expect(() => loadEnvironment({ ...local, NODE_ENV: 'test' })).toThrow(
      /requires NODE_ENV=development/,
    );
    expect(() =>
      loadEnvironment({ ...local, NODE_ENV: 'development', DEPLOYMENT_ENVIRONMENT: 'staging' }),
    ).toThrow(/cannot be used with DEPLOYMENT_ENVIRONMENT/);
    expect(() =>
      loadEnvironment({ ...local, NODE_ENV: 'development', DEPLOYMENT_ENVIRONMENT: 'production' }),
    ).toThrow(/cannot be used with DEPLOYMENT_ENVIRONMENT/);
  });

  it('rejects public-test persistence that is absent, non-loopback, or production-labelled', () => {
    const local = {
      NODE_ENV: 'development',
      PUBLIC_TEST_CATALOG_ENABLED: 'true',
      HOST: '127.0.0.1',
      CORS_ORIGINS: 'http://localhost:3000',
      MONGODB_URI: 'mongodb://127.0.0.1:27017',
      MONGODB_DB_NAME: 'niro_dev',
    };

    expect(() => loadEnvironment({ ...local, MONGODB_URI: '' })).toThrow(/requires MONGODB_URI/);
    expect(() => loadEnvironment({ ...local, HOST: '0.0.0.0' })).toThrow(
      /requires loopback HOST and CORS_ORIGINS/,
    );
    expect(() => loadEnvironment({ ...local, CORS_ORIGINS: 'https://example.test' })).toThrow(
      /requires loopback HOST and CORS_ORIGINS/,
    );
    expect(() => loadEnvironment({ ...local, MONGODB_DB_NAME: 'niro_prod' })).toThrow(
      /requires an explicitly development\/test database name/,
    );
  });

  it('gates persistent visitor analytics on explicit retention and consent configuration', () => {
    expect(
      loadEnvironment({
        NODE_ENV: 'test',
        ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'true',
        ANALYTICS_EVENTS_RETENTION_DAYS: '30',
        ANALYTICS_VISITOR_RETENTION_DAYS: '90',
        ANALYTICS_VISITOR_CONSENT_VERSION: 'analytics-v1',
      }),
    ).toMatchObject({
      analyticsVisitorPersistenceEnabled: true,
      analyticsVisitorRetentionDays: 90,
      analyticsVisitorConsentVersion: 'analytics-v1',
    });
    expect(
      loadEnvironment({
        NODE_ENV: 'test',
        ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'false',
        ANALYTICS_VISITOR_RETENTION_DAYS: '90',
        ANALYTICS_VISITOR_CONSENT_VERSION: 'analytics-v1',
      }),
    ).toMatchObject({
      analyticsVisitorPersistenceEnabled: false,
      analyticsVisitorRetentionDays: 90,
      analyticsVisitorConsentVersion: 'analytics-v1',
    });
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'true',
      }),
    ).toThrow(/required when visitor persistence is enabled/);
    expect(() =>
      loadEnvironment({ NODE_ENV: 'test', ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'yes' }),
    ).toThrow(/must be true or false/);
  });

  it('requires an explicit production analytics retention policy and validates timezone', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        ANALYTICS_HASH_SECRET: 'configured-secret-at-least-32-bytes-long',
      }),
    ).toThrow(/ANALYTICS_EVENTS_RETENTION_DAYS/);
    expect(() =>
      loadEnvironment({ NODE_ENV: 'test', ANALYTICS_REPORTING_TIMEZONE: 'not/a-zone' }),
    ).toThrow(/valid IANA timezone/);
  });

  it('validates hash strength, proxy hops, cohort size, and reproducible visitor retention', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'test', ANALYTICS_HASH_SECRET: 'short' })).toThrow(
      /at least 32/,
    );
    expect(() => loadEnvironment({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '-1' })).toThrow(
      /non-negative/,
    );
    expect(() => loadEnvironment({ NODE_ENV: 'test', ANALYTICS_MIN_COHORT_SIZE: '1' })).toThrow(
      /between 2 and 100/,
    );
    expect(() => loadEnvironment({ NODE_ENV: 'test', ANALYTICS_MIN_COHORT_SIZE: '101' })).toThrow(
      /between 2 and 100/,
    );
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        ANALYTICS_EVENTS_RETENTION_DAYS: '30',
        ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'true',
        ANALYTICS_VISITOR_RETENTION_DAYS: '10',
        ANALYTICS_VISITOR_CONSENT_VERSION: 'v1',
      }),
    ).toThrow(/at least ANALYTICS_EVENTS_RETENTION_DAYS/);
  });

  it('validates assessment retention and requires an explicit production policy', () => {
    expect(
      loadEnvironment({ NODE_ENV: 'test', ASSESSMENT_RETENTION_DAYS: '14' })
        .assessmentRetentionDays,
    ).toBe(14);
    expect(() => loadEnvironment({ NODE_ENV: 'test', ASSESSMENT_RETENTION_DAYS: '0' })).toThrow(
      /positive integer/,
    );
    expect(() =>
      loadEnvironment({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://example.test/niro' }),
    ).toThrow(/required with MONGODB_URI/);
  });

  it('loads lead capture only from a complete, valid retention and consent pair', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'test',
      LEAD_RETENTION_DAYS: '45',
      LEAD_CONSENT_VERSION: 'privacy-v2',
    });
    expect(environment.leadRetentionDays).toBe(45);
    expect(environment.leadConsentVersion).toBe('privacy-v2');
  });

  it('rejects partial or invalid lead-capture configuration', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'test', LEAD_RETENTION_DAYS: '30' })).toThrow(
      /configured together/,
    );
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        LEAD_RETENTION_DAYS: '0',
        LEAD_CONSENT_VERSION: 'privacy-v1',
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'test',
        LEAD_RETENTION_DAYS: '30',
        LEAD_CONSENT_VERSION: 'not safe',
      }),
    ).toThrow(/safe version identifier/);
  });

  it('resolves the env file from the repository root, not process.cwd()', () => {
    expect(projectRootEnvPath()).toBe(resolve(__dirname, '..', '..', '..', '..', '.env'));
  });

  it('loads a selected env file without overriding explicit process variables', () => {
    const directory = mkdtempSync(join(tmpdir(), 'niro-env-'));
    const filePath = join(directory, '.env');
    const previousName = process.env.MONGODB_DB_NAME;
    const previousPool = process.env.MONGODB_MAX_POOL_SIZE;
    process.env.MONGODB_DB_NAME = 'explicit_test_db';
    writeFileSync(filePath, 'MONGODB_DB_NAME=file_test_db\nMONGODB_MAX_POOL_SIZE=17\n');
    try {
      expect(loadProjectEnvironment(filePath)).toBe(true);
      const environment = loadEnvironment(process.env);
      expect(environment.mongoDbName).toBe('explicit_test_db');
      expect(environment.mongoMaxPoolSize).toBe(17);
    } finally {
      if (previousName === undefined) delete process.env.MONGODB_DB_NAME;
      else process.env.MONGODB_DB_NAME = previousName;
      if (previousPool === undefined) delete process.env.MONGODB_MAX_POOL_SIZE;
      else process.env.MONGODB_MAX_POOL_SIZE = previousPool;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
