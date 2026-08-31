import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApiError, sharedResult } from '../../../src/api';
import { SharedResultExperience } from '../../../src/public-ui';
import { SiteShell } from '../../../src/site-shell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Private assessment result',
  description: 'A temporary, share-safe health assessment result.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function ResultPage({
  params,
}: {
  readonly params: Promise<{ readonly shareToken: string }>;
}) {
  const { shareToken } = await params;
  let result;
  try {
    result = await sharedResult(shareToken, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <SiteShell>
      <div id="main-content" tabIndex={-1}>
        <p className="eyebrow">Temporary share-safe result</p>
        <h1>Assessment result</h1>
        <p className="lead">
          Anyone with this capability link can view the result until the link expires or is revoked.
        </p>
        <SharedResultExperience token={shareToken} initialResult={result} />
      </div>
    </SiteShell>
  );
}
