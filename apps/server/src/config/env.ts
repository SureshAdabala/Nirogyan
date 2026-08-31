import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { assertValidTimezone } from '../analytics/time';

export interface AppEnvironment {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly trustProxyHops: number;
  readonly corsOrigins: readonly string[];
  readonly logLevel: string;
  readonly mongoUri: string | undefined;
  readonly mongoDbName: string;
  readonly mongoServerSelectionTimeoutMs: number;
  readonly mongoMaxPoolSize: number;
  readonly authAccessSecret: string | undefined;
  readonly authRefreshSecret: string | undefined;
  readonly analyticsHashSecret: string | undefined;
  readonly analyticsIdentityKeyVersion: string;
  readonly analyticsEventsRetentionDays: number;
  readonly analyticsReportingTimezone: string;
  readonly analyticsVisitorPersistenceEnabled: boolean;
  readonly analyticsVisitorRetentionDays: number | undefined;
  readonly analyticsVisitorConsentVersion: string | undefined;
  readonly analyticsJobLeaseSeconds: number;
  readonly analyticsMinimumCohortSize: number;
  readonly assessmentRetentionDays: number | undefined;
  readonly leadRetentionDays: number | undefined;
  readonly leadConsentVersion: string | undefined;
  readonly deploymentEnvironment: 'staging' | 'production' | undefined;
  readonly releaseId: string;
  readonly metricsScrapeToken: string | undefined;
  readonly cacheInvalidationEndpoint: string | undefined;
  readonly cacheInvalidationSigningSecret: string | undefined;
  readonly cacheInvalidationLeaseSeconds: number;
  readonly cacheInvalidationBatchSize: number;
  /**
   * Exposes live development-database drafts through the separately mounted
   * public-test API. This flag is intentionally impossible to enable outside
   * an unclassified, loopback-only development runtime.
   */
  readonly publicTestCatalogEnabled: boolean;
}

/**
 * Resolve the monorepo root env file from the server package location.
 * This remains stable for both tsx source execution and compiled dist output,
 * regardless of the caller's current working directory.
 */
export function projectRootEnvPath(): string {
  return resolve(__dirname, '..', '..', '..', '..', '.env');
}

export function loadProjectEnvironment(filePath = projectRootEnvPath()): boolean {
  if (!existsSync(filePath)) return false;
  const result = loadDotenv({ path: filePath, override: false });
  if (result.error) throw result.error;
  return true;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '4000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function parseOptionalSafeIdentifier(
  value: string | undefined,
  name: string,
  maximumLength = 100,
): string | undefined {
  const parsed = value?.trim();
  if (!parsed) return undefined;
  const pattern = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]{0,${maximumLength - 1}}$`, 'u');
  if (!pattern.test(parsed)) {
    throw new Error(`${name} must be a 1-${maximumLength} character safe identifier`);
  }
  return parsed;
}

function parseOptionalSecret(value: string | undefined, name: string): string | undefined {
  const parsed = value?.trim();
  if (!parsed) return undefined;
  if (parsed.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  return parsed;
}

function parseCacheInvalidationConfiguration(source: NodeJS.ProcessEnv): {
  readonly endpoint: string | undefined;
  readonly signingSecret: string | undefined;
} {
  const endpoint = source.CACHE_INVALIDATION_ENDPOINT?.trim() || undefined;
  const signingSecret = parseOptionalSecret(
    source.CACHE_INVALIDATION_SIGNING_SECRET,
    'CACHE_INVALIDATION_SIGNING_SECRET',
  );
  if ((endpoint && !signingSecret) || (!endpoint && signingSecret)) {
    throw new Error(
      'CACHE_INVALIDATION_ENDPOINT and CACHE_INVALIDATION_SIGNING_SECRET must be configured together',
    );
  }
  if (endpoint) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error('CACHE_INVALIDATION_ENDPOINT must be an absolute HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('CACHE_INVALIDATION_ENDPOINT must be an HTTP(S) URL without credentials');
    }
  }
  return { endpoint, signingSecret };
}

function parseAnalyticsVisitorConfiguration(source: NodeJS.ProcessEnv): {
  readonly enabled: boolean;
  readonly retentionDays: number | undefined;
  readonly consentVersion: string | undefined;
} {
  const enabled = parseBoolean(
    source.ANALYTICS_VISITOR_PERSISTENCE_ENABLED,
    false,
    'ANALYTICS_VISITOR_PERSISTENCE_ENABLED',
  );
  const retentionDays = parseOptionalPositiveInteger(
    source.ANALYTICS_VISITOR_RETENTION_DAYS,
    'ANALYTICS_VISITOR_RETENTION_DAYS',
  );
  const consentVersion = source.ANALYTICS_VISITOR_CONSENT_VERSION?.trim();
  if (enabled && (retentionDays === undefined || !consentVersion)) {
    throw new Error(
      'ANALYTICS_VISITOR_RETENTION_DAYS and ANALYTICS_VISITOR_CONSENT_VERSION are required when visitor persistence is enabled',
    );
  }
  if (consentVersion && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(consentVersion)) {
    throw new Error('ANALYTICS_VISITOR_CONSENT_VERSION must be a safe version identifier');
  }
  return { enabled, retentionDays, consentVersion };
}

function parseLeadConfiguration(source: NodeJS.ProcessEnv): {
  readonly retentionDays: number | undefined;
  readonly consentVersion: string | undefined;
} {
  const retentionValue = source.LEAD_RETENTION_DAYS?.trim();
  const consentVersion = source.LEAD_CONSENT_VERSION?.trim();
  if (!retentionValue && !consentVersion)
    return { retentionDays: undefined, consentVersion: undefined };
  if (!retentionValue || !consentVersion) {
    throw new Error('LEAD_RETENTION_DAYS and LEAD_CONSENT_VERSION must be configured together');
  }
  const retentionDays = Number(retentionValue);
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) {
    throw new Error('LEAD_RETENTION_DAYS must be a positive integer');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(consentVersion)) {
    throw new Error('LEAD_CONSENT_VERSION must be a 1-100 character safe version identifier');
  }
  return { retentionDays, consentVersion };
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): AppEnvironment {
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const lead = parseLeadConfiguration(source);
  const analyticsVisitor = parseAnalyticsVisitorConfiguration(source);
  const cacheInvalidation = parseCacheInvalidationConfiguration(source);
  const analyticsHashSecret = source.ANALYTICS_HASH_SECRET?.trim() || undefined;
  if (analyticsHashSecret && analyticsHashSecret.length < 32) {
    throw new Error('ANALYTICS_HASH_SECRET must contain at least 32 characters');
  }
  const mongoUri = source.MONGODB_URI?.trim() || undefined;
  const assessmentRetentionDays = parseOptionalPositiveInteger(
    source.ASSESSMENT_RETENTION_DAYS,
    'ASSESSMENT_RETENTION_DAYS',
  );
  if (nodeEnv === 'production' && mongoUri && assessmentRetentionDays === undefined) {
    throw new Error('ASSESSMENT_RETENTION_DAYS is required with MONGODB_URI in production');
  }
  if (
    nodeEnv === 'production' &&
    analyticsHashSecret &&
    !source.ANALYTICS_EVENTS_RETENTION_DAYS?.trim()
  ) {
    throw new Error(
      'ANALYTICS_EVENTS_RETENTION_DAYS is required when analytics is enabled in production',
    );
  }
  const analyticsReportingTimezone = source.ANALYTICS_REPORTING_TIMEZONE ?? 'Asia/Kolkata';
  assertValidTimezone(analyticsReportingTimezone);
  const analyticsEventsRetentionDays = parsePositiveInteger(
    source.ANALYTICS_EVENTS_RETENTION_DAYS,
    180,
    'ANALYTICS_EVENTS_RETENTION_DAYS',
  );
  if (
    analyticsVisitor.enabled &&
    (analyticsVisitor.retentionDays ?? 0) < analyticsEventsRetentionDays
  ) {
    throw new Error(
      'ANALYTICS_VISITOR_RETENTION_DAYS must be at least ANALYTICS_EVENTS_RETENTION_DAYS for reproducible visitor rollups',
    );
  }
  const analyticsIdentityKeyVersion = source.ANALYTICS_IDENTITY_KEY_VERSION?.trim() || 'v1';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(analyticsIdentityKeyVersion)) {
    throw new Error('ANALYTICS_IDENTITY_KEY_VERSION must be a safe identifier');
  }
  const deploymentEnvironment = source.DEPLOYMENT_ENVIRONMENT?.trim();
  if (
    deploymentEnvironment !== undefined &&
    deploymentEnvironment !== '' &&
    deploymentEnvironment !== 'staging' &&
    deploymentEnvironment !== 'production'
  ) {
    throw new Error('DEPLOYMENT_ENVIRONMENT must be staging or production');
  }
  const host = source.HOST ?? '127.0.0.1';
  const corsOrigins = (source.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const mongoDbName = source.MONGODB_DB_NAME ?? 'niro_dev';
  const publicTestCatalogEnabled = parseBoolean(
    source.PUBLIC_TEST_CATALOG_ENABLED,
    false,
    'PUBLIC_TEST_CATALOG_ENABLED',
  );
  if (publicTestCatalogEnabled) {
    const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
    const loopbackOrigins = corsOrigins.every((origin) => {
      try {
        return loopbackHosts.has(new URL(origin).hostname);
      } catch {
        return false;
      }
    });
    if (nodeEnv !== 'development') {
      throw new Error('PUBLIC_TEST_CATALOG_ENABLED requires NODE_ENV=development');
    }
    if (deploymentEnvironment) {
      throw new Error('PUBLIC_TEST_CATALOG_ENABLED cannot be used with DEPLOYMENT_ENVIRONMENT');
    }
    if (!mongoUri) {
      throw new Error('PUBLIC_TEST_CATALOG_ENABLED requires MONGODB_URI');
    }
    if (!loopbackHosts.has(host) || !loopbackOrigins || corsOrigins.length === 0) {
      throw new Error('PUBLIC_TEST_CATALOG_ENABLED requires loopback HOST and CORS_ORIGINS');
    }
    if (!/(?:^|[_-])(dev|development|test|testing)(?:$|[_-])/iu.test(mongoDbName)) {
      throw new Error(
        'PUBLIC_TEST_CATALOG_ENABLED requires an explicitly development/test database name',
      );
    }
  }
  return {
    nodeEnv,
    host,
    port: parsePort(source.PORT),
    trustProxyHops: parseNonNegativeInteger(source.TRUST_PROXY_HOPS, 0, 'TRUST_PROXY_HOPS'),
    corsOrigins,
    logLevel: source.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info'),
    mongoUri,
    mongoDbName,
    mongoServerSelectionTimeoutMs: parsePositiveInteger(
      source.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      10_000,
      'MONGODB_SERVER_SELECTION_TIMEOUT_MS',
    ),
    mongoMaxPoolSize: parsePositiveInteger(
      source.MONGODB_MAX_POOL_SIZE,
      10,
      'MONGODB_MAX_POOL_SIZE',
    ),
    authAccessSecret: source.AUTH_ACCESS_SECRET,
    authRefreshSecret: source.AUTH_REFRESH_SECRET,
    analyticsHashSecret,
    analyticsIdentityKeyVersion,
    analyticsEventsRetentionDays,
    analyticsReportingTimezone,
    analyticsVisitorPersistenceEnabled: analyticsVisitor.enabled,
    analyticsVisitorRetentionDays: analyticsVisitor.retentionDays,
    analyticsVisitorConsentVersion: analyticsVisitor.consentVersion,
    analyticsJobLeaseSeconds: parsePositiveInteger(
      source.ANALYTICS_JOB_LEASE_SECONDS,
      900,
      'ANALYTICS_JOB_LEASE_SECONDS',
    ),
    analyticsMinimumCohortSize: parseBoundedInteger(
      source.ANALYTICS_MIN_COHORT_SIZE,
      5,
      'ANALYTICS_MIN_COHORT_SIZE',
      2,
      100,
    ),
    assessmentRetentionDays,
    leadRetentionDays: lead.retentionDays,
    leadConsentVersion: lead.consentVersion,
    deploymentEnvironment: deploymentEnvironment || undefined,
    releaseId:
      parseOptionalSafeIdentifier(source.RELEASE_ID, 'RELEASE_ID', 100) ?? 'local-unversioned',
    metricsScrapeToken: parseOptionalSecret(source.METRICS_SCRAPE_TOKEN, 'METRICS_SCRAPE_TOKEN'),
    cacheInvalidationEndpoint: cacheInvalidation.endpoint,
    cacheInvalidationSigningSecret: cacheInvalidation.signingSecret,
    cacheInvalidationLeaseSeconds: parseBoundedInteger(
      source.CACHE_INVALIDATION_LEASE_SECONDS,
      60,
      'CACHE_INVALIDATION_LEASE_SECONDS',
      15,
      900,
    ),
    cacheInvalidationBatchSize: parseBoundedInteger(
      source.CACHE_INVALIDATION_BATCH_SIZE,
      25,
      'CACHE_INVALIDATION_BATCH_SIZE',
      1,
      100,
    ),
    publicTestCatalogEnabled,
  };
}
