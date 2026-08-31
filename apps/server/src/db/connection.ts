import mongoose from 'mongoose';

import { loadEnvironment, type AppEnvironment } from '../config/env';

export interface ConnectDatabaseOptions {
  readonly environment?: AppEnvironment;
  readonly uri?: string;
  readonly dbName?: string;
  readonly serverSelectionTimeoutMs?: number;
  readonly maxPoolSize?: number;
}

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

function containsPlaceholder(uri: string): boolean {
  return /<[^>]+>/.test(uri);
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(
  options: ConnectDatabaseOptions = {},
): Promise<typeof mongoose> {
  const environment = options.environment ?? loadEnvironment();
  const uri = options.uri ?? environment.mongoUri;

  if (!uri) {
    throw new DatabaseConfigurationError(
      'MONGODB_URI is not configured. Copy .env.example to .env and set the MongoDB Atlas SRV URI.',
    );
  }
  if (containsPlaceholder(uri)) {
    throw new DatabaseConfigurationError('MONGODB_URI still contains an unresolved <placeholder>.');
  }

  if (isDatabaseReady()) {
    return mongoose;
  }

  await mongoose.connect(uri, {
    dbName: options.dbName ?? environment.mongoDbName,
    serverSelectionTimeoutMS:
      options.serverSelectionTimeoutMs ?? environment.mongoServerSelectionTimeoutMs,
    maxPoolSize: options.maxPoolSize ?? environment.mongoMaxPoolSize,
    retryWrites: true,
    w: 'majority',
  });

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
