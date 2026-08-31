import { randomUUID } from 'node:crypto';

import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { withTransaction } from '../apps/server/src/persistence/transactions';
import { JobRunModel } from '../apps/server/src/persistence/models/job-run';
import { authorizeTemporaryDatabaseWrite } from './integration-write-authorization';

async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  if (!environment.mongoUri) throw new Error('MONGODB_URI is not configured.');
  authorizeTemporaryDatabaseWrite(environment, args, 'Transaction integration');
  await connectDatabase({ environment });
  const job = `integration-check-${randomUUID()}`;
  const scheduledFor = new Date();
  try {
    const createdId = await withTransaction(async (session) => {
      const [created] = await JobRunModel.create(
        [
          {
            job,
            scheduledFor,
            status: 'queued',
            attempt: 0,
            metadata: { purpose: 'transaction-check' },
          },
        ],
        { session },
      );
      if (!created) throw new Error('Transaction insert did not return a document.');
      return created._id;
    });
    const committed = await JobRunModel.findById(createdId).lean();
    if (!committed) throw new Error('Transaction commit could not be observed.');
    await JobRunModel.deleteOne({ _id: createdId });
    console.log(
      JSON.stringify({
        status: 'ok',
        database: environment.mongoDbName,
        transaction: 'committed-and-cleaned',
      }),
    );
  } finally {
    await disconnectDatabase();
  }
}

void main().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
