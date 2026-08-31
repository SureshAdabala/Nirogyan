import { createHash, timingSafeEqual } from 'node:crypto';

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { DestinationStream } from 'pino';
import pinoHttp from 'pino-http';

import type { AppEnvironment } from './config/env';
import { createAuthRouter, type AuthenticatedRequest, requireAdmin } from './auth/http';
import type { AuthService } from './auth/service';
import {
  CacheInvalidationHookError,
  createAdminRouter,
  type AdminRouterOptions,
} from './modules/admin';
import { createAnalyticsRouter, type AnalyticsSearchVocabulary } from './modules/analytics';
import { createAdminAnalyticsRouter } from './analytics/dashboard';
import { OperationalMetrics } from './analytics/metrics';
import { createPublicRouter, type PublicRouterOptions } from './modules/public';
import { ImmutableVersionError, LifecycleTransitionError } from './persistence/lifecycle';
import { PersistenceConflictError } from './persistence/transactions';

export interface ReadinessState {
  readonly databaseReady: () => boolean;
}

export interface AppOptions extends PublicRouterOptions {
  readonly authService?: AuthService;
  readonly analyticsHashSecret?: string;
  readonly analyticsRetentionDays?: number;
  readonly analyticsIdentityKeyVersion?: string;
  readonly analyticsReportingTimezone?: string;
  readonly analyticsVisitorPersistence?: {
    readonly enabled: boolean;
    readonly retentionDays?: number;
    readonly consentVersion?: string;
  };
  readonly operationalMetrics?: OperationalMetrics;
  readonly analyticsMinimumCohortSize?: number;
  /** Test/fixture injection; production uses the Mongo-backed published config vocabulary. */
  readonly analyticsSearchVocabulary?: AnalyticsSearchVocabulary;
  readonly adminRouter?: AdminRouterOptions;
  /** Test/host injection only; production defaults to pino's standard destination. */
  readonly requestLogStream?: DestinationStream;
}

function secretEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function bearerToken(value: string | undefined): string | undefined {
  if (!value?.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length);
  return token && token === token.trim() ? token : undefined;
}

export function redactCapabilityUrl(url: string): string {
  return url.replace(/(\/(?:api\/v1\/)?results\/)[^/?#]+/, '$1[REDACTED]');
}

export function safeRequestLogUrl(url: string): string {
  return redactCapabilityUrl(url.split(/[?#]/u, 1)[0] ?? '/');
}

export function createApp(
  environment: AppEnvironment,
  readiness: ReadinessState = { databaseReady: () => false },
  options: AppOptions = {},
): Express {
  const app = express();
  const operationalMetrics =
    options.operationalMetrics ?? new OperationalMetrics(environment.nodeEnv === 'production');

  app.disable('x-powered-by');
  app.set('trust proxy', environment.trustProxyHops);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'frame-ancestors': ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(
    cors({
      origin: [...environment.corsOrigins],
      credentials: true,
      exposedHeaders: ['ETag', 'Retry-After'],
    }),
  );
  app.use(operationalMetrics.middleware());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      level: environment.logLevel,
      stream: options.requestLogStream,
      customProps() {
        return {
          service: 'niro-server',
          releaseId: environment.releaseId,
          deploymentEnvironment: environment.deploymentEnvironment ?? 'local',
        };
      },
      serializers: {
        req(request: Record<string, unknown> & { url?: string }) {
          // Explicit allowlist: request headers, query objects, raw addresses,
          // and referrers can contain identifiers or health-search text. The
          // analytics boundary derives coarse UA/locale values separately.
          return {
            id: request.id,
            method: request.method,
            url: typeof request.url === 'string' ? safeRequestLogUrl(request.url) : undefined,
          };
        },
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.idempotency-key',
          'req.headers.x-forwarded-for',
          'req.headers.x-real-ip',
          'req.headers["x-csrf-token"]',
          'req.body.password',
          'req.body.email',
          'req.body.refreshToken',
          'req.body.accessToken',
          'req.body.csrfToken',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
    }),
  );

  app.get('/healthz', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({
      status: 'ok',
      service: 'niro-server',
      releaseId: environment.releaseId,
    });
  });

  app.get('/readyz', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (readiness.databaseReady()) {
      response.status(200).json({
        status: 'ready',
        service: 'niro-server',
        releaseId: environment.releaseId,
      });
      return;
    }

    response.status(503).json({ status: 'not_ready', reason: 'database connection is not ready' });
  });

  app.get('/metrics', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!environment.metricsScrapeToken) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
      return;
    }
    const supplied = bearerToken(request.header('authorization'));
    if (!supplied || !secretEqual(supplied, environment.metricsScrapeToken)) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } });
      return;
    }
    response.setHeader('Content-Type', operationalMetrics.registry.contentType);
    response.status(200).send(await operationalMetrics.registry.metrics());
  });

  // Keep the public assessment limiter scoped away from administrative traffic.
  // The public router owns a root-mounted sub-router, so mounting it first would
  // otherwise count every Studio request against the anonymous assessment quota.
  app.use('/api/v1/admin/auth', createAuthRouter(options.authService));
  app.use('/api/v1/admin', createAdminRouter(options.authService, options.adminRouter));
  app.use(
    '/api/v1/admin/analytics',
    createAdminAnalyticsRouter(options.authService, {
      timezone: options.analyticsReportingTimezone ?? 'Asia/Kolkata',
      visitorPersistenceEnabled: options.analyticsVisitorPersistence?.enabled ?? false,
      identityKeyVersion: options.analyticsIdentityKeyVersion ?? 'v1',
      minimumCohortSize: options.analyticsMinimumCohortSize ?? 5,
      metrics: operationalMetrics,
      databaseReady: readiness.databaseReady,
    }),
  );
  if (options.authService) {
    app.get('/api/v1/admin/me', requireAdmin(options.authService), (request, response) => {
      response.status(200).json({ data: (request as AuthenticatedRequest).admin });
    });
  }
  app.use(
    '/api/v1/events',
    createAnalyticsRouter({
      hashSecret: options.analyticsHashSecret,
      retentionDays: options.analyticsRetentionDays,
      identityKeyVersion: options.analyticsIdentityKeyVersion,
      visitorPersistence: options.analyticsVisitorPersistence,
      metrics: operationalMetrics,
      searchVocabulary: options.analyticsSearchVocabulary,
    }),
  );
  if (environment.publicTestCatalogEnabled) {
    app.use(
      '/api/v1/public-test',
      createPublicRouter({
        ...options,
        publicTestRelease: true,
        catalogCacheObserver: operationalMetrics,
      }),
    );
  }
  app.use(
    '/api/v1',
    createPublicRouter({
      ...options,
      publicTestRelease: false,
      catalogCacheObserver: operationalMetrics,
    }),
  );
  app.use('/api/v1/admin', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Administrative endpoint not found.' } });
  });

  app.use(
    (
      error: unknown,
      request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      if (response.headersSent) return;
      const normalizedPath =
        request.path.length > 1 ? request.path.replace(/\/+$/, '') : request.path;
      const isResultPath =
        normalizedPath.startsWith('/api/v1/results/') ||
        normalizedPath.startsWith('/api/v1/public-test/results/');
      if (
        normalizedPath.endsWith('/assess') ||
        normalizedPath === '/api/v1/leads' ||
        isResultPath
      ) {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Pragma', 'no-cache');
      }
      if (isResultPath) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (isResultPath && error instanceof URIError) {
        response
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Result not found or expired.' } });
        return;
      }
      if (request.path.startsWith('/api/v1/admin')) {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Pragma', 'no-cache');
        response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        (error as { type?: unknown }).type === 'entity.parse.failed'
      ) {
        response.status(400).json({
          error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' },
        });
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        (error as { type?: unknown }).type === 'entity.too.large'
      ) {
        response.status(413).json({
          error: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large.' },
        });
        return;
      }
      if (error instanceof ImmutableVersionError) {
        response.status(409).json({
          error: { code: 'VERSION_IMMUTABLE', message: error.message },
        });
        return;
      }
      if (error instanceof LifecycleTransitionError) {
        response.status(409).json({
          error: { code: 'VERSION_CONFLICT', message: error.message },
        });
        return;
      }
      if (error instanceof CacheInvalidationHookError) {
        response.status(503).json({
          error: {
            code: 'CACHE_INVALIDATION_PENDING',
            message:
              'The database change committed, but downstream cache invalidation is pending retry.',
          },
        });
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 11000
      ) {
        response.status(409).json({
          error: { code: 'DUPLICATE_RESOURCE', message: 'The requested resource already exists.' },
        });
        return;
      }
      if (
        error instanceof PersistenceConflictError ||
        (error instanceof Error && error.name === 'VersionError')
      ) {
        response.status(409).json({
          error: { code: 'VERSION_CONFLICT', message: 'The resource changed; reload and retry.' },
        });
        return;
      }
      if (
        error instanceof Error &&
        [
          'MongooseServerSelectionError',
          'MongoNetworkError',
          'MongoNetworkTimeoutError',
          'MongoNotConnectedError',
        ].includes(error.name)
      ) {
        response.status(503).json({
          error: {
            code: 'PERSISTENCE_UNAVAILABLE',
            message: 'Administrative persistence is temporarily unavailable.',
          },
        });
        return;
      }
      request.log.error(
        {
          error: {
            name: error instanceof Error ? error.name : 'UnknownError',
          },
        },
        'Unhandled application error',
      );
      response.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
      });
    },
  );

  return app;
}
