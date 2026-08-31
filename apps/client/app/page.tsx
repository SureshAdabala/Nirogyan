import { CalculatorDirectory } from '../src/directory';
import { publicCalculators } from '../src/api';
import { SiteShell } from '../src/site-shell';

export const revalidate = 30;

export default async function HomePage() {
  const initialLoad = await publicCalculators({
    next: { revalidate: 30, tags: ['calculators'] },
  }).then(
    (items) => ({ items: Array.isArray(items) ? items : [], failed: false as const }),
    () => ({ items: [], failed: true as const }),
  );
  const hasTestingRecords = initialLoad.items.some(
    (item) => item.releaseState === 'testing-unapproved',
  );

  return (
    <SiteShell>
      <div id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">Understand your health data</p>
            <h1>Simple, evidence-aware health calculators.</h1>
            <p className="lead">
              Explore educational tools built from versioned, reviewable calculator contracts. Your
              laboratory’s reference range always takes precedence.
            </p>
            <div className="hero__pills" aria-label="Platform principles">
              <span>✓ Evidence-aware</span>
              <span>✓ Reviewable contracts</span>
              <span>✓ Anonymous-first</span>
            </div>
          </div>
          <div className="hero__visual" aria-label="How a calculator is organised">
            <div className="hero__orb hero__orb--one" aria-hidden="true" />
            <div className="hero__orb hero__orb--two" aria-hidden="true" />
            <div className="report-preview">
              <div className="report-preview__topline">
                <span className="report-preview__logo" aria-hidden="true">
                  N
                </span>
                <span>NIRO HEALTH</span>
                <span className="report-preview__status">
                  {hasTestingRecords ? 'TESTING' : 'READY'}
                </span>
              </div>
              <div className="report-preview__title">A clearer path through health data</div>
              <div className="report-preview__rows">
                <div>
                  <span>Inputs</span>
                  <strong>Guided</strong>
                </div>
                <div>
                  <span>Method</span>
                  <strong>Versioned</strong>
                </div>
                <div>
                  <span>Output</span>
                  <strong>Explained</strong>
                </div>
              </div>
              <div className="report-preview__bar" aria-hidden="true">
                <span />
              </div>
              <p>Educational context for a conversation with your clinician.</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="directory-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Calculator directory</p>
              <h2 id="directory-heading">
                {hasTestingRecords ? 'Testing calculators' : 'Published calculators'}
              </h2>
            </div>
            <p className="muted">Anonymous-first. No account required.</p>
          </div>
          <CalculatorDirectory
            initialItems={initialLoad.items}
            initialLoadFailed={initialLoad.failed}
          />
        </section>
      </div>
    </SiteShell>
  );
}
