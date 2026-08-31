import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ApiError, publicBiomarker } from '../../../src/api';
import { BiomarkerDetail } from '../../../src/biomarkers/biomarker-detail';
import { JsonLdScript, breadcrumbJsonLd } from '../../../src/content';
import { siteOrigin } from '../../../src/seo';
import { SiteShell } from '../../../src/site-shell';

export const revalidate = 30;

async function loadBiomarker(key: string) {
  try {
    return await publicBiomarker(key, {
      next: { revalidate: 30, tags: [`biomarker:${key}`, 'biomarkers'] },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ readonly key: string }>;
}>): Promise<Metadata> {
  const { key } = await params;
  const biomarker = await loadBiomarker(key);
  const description =
    biomarker.definition.description?.whatItMeasures ??
    biomarker.definition.description?.whyItMatters ??
    (biomarker.releaseState === 'testing-unapproved'
      ? `Unapproved functional-testing information about ${biomarker.displayName}.`
      : `Reviewed educational information about ${biomarker.displayName}.`);
  const isTestingRecord = biomarker.releaseState === 'testing-unapproved';
  return {
    title: biomarker.displayName,
    description,
    alternates: { canonical: `/biomarkers/${encodeURIComponent(biomarker.key)}` },
    robots: isTestingRecord ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'website',
      title: biomarker.displayName,
      description,
      url: `/biomarkers/${encodeURIComponent(biomarker.key)}`,
    },
  };
}

export default async function BiomarkerPage({
  params,
}: Readonly<{
  params: Promise<{ readonly key: string }>;
}>) {
  const { key } = await params;
  const biomarker = await loadBiomarker(key);
  const isTestingRecord = biomarker.releaseState === 'testing-unapproved';
  const breadcrumb = breadcrumbJsonLd(
    [
      { name: 'Biomarkers', path: '/biomarkers' },
      { name: biomarker.displayName, path: `/biomarkers/${biomarker.key}` },
    ],
    siteOrigin().origin,
  );
  return (
    <SiteShell>
      <article id="main-content" tabIndex={-1}>
        <header className="biomarker-detail-header">
          <p className="eyebrow">
            {isTestingRecord ? 'Testing · Unapproved measurement' : 'Reviewed measurement'} ·
            Revision {biomarker.revision}
          </p>
          <h1>{biomarker.displayName}</h1>
          <p className="lead">
            {biomarker.definition.description?.whatItMeasures ??
              'Reviewed educational information about this measurement.'}
          </p>
        </header>
        {isTestingRecord ? (
          <div className="testing-warning" role="note">
            <strong>Functional testing only</strong>
            <span>
              This live database draft is unapproved and must not guide clinical decisions.
            </span>
          </div>
        ) : null}
        <BiomarkerDetail biomarker={biomarker} />
      </article>
      <JsonLdScript id="biomarker-breadcrumb-jsonld" value={breadcrumb} />
    </SiteShell>
  );
}
