import mongoose, { type Connection } from 'mongoose';

import { loadProjectEnvironment } from '../apps/server/src/config/env';

export const REQUIRED_RESTORE_COLLECTIONS = [
  'admin_governance_locks',
  'admin_sessions',
  'admin_users',
  'analytics_attribution_claims',
  'analytics_daily',
  'analytics_events',
  'analytics_materialization_locks',
  'anonymous_visitors',
  'assessments',
  'audit_logs',
  'cache_invalidation_events',
  'calculator_versions',
  'calculators',
  'job_runs',
  'leads',
  'login_attempts',
  'biomarkers',
  'results',
] as const;

export function missingRequiredRestoreCollections(
  actualCollections: Iterable<string>,
): readonly (typeof REQUIRED_RESTORE_COLLECTIONS)[number][] {
  const actual = new Set(actualCollections);
  return REQUIRED_RESTORE_COLLECTIONS.filter((name) => !actual.has(name));
}

export function assertRestoreVerificationTarget(options: {
  readonly allowReadOnly: boolean;
  readonly expectedDbName: string | undefined;
  readonly configuredDbName: string | undefined;
  readonly targetLabel: string | undefined;
  readonly uri: string | undefined;
}): void {
  if (!options.allowReadOnly) {
    throw new Error('Pass --allow-read-only-restore-verification to authorize read-only checks.');
  }
  if (!options.uri || /<[^>]+>/u.test(options.uri)) {
    throw new Error('RESTORE_MONGODB_URI must be a configured Atlas restore-target URI.');
  }
  if (
    !options.configuredDbName ||
    !options.expectedDbName ||
    options.configuredDbName !== options.expectedDbName
  ) {
    throw new Error('--expected-db-name must exactly match RESTORE_MONGODB_DB_NAME.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/u.test(options.configuredDbName)) {
    throw new Error('RESTORE_MONGODB_DB_NAME must be a safe explicit database name.');
  }
  if (
    !options.targetLabel ||
    !/^restore-drill-[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/u.test(options.targetLabel)
  ) {
    throw new Error('RESTORE_TARGET_LABEL must identify the isolated restore drill.');
  }
}

async function hasDocument(
  connection: Connection,
  collection: string,
  pipeline: readonly Record<string, unknown>[],
): Promise<boolean> {
  const rows = await connection
    .collection(collection)
    .aggregate([...pipeline, { $limit: 1 }])
    .toArray();
  return rows.length > 0;
}

async function verifyRestore(connection: Connection) {
  const database = connection.db;
  if (!database) throw new Error('Restore database handle is unavailable.');
  await database.command({ ping: 1 });
  const actualCollections = (await database.listCollections({}, { nameOnly: true }).toArray()).map(
    (item) => item.name,
  );
  const missingCollections = missingRequiredRestoreCollections(actualCollections);
  if (missingCollections.length) {
    throw new Error(`Restore is missing required collections: ${missingCollections.join(', ')}`);
  }

  const requiredTtlCollections = [
    'admin_sessions',
    'analytics_attribution_claims',
    'analytics_events',
    'anonymous_visitors',
    'assessments',
    'cache_invalidation_events',
    'leads',
    'login_attempts',
    'results',
  ];
  for (const collection of requiredTtlCollections) {
    const indexes = await database.collection(collection).indexes();
    if (!indexes.some((index) => index.expireAfterSeconds === 0)) {
      throw new Error(`Restore collection ${collection} is missing its absolute TTL index.`);
    }
  }

  if (
    await hasDocument(connection, 'calculators', [
      { $match: { status: 'published' } },
      {
        $lookup: {
          from: 'calculator_versions',
          localField: 'currentVersionId',
          foreignField: '_id',
          as: 'current',
        },
      },
      {
        $match: {
          $or: [
            { current: { $size: 0 } },
            { 'current.0.status': { $ne: 'published' } },
            { 'current.0.immutableAt': { $exists: false } },
            { 'current.0.versionHash': { $exists: false } },
          ],
        },
      },
    ])
  ) {
    throw new Error('Restore contains a broken published-calculator/version pointer.');
  }
  if (
    await hasDocument(connection, 'results', [
      {
        $lookup: {
          from: 'assessments',
          localField: 'assessmentId',
          foreignField: '_id',
          as: 'assessment',
        },
      },
      { $match: { assessment: { $size: 0 } } },
    ])
  ) {
    throw new Error('Restore contains a result without its assessment snapshot.');
  }

  const counts: Record<string, number> = {};
  for (const collection of REQUIRED_RESTORE_COLLECTIONS) {
    counts[collection] = await database.collection(collection).estimatedDocumentCount();
  }
  return { collections: REQUIRED_RESTORE_COLLECTIONS.length, counts };
}

function argument(argv: readonly string[], prefix: string): string | undefined {
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export async function runRestoreVerification(argv = process.argv.slice(2)): Promise<void> {
  loadProjectEnvironment();
  const expectedDbName = argument(argv, '--expected-db-name=');
  const allowReadOnly = argv.includes('--allow-read-only-restore-verification');
  const known = argv.every(
    (value) =>
      value === '--allow-read-only-restore-verification' || value.startsWith('--expected-db-name='),
  );
  if (!known) throw new Error('Unsupported restore-verification argument.');
  const uri = process.env.RESTORE_MONGODB_URI?.trim();
  const configuredDbName = process.env.RESTORE_MONGODB_DB_NAME?.trim();
  const targetLabel = process.env.RESTORE_TARGET_LABEL?.trim();
  assertRestoreVerificationTarget({
    allowReadOnly,
    expectedDbName,
    configuredDbName,
    targetLabel,
    uri,
  });
  const connection = mongoose.createConnection(uri!, {
    dbName: configuredDbName,
    retryWrites: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10_000,
  });
  try {
    await connection.asPromise();
    const result = await verifyRestore(connection);
    console.log(
      JSON.stringify({
        status: 'ok',
        targetLabel,
        database: configuredDbName,
        readOnly: true,
        ...result,
      }),
    );
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  void runRestoreVerification().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Restore verification failed.');
    process.exitCode = 1;
  });
}
