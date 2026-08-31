import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { Types, connection } from 'mongoose';

import { OperationalMetrics } from '../apps/server/src/analytics/metrics';
import {
  analyticsPartialBucket,
  runAnalyticsRollupWithLease,
} from '../apps/server/src/analytics/scheduler';
import {
  addReportingDays,
  reportingDay,
  reportingDayBounds,
} from '../apps/server/src/analytics/time';
import { rollupAnalyticsDay } from '../apps/server/src/analytics/rollup';
import { createApp } from '../apps/server/src/app';
import { createAuthService, hashPassword } from '../apps/server/src/auth/service';
import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { AdminSessionModel } from '../apps/server/src/persistence/models/admin-session';
import { AdminUserModel } from '../apps/server/src/persistence/models/admin-user';
import {
  AnalyticsDailyModel,
  ensureAnalyticsDailyIndexes,
} from '../apps/server/src/persistence/models/analytics-daily';
import { AnalyticsAttributionClaimModel } from '../apps/server/src/persistence/models/analytics-attribution-claim';
import {
  AnalyticsEventModel,
  analyticsEventIdEvidence,
} from '../apps/server/src/persistence/models/analytics-event';
import { AnalyticsMaterializationLockModel } from '../apps/server/src/persistence/models/analytics-materialization-lock';
import { AnonymousVisitorModel } from '../apps/server/src/persistence/models/anonymous-visitor';
import { AssessmentModel } from '../apps/server/src/persistence/models/assessment';
import { AuditLogModel } from '../apps/server/src/persistence/models/audit-log';
import { CacheInvalidationEventModel } from '../apps/server/src/persistence/models/cache-invalidation-event';
import { CalculatorModel } from '../apps/server/src/persistence/models/calculator';
import { JobRunModel } from '../apps/server/src/persistence/models/job-run';
import { LeadModel } from '../apps/server/src/persistence/models/lead';
import { LoginAttemptModel } from '../apps/server/src/persistence/models/login-attempt';
import { ResultModel } from '../apps/server/src/persistence/models/result';

const OPT_IN = '--allow-temporary-database-write';
const PREFIX = 'niro_p9_';
const PASSWORD = 'P9-Synthetic-Only!2026';
const BROWSER_PORT = 4000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function waitForBrowserFixtureShutdown(): Promise<void> {
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
    process.once('SIGBREAK', finish);
  });
}

async function cleanupOwnedFixtureDatabase(
  configured: ReturnType<typeof loadEnvironment>,
  databaseName: string,
): Promise<void> {
  assert(
    /^niro_p9_[a-f\d]{30}$/u.test(databaseName),
    'Recovery cleanup requires an exact niro_p9_<30 lowercase hex> database name.',
  );
  const environment = { ...configured, nodeEnv: 'test' as const, mongoDbName: databaseName };
  const client = await connectDatabase({ environment });
  try {
    assert(connection.name === databaseName, 'Recovery cleanup database ownership mismatch.');
    assert(client.connection.db?.databaseName === databaseName, 'Recovery target mismatch.');
    const allowedCollections = new Set([
      'admin_sessions',
      'admin_users',
      'admin_governance_locks',
      'analytics_daily',
      'analytics_attribution_claims',
      'analytics_events',
      'analytics_materialization_locks',
      'anonymous_visitors',
      'assessments',
      'audit_logs',
      'cache_invalidation_events',
      'biomarkers',
      'calculator_versions',
      'calculators',
      'job_runs',
      'leads',
      'login_attempts',
      'results',
    ]);
    const collectionNames =
      (await client.connection.db?.listCollections({}, { nameOnly: true }).toArray())?.map(
        (item) => item.name,
      ) ?? [];
    assert(collectionNames.length > 0, 'Recovery target has no P9 fixture footprint.');
    assert(
      collectionNames.every((name) => allowedCollections.has(name)),
      'Recovery target contains a non-fixture collection; cleanup refused.',
    );
    const nonFixtureDomainRows = await Promise.all(
      ['admin_governance_locks', 'biomarkers', 'calculator_versions'].map((name) =>
        client.connection.db?.collection(name).countDocuments(),
      ),
    );
    assert(
      nonFixtureDomainRows.every((count) => count === 0),
      'Recovery target contains non-fixture domain data; cleanup refused.',
    );
    const [admins, calculators, successfulJob] = await Promise.all([
      AdminUserModel.find().select('email').lean(),
      CalculatorModel.find().select('slug').lean(),
      JobRunModel.findOne({ job: /^analytics\.daily\.rollup\|/ }).lean(),
    ]);
    assert(admins.length >= 2, 'Recovery target is missing fixture admin identities.');
    assert(
      admins.every((admin) => admin.email.endsWith('@p9-fixture.invalid')),
      'Recovery target contains a non-fixture admin identity; cleanup refused.',
    );
    const calculatorSlugs = calculators.map((calculator) => calculator.slug).sort();
    assert(
      JSON.stringify(calculatorSlugs) === JSON.stringify(['synthetic-calculator']) ||
        JSON.stringify(calculatorSlugs) ===
          JSON.stringify(['analytics-search-calculator', 'synthetic-calculator']),
      'Recovery target calculator identities do not match the P9 fixture; cleanup refused.',
    );
    assert(successfulJob, 'Recovery target is missing the P9 rollup job footprint.');
    await connection.dropDatabase();
  } finally {
    await disconnectDatabase();
  }
  console.log(JSON.stringify({ status: 'ok', database: databaseName, cleanup: 'completed' }));
}

function jsonData(value: unknown): Record<string, unknown> {
  assert(
    value && typeof value === 'object' && 'data' in value,
    'API response envelope is missing.',
  );
  const data = (value as { data: unknown }).data;
  assert(data && typeof data === 'object', 'API response data is missing.');
  return data as Record<string, unknown>;
}

async function main(): Promise<void> {
  loadProjectEnvironment();
  const configured = loadEnvironment();
  assert(process.argv.includes(OPT_IN), `P9 integration requires ${OPT_IN}.`);
  assert(configured.nodeEnv !== 'production', 'P9 integration is forbidden in production.');
  assert(configured.mongoUri, 'MONGODB_URI is not configured.');
  const cleanupDatabase = process.argv
    .find((argument) => argument.startsWith('--cleanup-owned-database='))
    ?.slice('--cleanup-owned-database='.length);
  if (cleanupDatabase) {
    await cleanupOwnedFixtureDatabase(configured, cleanupDatabase);
    return;
  }
  const browserFixture = process.argv.includes('--serve-browser');
  const nonce = randomUUID().replaceAll('-', '').slice(0, 30);
  const databaseName = `${PREFIX}${nonce}`;
  const environment = { ...configured, nodeEnv: 'test' as const, mongoDbName: databaseName };
  const client = await connectDatabase({ environment });
  assert(connection.name === databaseName, 'P9 integration database isolation failed.');
  assert(client.connection.db?.databaseName === databaseName, 'Connected database is not owned.');
  let server: Server | undefined;
  let failure: unknown;
  let cleanupCompleted = false;
  let successSummary: Record<string, unknown> | undefined;
  try {
    await Promise.all([
      AdminSessionModel.syncIndexes(),
      AdminUserModel.syncIndexes(),
      AnalyticsEventModel.syncIndexes(),
      AnalyticsAttributionClaimModel.syncIndexes(),
      AnalyticsMaterializationLockModel.syncIndexes(),
      AnonymousVisitorModel.syncIndexes(),
      AssessmentModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
      CacheInvalidationEventModel.syncIndexes(),
      CalculatorModel.syncIndexes(),
      JobRunModel.syncIndexes(),
      LeadModel.syncIndexes(),
      LoginAttemptModel.syncIndexes(),
      ResultModel.syncIndexes(),
    ]);
    await AnalyticsDailyModel.collection.createIndex(
      { day: 1, timezone: 1, scopeKey: 1, identityKeyVersion: 1 },
      { unique: true, name: 'p9_fixture_legacy_partition_unique' },
    );
    const analyticsIndexUpgrades = await Promise.all([
      ensureAnalyticsDailyIndexes(),
      ensureAnalyticsDailyIndexes(),
    ]);
    assert(
      analyticsIndexUpgrades.some((upgrade) =>
        upgrade.droppedLegacyIndexes.includes('p9_fixture_legacy_partition_unique'),
      ),
      'Analytics daily legacy unique index was not safely migrated.',
    );
    const analyticsIndexes = await AnalyticsDailyModel.collection.indexes();
    const partitionIndex = analyticsIndexes.find(
      (index) => index.name === 'analytics_daily_partition_unique_v3',
    );
    assert(
      partitionIndex?.unique === true &&
        JSON.stringify(partitionIndex.key) ===
          JSON.stringify({
            day: 1,
            timezone: 1,
            scope: 1,
            scopeKey: 1,
            identityBasis: 1,
            identityKeyVersion: 1,
          }),
      'Analytics daily partition index is missing after migration.',
    );
    const now = new Date();
    const sourceRetentionDays = { events: 30, assessments: 30, leads: 30, visitors: 45 };
    const timezone = 'Asia/Kolkata';
    const today = reportingDay(now, timezone);
    const day = addReportingDays(today, -1);
    const bounds = reportingDayBounds(day, timezone);
    const occurredAt = new Date(
      Math.min(
        bounds.end.getTime() - 60_000,
        Math.max(bounds.start.getTime() + 60_000, now.getTime() - 23 * 3_600_000),
      ),
    );
    const expiresAt = new Date(now.getTime() + 30 * 86_400_000);
    const metrics = new OperationalMetrics();
    const authService = createAuthService({
      accessSecret: `access-${nonce}`,
      refreshSecret: `refresh-${nonce}`,
      bcryptRounds: 4,
    });
    const [admin, editor] = await AdminUserModel.create([
      {
        email: `admin-${nonce.slice(0, 10)}@p9-fixture.invalid`,
        passwordHash: await hashPassword(PASSWORD, 4),
        role: 'admin',
        status: 'active',
      },
      {
        email: `editor-${nonce.slice(0, 10)}@p9-fixture.invalid`,
        passwordHash: await hashPassword(PASSWORD, 4),
        role: 'editor',
        status: 'active',
      },
    ]);
    assert(admin && editor, 'Synthetic admin identities were not created.');
    await CalculatorModel.create([
      {
        slug: 'analytics-search-calculator',
        name: 'Synthetic published analytics search identity',
        status: 'published',
        createdBy: admin._id,
      },
      {
        slug: 'synthetic-calculator',
        name: 'Synthetic P9 analytics calculator',
        status: 'published',
        createdBy: admin._id,
      },
    ]);
    const app = createApp(
      environment,
      { databaseReady: () => true },
      {
        authService,
        analyticsHashSecret: `analytics-${nonce}`,
        analyticsRetentionDays: 30,
        analyticsReportingTimezone: timezone,
        analyticsSearchVocabulary: {
          canonicalize: async (query) =>
            query === 'analytics-search-calculator' ? query : '[other]',
          isPublishedCalculator: async (slug) =>
            ['analytics-search-calculator', 'synthetic-calculator'].includes(slug),
          isVerifiedMeasurement: async () => false,
          isValidStep: async (slug, step, index) =>
            slug === 'synthetic-calculator' &&
            step === 'labs' &&
            (index === undefined || index === 0),
          isValidParameterUnit: async (slug, parameterKey, unit) =>
            slug === 'synthetic-calculator' && parameterKey === 'marker' && unit === 'mg/dL',
        },
        analyticsVisitorPersistence: {
          enabled: true,
          retentionDays: 45,
          consentVersion: 'p9-fixture-v1',
        },
        operationalMetrics: metrics,
      },
    );
    server = app.listen(browserFixture ? BROWSER_PORT : 0, '127.0.0.1');
    await new Promise<void>((resolve) => server?.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string', 'P9 integration server unavailable.');
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    const events = [
      [
        'event-a-1',
        'page_view',
        { path: '/c/synthetic-calculator', calculatorSlug: 'synthetic-calculator' },
      ],
      ['event-a-2', 'calc_start', { calculatorSlug: 'synthetic-calculator' }],
      [
        'event-a-3',
        'step_view',
        { calculatorSlug: 'synthetic-calculator', step: 'labs', stepIndex: 0 },
      ],
      [
        'event-a-4',
        'unit_switch',
        { calculatorSlug: 'synthetic-calculator', parameterKey: 'marker', unit: 'mg/dL' },
      ],
      ['event-a-5', 'assess_submit', { calculatorSlug: 'synthetic-calculator' }],
      ['event-a-6', 'result_view', { calculatorSlug: 'synthetic-calculator' }],
      [
        'event-a-7',
        'share_open',
        {
          path: '/results/live-secret-capability',
          calculatorSlug: 'synthetic-calculator',
          action: 'open',
        },
      ],
      ['event-a-8', 'search', { query: 'analytics-search-calculator', zeroResults: false }],
      ['event-a-9', 'search', { query: 'Jane private medical condition', zeroResults: true }],
    ].map(([eventId, type, props], index) => ({
      eventId,
      type,
      occurredAt: new Date(occurredAt.getTime() + index * 1_000).toISOString(),
      ...(index === 8 ? {} : { visitorId: 'same-synthetic-identity' }),
      sessionId: 'same-synthetic-identity',
      props,
    }));
    const ingestRequest = () =>
      fetch(`${base}/events`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
          'accept-language': 'en-IN,en;q=0.9',
        },
        body: JSON.stringify({ events }),
      });
    const concurrentIngest = await Promise.all([ingestRequest(), ingestRequest()]);
    assert(
      concurrentIngest.every((response) => response.status === 202),
      'Concurrent idempotent event ingest did not return 202.',
    );
    const ingestOutcomes = await Promise.all(
      concurrentIngest.map(async (response) => jsonData(await response.json())),
    );
    const acceptedTotal = ingestOutcomes.reduce(
      (total, outcome) => total + Number(outcome.accepted ?? 0),
      0,
    );
    const duplicatesTotal = ingestOutcomes.reduce(
      (total, outcome) => total + Number(outcome.duplicates ?? 0),
      0,
    );
    assert(acceptedTotal === events.length, 'Concurrent ingest accepted an incorrect total.');
    assert(duplicatesTotal === events.length, 'Concurrent replay did not report all duplicates.');
    const storedEvents = await AnalyticsEventModel.find().sort({ occurredAt: 1 }).lean();
    assert(storedEvents.length === events.length, 'Event replay created duplicate documents.');
    assert(
      storedEvents.every(
        (event) =>
          event.eventIdHashVersion === 'hmac-v1' && /^v1:[a-f\d]{64}$/u.test(event.eventId),
      ),
      'Client event IDs crossed the persistence boundary without keyed evidence.',
    );
    assert(
      !events.some((input) => storedEvents.some((stored) => stored.eventId === input.eventId)),
      'A raw client event ID was persisted.',
    );
    assert(
      storedEvents[0]?.visitorIdHash !== storedEvents[0]?.sessionIdHash,
      'Visitor and session hashes were not domain-separated.',
    );
    assert(
      storedEvents.find((event) => event.type === 'share_open')?.path === '/results/[capability]',
      'Share capability path was not redacted.',
    );
    const searchQueries = storedEvents
      .filter((event) => event.type === 'search')
      .map((event) => event.query)
      .sort();
    assert(
      searchQueries.join(',') === '[other],analytics-search-calculator',
      'Search telemetry was not reduced to verified canonical identifiers and [other].',
    );
    assert(
      !JSON.stringify(storedEvents).includes('Jane private medical condition'),
      'Unverified search text leaked at rest.',
    );
    assert(
      !JSON.stringify(storedEvents).includes('live-secret-capability'),
      'Capability leaked at rest.',
    );
    const attributionResponses = await Promise.all(
      [
        ['attribution-race-a', 'first-referrer.example', 'first-source'],
        ['attribution-race-b', 'second-referrer.example', 'second-source'],
      ].map(([eventId, referrerHost, utmSource]) =>
        fetch(`${base}/events`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
          },
          body: JSON.stringify({
            events: [
              {
                eventId,
                type: 'page_view',
                occurredAt: occurredAt.toISOString(),
                sessionId: 'attribution-race-session',
                props: { path: '/', referrerHost, utmSource },
              },
            ],
          }),
        }),
      ),
    );
    assert(
      attributionResponses.every((response) => response.status === 202),
      'Concurrent attribution ingest did not return 202.',
    );
    const attributedEvents = await AnalyticsEventModel.find({
      eventId: {
        $in: ['attribution-race-a', 'attribution-race-b'].map((eventId) =>
          analyticsEventIdEvidence(eventId, `analytics-${nonce}`),
        ),
      },
      referrerHost: { $exists: true },
    }).lean();
    assert(
      attributedEvents.length === 1 &&
        (await AnalyticsAttributionClaimModel.countDocuments()) === 1,
      'Atomic attribution claim did not retain exactly one session attribution.',
    );

    const calculatorVersionId = new Types.ObjectId();
    const assessmentIds = Array.from({ length: 5 }, () => new Types.ObjectId());
    await AssessmentModel.create(
      assessmentIds.map((assessmentId, index) => ({
        _id: assessmentId,
        calculatorVersionId,
        calculatorSlug: 'synthetic-calculator',
        calculatorVersion: 1,
        engineSemanticVersion: '1.0.0',
        inputsEntered: { marker: { value: index + 1, unit: 'mg/dL' } },
        inputsCanonical: { marker: { value: index + 1, unit: 'mg/dL' } },
        omittedParameters: ['optional-marker'],
        expiresAt,
        createdAt: new Date(occurredAt.getTime() + index * 1_000),
        updatedAt: new Date(occurredAt.getTime() + index * 1_000),
      })),
    );
    await ResultModel.create(
      assessmentIds.map((assessmentId, index) => ({
        _id: new Types.ObjectId(),
        assessmentId,
        calculatorVersionId,
        calculatorSlug: 'synthetic-calculator',
        calculatorVersion: 1,
        engineSemanticVersion: '1.0.0',
        score: 42,
        computeMs: 3.5,
        category: { label: 'Synthetic category' },
        projection: { score: 42 },
        expiresAt,
        createdAt: new Date(occurredAt.getTime() + index * 1_000),
        updatedAt: new Date(occurredAt.getTime() + index * 1_000),
      })),
    );
    await LeadModel.create({
      email: `lead-${nonce.slice(0, 10)}@p9-fixture.invalid`,
      consent: true,
      consentVersion: 'privacy-v1',
      expiresAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    await LoginAttemptModel.create({
      accountHash: authService.securityEvidence(
        'account',
        `failed-${nonce.slice(0, 10)}@p9-fixture.invalid`,
      ),
      success: false,
      reason: 'synthetic-invalid-password',
      createdAt: occurredAt,
    });
    await CacheInvalidationEventModel.create({
      calculatorSlug: 'synthetic-calculator',
      reason: 'publish',
      paths: ['/calculators/synthetic-calculator'],
      status: 'pending',
      attempts: 0,
      expiresAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });

    const scheduledFor = bounds.start;
    const [leaseA, leaseB] = await Promise.all([
      runAnalyticsRollupWithLease({
        day,
        timezone,
        visitorPersistenceEnabled: true,
        identityKeyVersion: 'v1',
        minimumCohortSize: 5,
        sourceRetentionDays,
        scheduledFor,
        owner: 'p9-worker-a',
      }),
      runAnalyticsRollupWithLease({
        day,
        timezone,
        visitorPersistenceEnabled: true,
        identityKeyVersion: 'v1',
        minimumCohortSize: 5,
        sourceRetentionDays,
        scheduledFor,
        owner: 'p9-worker-b',
      }),
    ]);
    assert(
      [leaseA.status, leaseB.status].sort().join(',') === 'skipped,succeeded',
      'Distributed lease did not select exactly one worker.',
    );
    const rerun = await runAnalyticsRollupWithLease({
      day,
      timezone,
      visitorPersistenceEnabled: true,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      sourceRetentionDays,
      scheduledFor,
      owner: 'p9-worker-c',
    });
    assert(rerun.status === 'skipped', 'Succeeded job was not idempotently skipped.');
    const daily = await AnalyticsDailyModel.find({ day, scopeKey: 'global' }).lean();
    assert(
      daily.reduce((total, row) => total + row.sourceEventCount, 0) === events.length + 2,
      'Daily source event count is incorrect.',
    );
    assert(
      daily.length === 2 &&
        daily.some((row) => row.identityBasis === 'visitor') &&
        daily.some((row) => row.identityBasis === 'session'),
      'Visitor and session-fallback events were not materialized into separate partitions.',
    );
    assert(
      daily.some(
        (row) => row.identityBasis === 'visitor' && row.sessions === 1 && row.visitors === 1,
      ) &&
        daily.some(
          (row) => row.identityBasis === 'session' && row.sessions === 2 && row.visitors === 2,
        ),
      'Daily unique identity counts are wrong.',
    );
    assert(
      daily.every((row) => row.assessments === 5 && row.results === 5 && row.leads === 1),
      'Daily product counts are wrong.',
    );
    const calculatorDaily = await AnalyticsDailyModel.findOne({
      day,
      scopeKey: 'calculator:synthetic-calculator',
    }).lean();
    const encodedVersionId = `v_${Buffer.from(calculatorVersionId.toString(), 'utf8').toString(
      'base64url',
    )}`;
    assert(
      calculatorDaily?.versionCounts?.[encodedVersionId] === 5,
      'Exact calculatorVersionId adoption was not retained.',
    );

    await AnalyticsEventModel.create({
      eventId: analyticsEventIdEvidence('logically-expired-event', `analytics-${nonce}`),
      eventIdHashVersion: 'hmac-v1',
      type: 'page_view',
      occurredAt,
      sessionIdHash: 'f'.repeat(64),
      identityKeyVersion: 'v1',
      path: '/expired',
      device: 'desktop',
      browser: 'Other',
      os: 'Other',
      locale: 'en-IN',
      expiresAt: new Date(now.getTime() - 1_000),
    });
    await rollupAnalyticsDay({
      day,
      timezone,
      visitorPersistenceEnabled: true,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      sourceRetentionDays,
      now,
    });
    const reconciled = await AnalyticsDailyModel.find({ day, scopeKey: 'global' }).lean();
    assert(
      reconciled.reduce((total, row) => total + row.sourceEventCount, 0) === events.length + 2,
      'Expired event was re-aggregated.',
    );

    const todayBounds = reportingDayBounds(today, timezone);
    const firstPartialAt = new Date(Math.max(todayBounds.start.getTime(), now.getTime() - 60_000));
    await AnalyticsEventModel.create({
      eventId: analyticsEventIdEvidence('partial-event-one', `analytics-${nonce}`),
      eventIdHashVersion: 'hmac-v1',
      type: 'page_view',
      occurredAt: firstPartialAt,
      sessionIdHash: '1'.repeat(64),
      identityKeyVersion: 'v1',
      path: '/',
      device: 'desktop',
      browser: 'Other',
      os: 'Other',
      locale: 'en-IN',
      expiresAt,
    });
    const partialOne = await runAnalyticsRollupWithLease({
      day: today,
      timezone,
      visitorPersistenceEnabled: true,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      sourceRetentionDays,
      job: 'analytics.daily.partial',
      scheduledFor: analyticsPartialBucket(new Date(now.getTime() - 5 * 60_000)),
      owner: 'p9-partial-worker-a',
    });
    assert(partialOne.status === 'succeeded', 'First current-day partial did not run.');
    const firstPartial = await AnalyticsDailyModel.findOne({
      day: today,
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
    }).lean();
    assert(firstPartial?.sourceEventCount === 1, 'First current-day partial was incorrect.');
    await AnalyticsEventModel.create({
      eventId: analyticsEventIdEvidence('partial-event-two', `analytics-${nonce}`),
      eventIdHashVersion: 'hmac-v1',
      type: 'page_view',
      occurredAt: new Date(Math.min(now.getTime(), firstPartialAt.getTime() + 1_000)),
      sessionIdHash: '2'.repeat(64),
      identityKeyVersion: 'v1',
      path: '/',
      device: 'mobile',
      browser: 'Other',
      os: 'Other',
      locale: 'en-IN',
      expiresAt,
    });
    const partialTwo = await runAnalyticsRollupWithLease({
      day: today,
      timezone,
      visitorPersistenceEnabled: true,
      identityKeyVersion: 'v1',
      minimumCohortSize: 5,
      sourceRetentionDays,
      job: 'analytics.daily.partial',
      scheduledFor: analyticsPartialBucket(now),
      owner: 'p9-partial-worker-b',
    });
    assert(partialTwo.status === 'succeeded', 'Second current-day partial did not run.');
    const secondPartial = await AnalyticsDailyModel.findOne({
      day: today,
      scopeKey: 'global',
      identityBasis: 'session',
      identityKeyVersion: 'v1',
    }).lean();
    assert(
      secondPartial?.sourceEventCount === 2,
      'Current-day partial replacement double-counted or missed a later event.',
    );

    const adminTokens = await authService.login(admin.email, PASSWORD);
    const editorTokens = await authService.login(editor.email, PASSWORD);
    const query = `from=${day}&to=${day}`;
    const adminHeaders = { authorization: `Bearer ${adminTokens.accessToken}` };
    const editorHeaders = { authorization: `Bearer ${editorTokens.accessToken}` };
    for (const path of [
      `overview?${query}`,
      `engagement?${query}`,
      `funnel/synthetic-calculator?${query}`,
      `scores/synthetic-calculator?${query}`,
      `leads?${query}`,
      `security?${query}`,
      'ops',
    ]) {
      const response = await fetch(`${base}/admin/analytics/${path}`, { headers: editorHeaders });
      assert(response.status === 200, `Analytics endpoint ${path} failed (${response.status}).`);
      assert(response.headers.get('cache-control') === 'no-store', `${path} is cacheable.`);
      const text = await response.text();
      for (const protectedValue of [
        'same-synthetic-identity',
        'live-secret-capability',
        'inputsEntered',
        'inputsCanonical',
        'trace',
        'formula',
      ]) {
        assert(!text.includes(protectedValue), `${path} leaked ${protectedValue}.`);
      }
    }
    const scoreResponse = await fetch(
      `${base}/admin/analytics/scores/synthetic-calculator?${query}`,
      { headers: editorHeaders },
    );
    const scoreData = jsonData(await scoreResponse.json());
    assert(scoreData.suppressed === false, 'Cohort-sized score intelligence was suppressed.');
    assert(scoreData.sampleSize === 5, 'Score result sample size is incorrect.');
    assert(scoreData.successfulAssessments === 5, 'Successful assessment count is incorrect.');
    assert(
      Array.isArray(scoreData.versionAdoption) &&
        scoreData.versionAdoption.some(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            (item as Record<string, unknown>).key === calculatorVersionId.toString() &&
            (item as Record<string, unknown>).count === 5,
        ),
      'Dashboard did not expose exact calculatorVersionId adoption.',
    );
    const editorExport = await fetch(`${base}/admin/analytics/exports/leads.csv?${query}`, {
      headers: editorHeaders,
    });
    assert(editorExport.status === 403, 'Editor accessed PII export.');
    const leadExport = await fetch(`${base}/admin/analytics/exports/leads.csv?${query}`, {
      headers: adminHeaders,
    });
    assert(leadExport.status === 200, 'Admin lead export failed.');
    const assessmentExport = await fetch(
      `${base}/admin/analytics/exports/assessments.csv?${query}&calculator=synthetic-calculator`,
      { headers: adminHeaders },
    );
    const assessmentCsv = await assessmentExport.text();
    assert(assessmentExport.status === 200, 'Admin assessment export failed.');
    assert(
      !assessmentCsv.includes('mg/dL') && !assessmentCsv.includes('value'),
      'Assessment CSV leaked health inputs.',
    );
    const exportAudits = await AuditLogModel.find({ action: /^analytics\.export\./ }).lean();
    assert(exportAudits.length === 2, 'Sensitive exports were not audited.');
    assert(
      !JSON.stringify(exportAudits).includes('@p9-fixture.invalid'),
      'Export audit stored PII.',
    );
    const opsResponse = await fetch(`${base}/admin/analytics/ops`, { headers: adminHeaders });
    const ops = jsonData(await opsResponse.json());
    assert(
      (ops.cacheInvalidations as Record<string, unknown>).pending === 1,
      'Durable pending cache invalidation was absent from ops.',
    );
    const metricsResponse = await fetch(`${base}/admin/analytics/metrics`, {
      headers: adminHeaders,
    });
    assert(metricsResponse.status === 200, 'Protected Prometheus metrics endpoint failed.');
    assert((await metricsResponse.text()).includes('niro_http_requests_total'), 'Metrics missing.');

    const ttlIndexes = await Promise.all([
      AnalyticsEventModel.collection.indexes(),
      AnalyticsAttributionClaimModel.collection.indexes(),
      AnonymousVisitorModel.collection.indexes(),
      LeadModel.collection.indexes(),
      AssessmentModel.collection.indexes(),
      ResultModel.collection.indexes(),
    ]);
    for (const indexes of ttlIndexes) {
      assert(
        indexes.some((index) => index.expireAfterSeconds === 0),
        'A retention-bound collection is missing its TTL index.',
      );
    }
    const job = await JobRunModel.findOne({
      job: /^analytics\.daily\.rollup\|/,
      scheduledFor,
    }).lean();
    assert(job?.status === 'succeeded' && job.attempt === 1, 'Durable job state is incorrect.');
    assert(
      (await AnalyticsMaterializationLockModel.countDocuments()) === 0,
      'Analytics day materialization lease was not released.',
    );
    if (browserFixture) {
      console.log(
        JSON.stringify({
          status: 'browser-fixture-ready',
          database: databaseName,
          server: `http://127.0.0.1:${BROWSER_PORT}`,
          credentials: { email: admin.email, password: PASSWORD, role: 'admin' },
          clientEnvironment: {
            NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${BROWSER_PORT}/api/v1`,
            NEXT_PUBLIC_ANALYTICS_ENABLED: 'true',
            NEXT_PUBLIC_ANALYTICS_REPORTING_TIMEZONE: timezone,
            NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED: 'true',
            NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS: '45',
            NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION: 'p9-fixture-v1',
          },
          cleanup: 'automatic-on-signal',
        }),
      );
      await waitForBrowserFixtureShutdown();
    }
    successSummary = {
      status: 'ok',
      database: databaseName,
      eventIngest: 'concurrent-idempotent-private',
      rollup: 'leased-idempotent-retention-aware',
      dashboard: 'rbac-and-exports-verified',
    };
  } catch (error) {
    failure = error;
  } finally {
    await closeServer(server);
    try {
      assert(connection.name === databaseName, 'Cleanup database ownership changed unexpectedly.');
      assert(
        databaseName.startsWith(PREFIX) && databaseName.length === 38,
        'Cleanup target is unsafe.',
      );
      await connection.dropDatabase();
      cleanupCompleted = true;
    } catch (cleanupError) {
      failure = failure ?? cleanupError;
    }
    await disconnectDatabase();
  }
  if (failure) {
    console.log(
      JSON.stringify({
        status: 'failed',
        database: databaseName,
        cleanup: cleanupCompleted ? 'completed' : 'failed',
      }),
    );
    throw failure;
  }
  console.log(JSON.stringify({ ...successSummary, cleanup: 'completed' }));
}

void main().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : 'P9 analytics integration failed.');
  process.exitCode = 1;
});
