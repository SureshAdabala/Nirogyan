import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'niro-client',
      releaseId: process.env.NIRO_CLIENT_BUILD_RELEASE_ID?.trim() || 'local-unversioned',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
