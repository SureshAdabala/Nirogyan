import type { AppEnvironment } from './env';

export interface ProductionRuntimeConfiguration {
  readonly deploymentEnvironment: 'staging' | 'production';
  readonly releaseId: string;
  readonly siteUrl: string;
  readonly apiBaseUrl: string;
}

export type ProductionJobKind = 'analytics' | 'cache';

export interface ProductionJobRuntimeConfiguration {
  readonly deploymentEnvironment: 'staging' | 'production';
  readonly releaseId: string;
  readonly databaseName: string;
  readonly job: ProductionJobKind;
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required for a production runtime`);
  return value;
}

function secureUrl(value: string, name: string, path: 'root' | 'api' | 'invalidation'): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS URL without credentials, query, or fragment`);
  }
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must not target a loopback host in production`);
  }
  const normalizedPath = url.pathname.replace(/\/+$/u, '') || '/';
  if (path === 'root' && normalizedPath !== '/') {
    throw new Error(`${name} must be an origin without a path`);
  }
  if (path === 'api' && !normalizedPath.endsWith('/api/v1')) {
    throw new Error(`${name} must end with /api/v1`);
  }
  if (path === 'invalidation' && !normalizedPath.endsWith('/api/v1/internal/revalidate')) {
    throw new Error(`${name} must end with /api/v1/internal/revalidate`);
  }
  return url;
}

function assertStrongDistinctSecrets(environment: AppEnvironment): void {
  const secrets = [
    ['AUTH_ACCESS_SECRET', environment.authAccessSecret],
    ['AUTH_REFRESH_SECRET', environment.authRefreshSecret],
    ['METRICS_SCRAPE_TOKEN', environment.metricsScrapeToken],
    ['CACHE_INVALIDATION_SIGNING_SECRET', environment.cacheInvalidationSigningSecret],
  ] as const;
  for (const [name, value] of secrets) {
    if (!value || value.trim().length < 32) {
      throw new Error(`${name} must contain at least 32 characters in production`);
    }
  }
  const configured = [
    ...secrets.map(([name, value]) => [name, value] as const),
    ...(environment.analyticsHashSecret
      ? ([['ANALYTICS_HASH_SECRET', environment.analyticsHashSecret]] as const)
      : []),
  ];
  for (let left = 0; left < configured.length; left += 1) {
    for (let right = left + 1; right < configured.length; right += 1) {
      if (configured[left]?.[1] === configured[right]?.[1]) {
        throw new Error(`${configured[left]?.[0]} and ${configured[right]?.[0]} must be distinct`);
      }
    }
  }
}

function assertMongoProductionSafety(source: NodeJS.ProcessEnv, environment: AppEnvironment): void {
  const uri = required(source, 'MONGODB_URI');
  const dbName = required(source, 'MONGODB_DB_NAME');
  if (/<[^>]+>/u.test(uri)) throw new Error('MONGODB_URI contains an unresolved placeholder');
  if (!/^mongodb(?:\+srv)?:\/\//u.test(uri)) {
    throw new Error('MONGODB_URI must use the mongodb or mongodb+srv protocol');
  }
  if (uri.startsWith('mongodb://') && !/[?&](?:tls|ssl)=true(?:&|$)/iu.test(uri)) {
    throw new Error('A non-SRV production MONGODB_URI must explicitly enable TLS');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/u.test(dbName)) {
    throw new Error('MONGODB_DB_NAME must be an explicit safe database name');
  }
  if (['admin', 'config', 'local'].includes(dbName)) {
    throw new Error('MONGODB_DB_NAME must not use a MongoDB system database');
  }
  if (
    environment.deploymentEnvironment === 'production' &&
    /(dev|test|restore|staging)/iu.test(dbName)
  ) {
    throw new Error(
      'Production MONGODB_DB_NAME must not look like a development, test, restore, or staging database',
    );
  }
}

/**
 * Validate a scheduled process without coupling it to API/browser-only secrets.
 * Each job still fails closed on immutable release identity, environment
 * classification, Atlas safety, and every setting that can change its writes.
 */
export function assertProductionJobEnvironment(
  source: NodeJS.ProcessEnv,
  environment: AppEnvironment,
  job: ProductionJobKind,
): ProductionJobRuntimeConfiguration {
  if (environment.nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be production for production job validation');
  }
  if (!environment.deploymentEnvironment) {
    throw new Error('DEPLOYMENT_ENVIRONMENT must be staging or production');
  }
  if (environment.releaseId === 'local-unversioned') {
    throw new Error('RELEASE_ID must identify the immutable job artifact being executed');
  }
  assertMongoProductionSafety(source, environment);

  if (job === 'analytics') {
    for (const name of [
      'ANALYTICS_IDENTITY_KEY_VERSION',
      'ANALYTICS_EVENTS_RETENTION_DAYS',
      'ANALYTICS_REPORTING_TIMEZONE',
      'ANALYTICS_JOB_LEASE_SECONDS',
      'ANALYTICS_MIN_COHORT_SIZE',
      'ANALYTICS_VISITOR_PERSISTENCE_ENABLED',
      'ASSESSMENT_RETENTION_DAYS',
      'LEAD_RETENTION_DAYS',
      'LEAD_CONSENT_VERSION',
    ] as const) {
      required(source, name);
    }
    if (!environment.analyticsHashSecret) {
      throw new Error('ANALYTICS_HASH_SECRET is required for a production analytics job');
    }
    if (environment.assessmentRetentionDays === undefined) {
      throw new Error('ASSESSMENT_RETENTION_DAYS is required for a production analytics job');
    }
    if (environment.leadRetentionDays === undefined || !environment.leadConsentVersion) {
      throw new Error(
        'LEAD_RETENTION_DAYS and LEAD_CONSENT_VERSION are required for a production analytics job',
      );
    }
  } else {
    required(source, 'CACHE_INVALIDATION_LEASE_SECONDS');
    required(source, 'CACHE_INVALIDATION_BATCH_SIZE');
    if (!environment.cacheInvalidationEndpoint || !environment.cacheInvalidationSigningSecret) {
      throw new Error(
        'CACHE_INVALIDATION_ENDPOINT and CACHE_INVALIDATION_SIGNING_SECRET are required for a production cache job',
      );
    }
    secureUrl(environment.cacheInvalidationEndpoint, 'CACHE_INVALIDATION_ENDPOINT', 'invalidation');
  }

  return {
    deploymentEnvironment: environment.deploymentEnvironment,
    releaseId: environment.releaseId,
    databaseName: environment.mongoDbName,
    job,
  };
}

function parsePublicBoolean(source: NodeJS.ProcessEnv, name: string): boolean {
  const value = required(source, name);
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false`);
  return value === 'true';
}

function assertBrowserPolicyAlignment(
  source: NodeJS.ProcessEnv,
  environment: AppEnvironment,
): void {
  const browserAnalyticsEnabled = parsePublicBoolean(source, 'NEXT_PUBLIC_ANALYTICS_ENABLED');
  const browserVisitorEnabled = parsePublicBoolean(
    source,
    'NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED',
  );
  const browserLeadEnabled = parsePublicBoolean(source, 'NEXT_PUBLIC_LEAD_CAPTURE_ENABLED');

  if (browserAnalyticsEnabled) {
    if (!environment.analyticsHashSecret) {
      throw new Error('ANALYTICS_HASH_SECRET is required when browser analytics is enabled');
    }
    required(source, 'ANALYTICS_EVENTS_RETENTION_DAYS');
    if (
      required(source, 'NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE') !==
      environment.analyticsReportingTimezone
    ) {
      throw new Error('Browser and server analytics reporting timezones must match');
    }
  }
  if (browserVisitorEnabled !== environment.analyticsVisitorPersistenceEnabled) {
    throw new Error('Browser and server visitor-persistence enable flags must match');
  }
  if (browserVisitorEnabled) {
    if (
      required(source, 'NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS') !==
        String(environment.analyticsVisitorRetentionDays) ||
      required(source, 'NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION') !==
        environment.analyticsVisitorConsentVersion
    ) {
      throw new Error('Browser and server visitor retention/consent values must match');
    }
  }
  if (browserLeadEnabled) {
    if (environment.leadRetentionDays === undefined || !environment.leadConsentVersion) {
      throw new Error('Server lead retention and consent must exist when lead capture is enabled');
    }
    if (
      required(source, 'NEXT_PUBLIC_LEAD_CONSENT_VERSION') !== environment.leadConsentVersion ||
      !required(source, 'NEXT_PUBLIC_LEAD_CONSENT_TEXT')
    ) {
      throw new Error('Browser lead consent version/text must match approved server policy');
    }
  }
}

export function assertProductionRuntimeEnvironment(
  source: NodeJS.ProcessEnv,
  environment: AppEnvironment,
): ProductionRuntimeConfiguration {
  if (environment.nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be production for production runtime validation');
  }
  if (!environment.deploymentEnvironment) {
    throw new Error('DEPLOYMENT_ENVIRONMENT must be staging or production');
  }
  if (environment.releaseId === 'local-unversioned') {
    throw new Error('RELEASE_ID must identify the immutable build being deployed');
  }
  if (required(source, 'NEXT_PUBLIC_RELEASE_ID') !== environment.releaseId) {
    throw new Error(
      'NEXT_PUBLIC_RELEASE_ID must match RELEASE_ID for the immutable client artifact',
    );
  }
  if (!source.TRUST_PROXY_HOPS?.trim()) {
    throw new Error('TRUST_PROXY_HOPS must be explicitly configured for the selected host');
  }
  if (['127.0.0.1', 'localhost', '::1'].includes(environment.host)) {
    throw new Error('HOST must not bind only to loopback in production');
  }
  if (!environment.cacheInvalidationEndpoint || !environment.cacheInvalidationSigningSecret) {
    throw new Error('Signed cross-instance cache invalidation must be configured in production');
  }
  const invalidationUrl = secureUrl(
    environment.cacheInvalidationEndpoint,
    'CACHE_INVALIDATION_ENDPOINT',
    'invalidation',
  );
  void invalidationUrl;

  assertStrongDistinctSecrets(environment);
  assertMongoProductionSafety(source, environment);
  assertBrowserPolicyAlignment(source, environment);

  const site = secureUrl(required(source, 'SITE_URL'), 'SITE_URL', 'root');
  const publicSite = secureUrl(
    required(source, 'NEXT_PUBLIC_SITE_URL'),
    'NEXT_PUBLIC_SITE_URL',
    'root',
  );
  if (site.origin !== publicSite.origin)
    throw new Error('SITE_URL and NEXT_PUBLIC_SITE_URL must match');
  const api = secureUrl(required(source, 'API_BASE_URL'), 'API_BASE_URL', 'api');
  const publicApi = secureUrl(
    required(source, 'NEXT_PUBLIC_API_BASE_URL'),
    'NEXT_PUBLIC_API_BASE_URL',
    'api',
  );
  if (api.href.replace(/\/$/u, '') !== publicApi.href.replace(/\/$/u, '')) {
    throw new Error('API_BASE_URL and NEXT_PUBLIC_API_BASE_URL must match');
  }
  if (!environment.corsOrigins.includes(site.origin)) {
    throw new Error('CORS_ORIGINS must include the exact SITE_URL origin');
  }
  for (const origin of environment.corsOrigins) {
    const parsed = secureUrl(origin, 'CORS_ORIGINS entry', 'root');
    if (parsed.origin !== origin.replace(/\/$/u, '')) {
      throw new Error('Each CORS_ORIGINS entry must be an exact HTTPS origin');
    }
  }
  return {
    deploymentEnvironment: environment.deploymentEnvironment,
    releaseId: environment.releaseId,
    siteUrl: site.origin,
    apiBaseUrl: api.href.replace(/\/$/u, ''),
  };
}
