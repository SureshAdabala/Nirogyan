import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedRevalidationMessage {
  readonly schemaVersion: 'v1';
  readonly eventId: string;
  readonly calculatorSlug: string;
  readonly reason: 'publish' | 'retire';
  readonly paths: readonly string[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const OBJECT_ID = /^[a-f0-9]{24}$/u;

function signatureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyRevalidationRequest(options: {
  readonly body: string;
  readonly timestamp: string | null;
  readonly signature: string | null;
  readonly secret: string;
  readonly now?: Date;
  readonly toleranceSeconds?: number;
}): VerifiedRevalidationMessage {
  if (options.body.length > 8_192) throw new Error('REVALIDATION_BODY_TOO_LARGE');
  if (!options.timestamp || !/^\d{10}$/u.test(options.timestamp)) {
    throw new Error('REVALIDATION_TIMESTAMP_INVALID');
  }
  const timestamp = Number(options.timestamp);
  const now = Math.floor((options.now ?? new Date()).getTime() / 1_000);
  if (Math.abs(now - timestamp) > (options.toleranceSeconds ?? 300)) {
    throw new Error('REVALIDATION_TIMESTAMP_EXPIRED');
  }
  const expected = `sha256=${createHmac('sha256', options.secret)
    .update(`${options.timestamp}.${options.body}`)
    .digest('hex')}`;
  if (!options.signature || !signatureEqual(options.signature, expected)) {
    throw new Error('REVALIDATION_SIGNATURE_INVALID');
  }
  let value: unknown;
  try {
    value = JSON.parse(options.body);
  } catch {
    throw new Error('REVALIDATION_BODY_INVALID');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('REVALIDATION_BODY_INVALID');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'calculatorSlug,eventId,paths,reason,schemaVersion' ||
    record.schemaVersion !== 'v1' ||
    typeof record.eventId !== 'string' ||
    !OBJECT_ID.test(record.eventId) ||
    typeof record.calculatorSlug !== 'string' ||
    !SLUG.test(record.calculatorSlug) ||
    (record.reason !== 'publish' && record.reason !== 'retire') ||
    !Array.isArray(record.paths) ||
    record.paths.length < 1 ||
    record.paths.length > 8 ||
    record.paths.some((path) => typeof path !== 'string')
  ) {
    throw new Error('REVALIDATION_BODY_INVALID');
  }
  const paths = record.paths as string[];
  const allowed = new Set([
    '/calculators',
    `/calculators/${record.calculatorSlug}`,
    '/biomarkers',
    '/sitemap.xml',
  ]);
  if (new Set(paths).size !== paths.length || paths.some((path) => !allowed.has(path))) {
    throw new Error('REVALIDATION_PATH_INVALID');
  }
  return {
    schemaVersion: 'v1',
    eventId: record.eventId,
    calculatorSlug: record.calculatorSlug,
    reason: record.reason,
    paths,
  };
}

export function revalidationTargets(message: VerifiedRevalidationMessage): {
  readonly paths: readonly string[];
  readonly tags: readonly string[];
} {
  const paths = new Set<string>();
  const tags = new Set<string>();
  for (const path of message.paths) {
    if (path === '/calculators') {
      paths.add('/');
      tags.add('calculators');
    } else if (path === `/calculators/${message.calculatorSlug}`) {
      paths.add(`/c/${message.calculatorSlug}`);
      tags.add(`calculator:${message.calculatorSlug}`);
    } else if (path === '/biomarkers') {
      paths.add('/biomarkers');
      tags.add('biomarkers');
    } else if (path === '/sitemap.xml') {
      paths.add('/sitemap.xml');
    }
  }
  return { paths: [...paths], tags: [...tags] };
}
