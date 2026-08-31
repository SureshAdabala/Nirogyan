import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, publicCalculator } from '../../../src/api';
import { ContentRenderer, JsonLdScript, breadcrumbJsonLd, faqJsonLd } from '../../../src/content';
import { contentPresentation } from '../../../src/content-adapter';
import { CalculatorExperience } from '../../../src/public-ui';
import { calculatorMetadata, siteOrigin } from '../../../src/seo';
import { SiteShell } from '../../../src/site-shell';

export const revalidate = 30;

async function loadCalculator(slug: string) {
  try {
    return await publicCalculator(slug, {
      next: { revalidate: 30, tags: [`calculator:${slug}`] },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    return calculatorMetadata(await loadCalculator(slug));
  } catch {
    return {
      title: 'Calculator unavailable',
      description: 'This health calculator is not currently available.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function CalculatorPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  let config;
  try {
    config = await loadCalculator(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) {
      return (
        <SiteShell>
          <section className="empty-state" id="main-content" tabIndex={-1}>
            <p className="eyebrow">Calculator retired</p>
            <h1>This calculator is no longer available.</h1>
            <p>
              It has been retired and cannot accept new assessments. Existing temporary result links
              remain governed by their own expiry and revocation rules.
            </p>
            <Link className="button" href="/">
              Browse current calculators
            </Link>
          </section>
        </SiteShell>
      );
    }
    throw error;
  }
  const content = contentPresentation(config.content);
  const hasEmbeddedCalculator =
    content?.blocks.some(
      (block) =>
        block.type === 'calculator-embed' && block.calculatorSlug === config.calculatorSlug,
    ) ?? false;
  const breadcrumb = breadcrumbJsonLd(
    [
      { name: 'Calculators', path: '/' },
      { name: config.name ?? config.calculatorSlug, path: `/c/${config.calculatorSlug}` },
    ],
    siteOrigin().origin,
  );
  const faq = content ? faqJsonLd(content) : undefined;
  const isTestingRecord = config.releaseState === 'testing-unapproved';

  return (
    <SiteShell>
      <article id="main-content" tabIndex={-1}>
        <header className="calculator-intro">
          <p className="eyebrow">
            {isTestingRecord ? 'Testing · Unapproved · ' : ''}Calculator version {config.version}
          </p>
          <h1>{content?.title ?? config.name ?? config.calculatorSlug}</h1>
          <p className="lead">{content?.summary ?? config.shortDescription}</p>
        </header>
        {isTestingRecord ? (
          <div className="testing-warning" role="note">
            <strong>Functional testing only</strong>
            <span>
              This live database draft is unapproved and must not be used for clinical decisions.
            </span>
          </div>
        ) : null}
        {!hasEmbeddedCalculator ? <CalculatorExperience config={config} /> : null}
        {content ? (
          <ContentRenderer
            content={content}
            renderTitle={false}
            renderSummary={false}
            renderCalculatorEmbed={(embeddedSlug) =>
              embeddedSlug === config.calculatorSlug ? (
                <CalculatorExperience config={config} />
              ) : (
                <Link href={`/c/${encodeURIComponent(embeddedSlug)}`}>
                  Open the related calculator
                </Link>
              )
            }
            relatedHref={(kind, key) =>
              kind === 'calculator'
                ? `/c/${encodeURIComponent(key)}`
                : kind === 'measurement'
                  ? `/biomarkers/${encodeURIComponent(key)}`
                  : undefined
            }
          />
        ) : null}
        <aside className="disclaimer-list" aria-label="Calculator disclaimers">
          <h2>Important information</h2>
          {config.disclaimers?.map((disclaimer) => (
            <p key={disclaimer}>{disclaimer}</p>
          ))}
        </aside>
      </article>
      <JsonLdScript id="calculator-breadcrumb-jsonld" value={breadcrumb} />
      <JsonLdScript id="calculator-faq-jsonld" value={faq} />
    </SiteShell>
  );
}
