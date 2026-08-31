import { describe, expect, it } from 'vitest';

import { loadEnvironment } from '../config/env';
import { connectDatabase, DatabaseConfigurationError } from './connection';

describe('MongoDB connection configuration', () => {
  it('fails safely when an Atlas URI has not been configured', async () => {
    await expect(
      connectDatabase({
        environment: loadEnvironment({
          NODE_ENV: 'test',
          MONGODB_SERVER_SELECTION_TIMEOUT_MS: '100',
          MONGODB_MAX_POOL_SIZE: '1',
        }),
      }),
    ).rejects.toBeInstanceOf(DatabaseConfigurationError);
  });
});
