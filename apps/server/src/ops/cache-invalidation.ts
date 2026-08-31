import { createHmac, randomUUID } from 'node:crypto';

import { CacheInvalidationEventModel } from '../persistence/models/cache-invalidation-event';

const MAX_ATTEMPTS = 8;
const SIGNATURE_VERSION = 'v1';

export interface CacheInvalidationMessage {
  readonly schemaVersion: typeof SIGNATURE_VERSION;
  readonly eventId: string;
  readonly calculatorSlug: string;
  readonly reason: 'publish' | 'retire';
  readonly paths: readonly string[];
}

export interface ClaimedCacheInvalidation extends CacheInvalidationMessage {
  readonly owner: string;
  readonly attempt: number;
}

function safeFailureCode(error: unknown): string {
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(error.name)) {
    return error.name;
  }
  return 'CACHE_INVALIDATION_FAILED';
}

export function cacheInvalidationBody(message: CacheInvalidationMessage): string {
  return JSON.stringify({
    schemaVersion: message.schemaVersion,
    eventId: message.eventId,
    calculatorSlug: message.calculatorSlug,
    reason: message.reason,
    paths: [...message.paths],
  });
}

export function signCacheInvalidationBody(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function claimCacheInvalidation(
  options: {
    readonly now?: Date;
    readonly owner?: string;
    readonly leaseSeconds?: number;
    readonly maxAttempts?: number;
  } = {},
): Promise<ClaimedCacheInvalidation | undefined> {
  const now = options.now ?? new Date();
  const owner = options.owner ?? randomUUID();
  const leaseSeconds = options.leaseSeconds ?? 60;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const record = await CacheInvalidationEventModel.findOneAndUpdate(
    {
      expiresAt: { $gt: now },
      attempts: { $lt: maxAttempts },
      $or: [
        { status: 'pending' },
        {
          status: 'failed',
          $or: [{ nextRetryAt: { $lte: now } }, { nextRetryAt: { $exists: false } }],
        },
        { status: 'running', leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'running',
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1_000),
      },
      $unset: { nextRetryAt: 1, lastError: 1 },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { createdAt: 1 } },
  ).lean();
  if (!record) return undefined;
  return {
    schemaVersion: SIGNATURE_VERSION,
    eventId: record._id.toString(),
    calculatorSlug: record.calculatorSlug,
    reason: record.reason,
    paths: record.paths,
    owner,
    attempt: record.attempts,
  };
}

export async function completeCacheInvalidation(
  claim: ClaimedCacheInvalidation,
  now = new Date(),
): Promise<void> {
  const result = await CacheInvalidationEventModel.updateOne(
    { _id: claim.eventId, status: 'running', leaseOwner: claim.owner },
    {
      $set: { status: 'completed', completedAt: now },
      $unset: { leaseOwner: 1, leaseExpiresAt: 1, nextRetryAt: 1, lastError: 1 },
    },
  );
  if (result.modifiedCount !== 1) throw new Error('CACHE_INVALIDATION_LEASE_LOST');
}

export async function failCacheInvalidation(
  claim: ClaimedCacheInvalidation,
  error: unknown,
  now = new Date(),
): Promise<void> {
  const retryDelayMs = Math.min(3_600_000, 30_000 * 2 ** Math.max(0, claim.attempt - 1));
  const result = await CacheInvalidationEventModel.updateOne(
    { _id: claim.eventId, status: 'running', leaseOwner: claim.owner },
    {
      $set: {
        status: 'failed',
        lastError: safeFailureCode(error),
        nextRetryAt: new Date(now.getTime() + retryDelayMs),
      },
      $unset: { leaseOwner: 1, leaseExpiresAt: 1 },
    },
  );
  if (result.modifiedCount !== 1) throw new Error('CACHE_INVALIDATION_LEASE_LOST');
}

export async function dispatchCacheInvalidation(options: {
  readonly claim: ClaimedCacheInvalidation;
  readonly endpoint: string;
  readonly signingSecret: string;
  readonly now?: Date;
  readonly fetchImplementation?: typeof fetch;
  readonly complete?: typeof completeCacheInvalidation;
  readonly fail?: typeof failCacheInvalidation;
}): Promise<'completed' | 'failed'> {
  const body = cacheInvalidationBody(options.claim);
  const timestamp = String(Math.floor((options.now ?? new Date()).getTime() / 1_000));
  const fetchImplementation = options.fetchImplementation ?? fetch;
  try {
    const response = await fetchImplementation(options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-niro-timestamp': timestamp,
        'x-niro-signature': `sha256=${signCacheInvalidationBody(
          body,
          timestamp,
          options.signingSecret,
        )}`,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const error = new Error('Cache invalidation endpoint returned a non-success status');
      error.name = `CACHE_INVALIDATION_HTTP_${response.status}`;
      throw error;
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > 8_192) {
      throw new Error('CACHE_INVALIDATION_RESPONSE_INVALID');
    }
    const responseBody = await response.text();
    if (responseBody.length > 8_192) throw new Error('CACHE_INVALIDATION_RESPONSE_INVALID');
    let acknowledgement: unknown;
    try {
      acknowledgement = JSON.parse(responseBody);
    } catch {
      throw new Error('CACHE_INVALIDATION_RESPONSE_INVALID');
    }
    if (
      !acknowledgement ||
      typeof acknowledgement !== 'object' ||
      Array.isArray(acknowledgement) ||
      (acknowledgement as Record<string, unknown>).status !== 'revalidated' ||
      (acknowledgement as Record<string, unknown>).eventId !== options.claim.eventId
    ) {
      throw new Error('CACHE_INVALIDATION_RESPONSE_INVALID');
    }
    await (options.complete ?? completeCacheInvalidation)(options.claim);
    return 'completed';
  } catch (error) {
    await (options.fail ?? failCacheInvalidation)(options.claim, error);
    return 'failed';
  }
}

export async function dispatchCacheInvalidationBatch(options: {
  readonly endpoint: string;
  readonly signingSecret: string;
  readonly batchSize?: number;
  readonly leaseSeconds?: number;
  readonly owner?: string;
}): Promise<{ readonly completed: number; readonly failed: number }> {
  const batchSize = options.batchSize ?? 25;
  const owner = options.owner ?? `cache-dispatcher:${randomUUID()}`;
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const claim = await claimCacheInvalidation({ owner, leaseSeconds: options.leaseSeconds });
    if (!claim) break;
    const outcome = await dispatchCacheInvalidation({ ...options, claim });
    if (outcome === 'completed') completed += 1;
    else failed += 1;
  }
  return { completed, failed };
}
