import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsDailyModel, ensureAnalyticsDailyIndexes } from './analytics-daily';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analytics daily startup indexes', () => {
  it('creates the partition index when a fresh database has no collection yet', async () => {
    vi.spyOn(AnalyticsDailyModel, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as never);
    const indexes = vi
      .spyOn(AnalyticsDailyModel.collection, 'indexes')
      .mockRejectedValueOnce(Object.assign(new Error('ns does not exist'), { code: 26 }))
      .mockResolvedValueOnce([
        {
          name: 'analytics_daily_partition_unique_v3',
          key: {
            day: 1,
            timezone: 1,
            scope: 1,
            scopeKey: 1,
            identityBasis: 1,
            identityKeyVersion: 1,
          },
          unique: true,
          v: 2,
        },
      ]);
    const createIndex = vi
      .spyOn(AnalyticsDailyModel.collection, 'createIndex')
      .mockResolvedValue('analytics_daily_partition_unique_v3');

    await expect(ensureAnalyticsDailyIndexes()).resolves.toEqual({
      migratedDocuments: 0,
      droppedLegacyIndexes: [],
    });
    expect(createIndex).toHaveBeenCalledWith(
      {
        day: 1,
        timezone: 1,
        scope: 1,
        scopeKey: 1,
        identityBasis: 1,
        identityKeyVersion: 1,
      },
      { unique: true, name: 'analytics_daily_partition_unique_v3' },
    );
    expect(indexes).toHaveBeenCalledTimes(2);
  });
});
