import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import {
  revalidationTargets,
  verifyRevalidationRequest,
} from '../../../../../src/ops/revalidation';

export const dynamic = 'force-dynamic';

function response(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

async function boundedBody(request: Request, maximumBytes = 8_192): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('REVALIDATION_BODY_TOO_LARGE');
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) throw new Error('REVALIDATION_BODY_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CACHE_INVALIDATION_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return response({ error: { code: 'REVALIDATION_NOT_CONFIGURED' } }, 503);
  }
  let body: string;
  try {
    body = await boundedBody(request);
  } catch {
    return response({ error: { code: 'REVALIDATION_BODY_TOO_LARGE' } }, 413);
  }
  let message;
  try {
    message = verifyRevalidationRequest({
      body,
      timestamp: request.headers.get('x-niro-timestamp'),
      signature: request.headers.get('x-niro-signature'),
      secret,
    });
  } catch {
    return response({ error: { code: 'INVALID_REVALIDATION_REQUEST' } }, 401);
  }
  const targets = revalidationTargets(message);
  for (const tag of targets.tags) revalidateTag(tag, 'max');
  for (const path of targets.paths) revalidatePath(path);
  return response({ status: 'revalidated', eventId: message.eventId }, 200);
}
