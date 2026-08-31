import { connectDatabase, disconnectDatabase, isDatabaseReady } from './connection';
import { loadProjectEnvironment } from '../config/env';

async function main(): Promise<void> {
  loadProjectEnvironment();
  const mongoose = await connectDatabase();
  try {
    console.log(
      JSON.stringify(
        {
          status: isDatabaseReady() ? 'ok' : 'not_ready',
          database: mongoose.connection.name,
          host: mongoose.connection.host,
          readyState: mongoose.connection.readyState,
        },
        null,
        2,
      ),
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
