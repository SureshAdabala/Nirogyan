import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acquireJobLease,
  failJobLease,
  withAnalyticsMaterializationLease,
  type AnalyticsMaterializationLease,
} from './jobs';
import { JobRunModel } from '../persistence/models/job-run';

afterEach(() => vi.restoreAllMocks());

describe('distributed analytics job leases', () => {
  it('allows one owner and rejects an unexpired competing lease', async () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    const queued = { _id: 'run-1', status: 'queued', attempt: 0 };
    const running = {
      _id: 'run-1',
      status: 'running',
      attempt: 1,
      leaseExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
    };
    vi.spyOn(JobRunModel, 'findOne')
      .mockResolvedValueOnce(queued as never)
      .mockResolvedValueOnce(running as never);
    vi.spyOn(JobRunModel, 'findOneAndUpdate').mockResolvedValue({
      ...running,
      attempt: 1,
    } as never);
    const first = await acquireJobLease({
      job: 'analytics.daily.rollup',
      scheduledFor: now,
      now,
      owner: 'worker-a',
    });
    const second = await acquireJobLease({
      job: 'analytics.daily.rollup',
      scheduledFor: now,
      now,
      owner: 'worker-b',
    });
    expect(first).toMatchObject({ owner: 'worker-a', attempt: 1 });
    expect(second).toBeUndefined();
    expect(JobRunModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('fails a lost heartbeat and records bounded retry metadata without secret error text', async () => {
    vi.spyOn(JobRunModel, 'findOne').mockResolvedValue({
      _id: 'run-2',
      status: 'queued',
      attempt: 0,
    } as never);
    vi.spyOn(JobRunModel, 'findOneAndUpdate').mockResolvedValue({
      _id: 'run-2',
      status: 'running',
      attempt: 1,
    } as never);
    const update = vi
      .spyOn(JobRunModel, 'updateOne')
      .mockResolvedValue({ modifiedCount: 0 } as never);
    const lease = await acquireJobLease({
      job: 'analytics.daily.rollup',
      scheduledFor: new Date('2026-08-29T00:00:00.000Z'),
      owner: 'worker-a',
    });
    await expect(lease?.heartbeat()).rejects.toThrow('JOB_LEASE_LOST');
    update.mockResolvedValueOnce({ modifiedCount: 1 } as never);
    await failJobLease(lease!, new Error('mongodb://secret-user:secret-password@example'));
    const failureUpdate = (
      update.mock.calls.at(-1) as unknown as [unknown, unknown] | undefined
    )?.[1];
    expect(JSON.stringify(failureUpdate)).not.toContain('secret-password');
    expect(failureUpdate).toEqual(
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Job execution failed; inspect restricted server logs for details.',
        }),
      }),
    );
  });

  it('honors retry delay and maximum-attempt boundaries', async () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    vi.spyOn(JobRunModel, 'findOne').mockResolvedValue({
      _id: 'run-3',
      status: 'failed',
      attempt: 1,
      nextRetryAt: new Date('2026-08-29T00:01:00.000Z'),
    } as never);
    expect(
      await acquireJobLease({ job: 'analytics.daily.rollup', scheduledFor: now, now }),
    ).toBeUndefined();
    vi.mocked(JobRunModel.findOne).mockResolvedValueOnce({
      _id: 'run-4',
      status: 'failed',
      attempt: 3,
    } as never);
    expect(
      await acquireJobLease({
        job: 'analytics.daily.rollup',
        scheduledFor: now,
        now,
        maxAttempts: 3,
      }),
    ).toBeUndefined();
    vi.mocked(JobRunModel.findOne).mockResolvedValueOnce({
      _id: 'run-5',
      status: 'running',
      attempt: 3,
      leaseExpiresAt: new Date('2026-08-28T00:00:00.000Z'),
    } as never);
    expect(
      await acquireJobLease({
        job: 'analytics.daily.rollup',
        scheduledFor: now,
        now,
        maxAttempts: 3,
      }),
    ).toBeUndefined();
  });

  it('serializes overlapping partial buckets so the later snapshot runs last', async () => {
    let held = false;
    let unblockOlder: (() => void) | undefined;
    const olderCanFinish = new Promise<void>((resolve) => {
      unblockOlder = resolve;
    });
    const writes: string[] = [];
    const acquire = async (): Promise<AnalyticsMaterializationLease | undefined> => {
      if (held) return undefined;
      held = true;
      return { key: 'analytics-day:UTC:2026-08-28', owner: 'test', heartbeat: async () => {} };
    };
    const release = async () => {
      held = false;
    };
    const older = withAnalyticsMaterializationLease({
      key: 'analytics-day:UTC:2026-08-28',
      acquire,
      release,
      work: async () => {
        await olderCanFinish;
        writes.push('bucket-n');
      },
    });
    await vi.waitFor(() => expect(held).toBe(true));
    await expect(
      withAnalyticsMaterializationLease({
        key: 'analytics-day:UTC:2026-08-28',
        acquire,
        release,
        work: async () => writes.push('bucket-n-plus-1'),
      }),
    ).rejects.toThrow(/Another worker/);
    expect(writes).toEqual([]);
    unblockOlder?.();
    await older;
    await withAnalyticsMaterializationLease({
      key: 'analytics-day:UTC:2026-08-28',
      acquire,
      release,
      work: async () => writes.push('bucket-n-plus-1'),
    });
    expect(writes).toEqual(['bucket-n', 'bucket-n-plus-1']);
  });
});
