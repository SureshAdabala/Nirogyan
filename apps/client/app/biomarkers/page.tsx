import type { Metadata } from 'next';

import { publicBiomarkers } from '../../src/api';
import { BiomarkerDirectory } from '../../src/biomarker-directory';
import { SiteShell } from '../../src/site-shell';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Biomarkers',
  description:
    'Browse reviewed biomarker and measurement definitions, units, and source provenance.',
  alternates: { canonical: '/biomarkers' },
};

function queryValue(value: string | string[] | undefined, maxLength: number): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate.trim().slice(0, maxLength) : '';
}

export default async function BiomarkersPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    readonly search?: string | string[];
    readonly domain?: string | string[];
    readonly letter?: string | string[];
  }>;
}>) {
  const initialLoad = await publicBiomarkers(
    {},
    { next: { revalidate: 30, tags: ['biomarkers'] } },
  ).then(
    (items) => ({ items, failed: false as const }),
    () => ({ items: [], failed: true as const }),
  );
  const hasTestingRecords = initialLoad.items.some(
    (item) => item.releaseState === 'testing-unapproved',
  );
  const requested = await searchParams;
  return (
    <SiteShell>
      <div id="main-content" tabIndex={-1}>
        <p className="eyebrow">
          {hasTestingRecords ? 'Testing measurement library' : 'Reviewed measurement library'}
        </p>
        <h1>Biomarkers</h1>
        <p className="lead">
          {hasTestingRecords
            ? 'Browse live database drafts for functional testing. Testing records are unapproved and not for clinical use.'
            : 'Browse definitions, units, and provenance. Reference ranges vary by laboratory and individual context.'}
        </p>
        <BiomarkerDirectory
          initialItems={initialLoad.items}
          initialLoadFailed={initialLoad.failed}
          initialFilters={{
            search: queryValue(requested.search, 100),
            domain: queryValue(requested.domain, 100),
            letter: queryValue(requested.letter, 1),
          }}
        />
      </div>
    </SiteShell>
  );
}
