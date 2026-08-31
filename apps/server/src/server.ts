import { createApp } from './app';
import { loadEnvironment, loadProjectEnvironment } from './config/env';
import { assertProductionRuntimeEnvironment } from './config/production';
import { connectDatabase, isDatabaseReady } from './db/connection';
import { createAuthService, scrubLegacyLoginAttemptEmails } from './auth/service';
import { ensureMeasurementRevisionIndexes } from './persistence/models/measurement-revision';
import { ensureAnalyticsDailyIndexes } from './persistence/models/analytics-daily';
import { ensureAnalyticsAttributionClaimIndexes } from './persistence/models/analytics-attribution-claim';
import { scrubLegacyAnalyticsEventIds } from './persistence/models/analytics-event';
import { createServerPersistenceDependencies } from './runtime-persistence';

async function main(): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (environment.nodeEnv === 'production') {
    assertProductionRuntimeEnvironment(process.env, environment);
  }
  const persistence = createServerPersistenceDependencies(environment);
  const authService =
    environment.authAccessSecret && environment.authRefreshSecret
      ? createAuthService({
          accessSecret: environment.authAccessSecret,
          refreshSecret: environment.authRefreshSecret,
        })
      : undefined;
  if (environment.mongoUri) {
    await connectDatabase({ environment });
    await ensureMeasurementRevisionIndexes();
    await ensureAnalyticsDailyIndexes();
    await ensureAnalyticsAttributionClaimIndexes();
    if (environment.analyticsHashSecret) {
      await scrubLegacyAnalyticsEventIds(environment.analyticsHashSecret);
    }
    if (authService) await scrubLegacyLoginAttemptEmails(authService);
  } else if (environment.nodeEnv === 'production') {
    throw new Error('MONGODB_URI is required in production');
  }

  let shuttingDown = false;
  const app = createApp(
    environment,
    { databaseReady: () => !shuttingDown && isDatabaseReady() },
    {
      assessmentStore: persistence.assessmentStore,
      authService,
      analyticsHashSecret: environment.analyticsHashSecret,
      analyticsRetentionDays: environment.analyticsEventsRetentionDays,
      analyticsIdentityKeyVersion: environment.analyticsIdentityKeyVersion,
      analyticsReportingTimezone: environment.analyticsReportingTimezone,
      analyticsVisitorPersistence: {
        enabled: environment.analyticsVisitorPersistenceEnabled,
        retentionDays: environment.analyticsVisitorRetentionDays,
        consentVersion: environment.analyticsVisitorConsentVersion,
      },
      analyticsMinimumCohortSize: environment.analyticsMinimumCohortSize,
      leadCapture: persistence.leadCapture,
    },
  );
  const server = app.listen(environment.port, environment.host, () => {
    console.log(
      `Niro server foundation listening on http://${environment.host}:${environment.port}`,
    );
  });

  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down server foundation`);
    const forcedShutdown = setTimeout(() => {
      console.error('Graceful shutdown deadline exceeded; closing remaining connections.');
      server.closeAllConnections();
    }, 25_000);
    forcedShutdown.unref();
    server.closeIdleConnections();
    void server.close(async () => {
      clearTimeout(forcedShutdown);
      const { disconnectDatabase } = await import('./db/connection');
      await disconnectDatabase();
      process.exit(0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
