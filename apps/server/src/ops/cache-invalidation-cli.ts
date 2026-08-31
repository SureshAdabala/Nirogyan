import { loadEnvironment, loadProjectEnvironment } from '../config/env';
import { assertProductionJobEnvironment } from '../config/production';
import { connectDatabase, disconnectDatabase } from '../db/connection';
import { dispatchCacheInvalidationBatch } from './cache-invalidation';

export async function runCacheInvalidationCli(): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (environment.nodeEnv === 'production') {
    assertProductionJobEnvironment(process.env, environment, 'cache');
  }
  if (!environment.mongoUri) throw new Error('MONGODB_URI is required for cache invalidation.');
  if (!environment.cacheInvalidationEndpoint || !environment.cacheInvalidationSigningSecret) {
    throw new Error(
      'CACHE_INVALIDATION_ENDPOINT and CACHE_INVALIDATION_SIGNING_SECRET are required.',
    );
  }
  await connectDatabase({ environment });
  try {
    const result = await dispatchCacheInvalidationBatch({
      endpoint: environment.cacheInvalidationEndpoint,
      signingSecret: environment.cacheInvalidationSigningSecret,
      batchSize: environment.cacheInvalidationBatchSize,
      leaseSeconds: environment.cacheInvalidationLeaseSeconds,
    });
    console.log(JSON.stringify({ status: 'ok', database: environment.mongoDbName, ...result }));
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  void runCacheInvalidationCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Cache invalidation failed.');
    process.exitCode = 1;
  });
}
