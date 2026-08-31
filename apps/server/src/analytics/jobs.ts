import { randomUUID } from 'node:crypto';

import { AnalyticsMaterializationLockModel } from '../persistence/models/analytics-materialization-lock';
import { JobRunModel, type JobRunModelDocument } from '../persistence/models/job-run';

const DUPLICATE_KEY = 11_000;

function isDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

export interface JobLease {
  readonly runId: string;
  readonly owner: string;
  readonly attempt: number;
  readonly heartbeat: () => Promise<void>;
}

export interface AnalyticsMaterializationLease {
  readonly key: string;
  readonly owner: string;
  readonly heartbeat: () => Promise<void>;
}

export class AnalyticsDayLeaseBusyError extends Error {
  constructor() {
    super('Another worker is materializing this analytics reporting day.');
    this.name = 'ANALYTICS_DAY_LEASE_BUSY';
  }
}

export async function acquireAnalyticsMaterializationLease(options: {
  readonly key: string;
  readonly owner?: string;
  readonly now?: Date;
  readonly leaseSeconds?: number;
}): Promise<AnalyticsMaterializationLease | undefined> {
  const now = options.now ?? new Date();
  const owner = options.owner ?? randomUUID();
  const leaseSeconds = options.leaseSeconds ?? 900;
  try {
    const locked = await AnalyticsMaterializationLockModel.findOneAndUpdate(
      {
        _id: options.key,
        $or: [{ leaseExpiresAt: { $lte: now } }, { leaseExpiresAt: { $exists: false } }],
      },
      {
        $set: {
          leaseOwner: owner,
          heartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1_000),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (!locked) return undefined;
  } catch (error) {
    if (isDuplicate(error)) return undefined;
    throw error;
  }
  return {
    key: options.key,
    owner,
    heartbeat: async () => {
      const heartbeatAt = new Date();
      const result = await AnalyticsMaterializationLockModel.updateOne(
        { _id: options.key, leaseOwner: owner },
        {
          $set: {
            heartbeatAt,
            leaseExpiresAt: new Date(heartbeatAt.getTime() + leaseSeconds * 1_000),
          },
        },
      );
      if (result.modifiedCount !== 1) throw new Error('ANALYTICS_DAY_LEASE_LOST');
    },
  };
}

export async function releaseAnalyticsMaterializationLease(
  lease: AnalyticsMaterializationLease,
): Promise<void> {
  const result = await AnalyticsMaterializationLockModel.deleteOne({
    _id: lease.key,
    leaseOwner: lease.owner,
  });
  if (result.deletedCount !== 1) throw new Error('ANALYTICS_DAY_LEASE_LOST');
}

export async function withAnalyticsMaterializationLease<T>(options: {
  readonly key: string;
  readonly owner?: string;
  readonly leaseSeconds?: number;
  readonly work: (lease: AnalyticsMaterializationLease) => Promise<T>;
  readonly acquire?: typeof acquireAnalyticsMaterializationLease;
  readonly release?: typeof releaseAnalyticsMaterializationLease;
}): Promise<T> {
  const acquire = options.acquire ?? acquireAnalyticsMaterializationLease;
  const release = options.release ?? releaseAnalyticsMaterializationLease;
  const lease = await acquire({
    key: options.key,
    owner: options.owner,
    leaseSeconds: options.leaseSeconds,
  });
  if (!lease) throw new AnalyticsDayLeaseBusyError();
  try {
    return await options.work(lease);
  } finally {
    await release(lease);
  }
}

export async function acquireJobLease(options: {
  readonly job: string;
  readonly scheduledFor: Date;
  readonly now?: Date;
  readonly leaseSeconds?: number;
  readonly maxAttempts?: number;
  readonly owner?: string;
}): Promise<JobLease | undefined> {
  const now = options.now ?? new Date();
  const owner = options.owner ?? randomUUID();
  let run: JobRunModelDocument | null = await JobRunModel.findOne({
    job: options.job,
    scheduledFor: options.scheduledFor,
  });
  if (!run) {
    try {
      run = await JobRunModel.create({
        job: options.job,
        scheduledFor: options.scheduledFor,
        status: 'queued',
        attempt: 0,
      });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      run = await JobRunModel.findOne({
        job: options.job,
        scheduledFor: options.scheduledFor,
      });
    }
  }
  if (!run || run.status === 'succeeded' || run.status === 'cancelled') return undefined;
  const maxAttempts = options.maxAttempts ?? 3;
  if (run.attempt >= maxAttempts) return undefined;
  if (run.status === 'running' && (!run.leaseExpiresAt || run.leaseExpiresAt > now))
    return undefined;
  if (run.status === 'failed' && run.nextRetryAt && run.nextRetryAt > now) return undefined;
  const leaseSeconds = options.leaseSeconds ?? 900;
  const leased = await JobRunModel.findOneAndUpdate(
    {
      _id: run._id,
      status: run.status,
      attempt: run.attempt,
      ...(run.status === 'running' ? { leaseExpiresAt: { $lte: now } } : {}),
    },
    {
      $set: {
        status: 'running',
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1_000),
        heartbeatAt: now,
        startedAt: now,
      },
      $unset: { finishedAt: 1, errorCode: 1, errorMessage: 1, nextRetryAt: 1 },
      $inc: { attempt: 1 },
    },
    { new: true },
  );
  if (!leased) return undefined;
  return {
    runId: leased._id.toString(),
    owner,
    attempt: leased.attempt,
    heartbeat: async () => {
      const heartbeatAt = new Date();
      const result = await JobRunModel.updateOne(
        { _id: leased._id, status: 'running', leaseOwner: owner },
        {
          $set: {
            heartbeatAt,
            leaseExpiresAt: new Date(heartbeatAt.getTime() + leaseSeconds * 1_000),
          },
        },
      );
      if (result.modifiedCount !== 1) throw new Error('JOB_LEASE_LOST');
    },
  };
}

export async function completeJobLease(
  lease: JobLease,
  metadata: Record<string, unknown>,
  now = new Date(),
): Promise<void> {
  const result = await JobRunModel.updateOne(
    { _id: lease.runId, status: 'running', leaseOwner: lease.owner },
    {
      $set: { status: 'succeeded', finishedAt: now, metadata },
      $unset: { leaseExpiresAt: 1, leaseOwner: 1, heartbeatAt: 1, nextRetryAt: 1 },
    },
  );
  if (result.modifiedCount !== 1) throw new Error('JOB_LEASE_LOST');
}

export async function failJobLease(
  lease: JobLease,
  error: unknown,
  now = new Date(),
): Promise<void> {
  const retryDelayMs = Math.min(3_600_000, 60_000 * 2 ** Math.max(0, lease.attempt - 1));
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const safeCode = /^[A-Z0-9_]{1,80}$/.test(errorName) ? errorName : 'JOB_FAILED';
  const result = await JobRunModel.updateOne(
    { _id: lease.runId, status: 'running', leaseOwner: lease.owner },
    {
      $set: {
        status: 'failed',
        finishedAt: now,
        nextRetryAt: new Date(now.getTime() + retryDelayMs),
        errorCode: safeCode,
        errorMessage: 'Job execution failed; inspect restricted server logs for details.',
      },
      $unset: { leaseExpiresAt: 1, leaseOwner: 1, heartbeatAt: 1 },
    },
  );
  if (result.modifiedCount !== 1) throw new Error('JOB_LEASE_LOST');
}

export async function runLeasedJob<T extends Record<string, unknown>>(options: {
  readonly job: string;
  readonly scheduledFor: Date;
  readonly leaseSeconds?: number;
  readonly maxAttempts?: number;
  readonly owner?: string;
  readonly work: (lease: JobLease) => Promise<T>;
}): Promise<
  { readonly status: 'succeeded'; readonly metadata: T } | { readonly status: 'skipped' }
> {
  const lease = await acquireJobLease(options);
  if (!lease) return { status: 'skipped' };
  try {
    const metadata = await options.work(lease);
    await completeJobLease(lease, metadata);
    return { status: 'succeeded', metadata };
  } catch (error) {
    await failJobLease(lease, error);
    throw error;
  }
}
