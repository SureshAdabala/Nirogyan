import type {
  PublicBiomarkerDetail,
  PublicBiomarkerReferenceRange,
  PublicBiomarkerSource,
} from '@niro/contracts';
import Link from 'next/link';
import React from 'react';

import {
  formatReferenceInterval,
  referenceContextEntries,
  safePublicSourceUrl,
} from './range-format';

function humanizeBiomarkerKey(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase('en-IN')}${part.slice(1)}`)
    .join(' ');
}

function sourcesForRange(
  range: PublicBiomarkerReferenceRange,
  sources: readonly PublicBiomarkerSource[],
): readonly PublicBiomarkerSource[] {
  const claims = new Set(range.sourceClaimIds);
  return sources.filter((source) => source.claimIds?.some((claim) => claims.has(claim)) === true);
}

function RangeProvenance({
  range,
  sources,
}: Readonly<{
  range: PublicBiomarkerReferenceRange;
  sources: readonly PublicBiomarkerSource[];
}>) {
  const matching = sourcesForRange(range, sources);
  return (
    <details className="biomarker-provenance">
      <summary>View source provenance for {range.label}</summary>
      {matching.length ? (
        <ul>
          {matching.map((source) => {
            const href = safePublicSourceUrl(source.url);
            return (
              <li key={source.id}>
                <p>
                  <strong>
                    {source.org ? `${source.org}: ` : ''}
                    {source.title}
                  </strong>
                </p>
                <p className="muted">
                  {humanizeBiomarkerKey(source.verification)}
                  {source.accessed ? ` · Accessed ${source.accessed}` : ''}
                </p>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    Open source{' '}
                    <span className="calculator-visually-hidden">(opens in a new tab)</span>
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No matching public source record is available for this range.</p>
      )}
    </details>
  );
}

function ReferenceRangeCard({
  range,
  sources,
}: Readonly<{
  range: PublicBiomarkerReferenceRange;
  sources: readonly PublicBiomarkerSource[];
}>) {
  const context = referenceContextEntries(range.context);
  const matchingSources = sourcesForRange(range, sources);
  return (
    <article className="biomarker-range-card">
      <h3>{range.label}</h3>
      <p className="muted">
        <strong>Source:</strong>{' '}
        {matchingSources.length
          ? matchingSources.map((source) => source.org ?? source.title).join('; ')
          : 'No matching public source attribution'}
      </p>
      <p className="biomarker-range-card__value">
        {formatReferenceInterval(range.interval, range.unit)}
      </p>
      <p className="biomarker-range-card__badge">Interpretation-only reference</p>
      {range.interpretation ? <p>{range.interpretation}</p> : null}
      {context.length ? (
        <dl className="biomarker-context-list">
          {context.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">No additional population or method context is specified.</p>
      )}
      <RangeProvenance range={range} sources={sources} />
    </article>
  );
}

function groupedRanges(ranges: readonly PublicBiomarkerReferenceRange[]) {
  const groups = new Map<string, PublicBiomarkerReferenceRange[]>();
  for (const range of ranges) {
    const key = range.conflictGroup ? `conflict:${range.conflictGroup}` : `range:${range.id}`;
    const group = groups.get(key) ?? [];
    group.push(range);
    groups.set(key, group);
  }
  return [...groups.entries()];
}

export function BiomarkerDetail({ biomarker }: Readonly<{ biomarker: PublicBiomarkerDetail }>) {
  const description = biomarker.definition.description;
  const ranges = biomarker.definition.referenceRanges ?? [];
  const units = biomarker.definition.acceptedUnits ?? [];
  const groups = groupedRanges(ranges);
  const isTestingRecord = biomarker.releaseState === 'testing-unapproved';
  return (
    <div className="biomarker-detail">
      <section className="biomarker-detail__overview" aria-labelledby="biomarker-overview-heading">
        <h2 id="biomarker-overview-heading">About this measurement</h2>
        {description?.whatItMeasures ? <p>{description.whatItMeasures}</p> : null}
        {description?.whyItMatters ? (
          <div>
            <h3>Why it matters</h3>
            <p>{description.whyItMatters}</p>
          </div>
        ) : null}
        {description?.collectionNotes ? (
          <div>
            <h3>Collection notes</h3>
            <p>{description.collectionNotes}</p>
          </div>
        ) : null}
        {description?.limitations ? (
          <div>
            <h3>Limitations</h3>
            <p>{description.limitations}</p>
          </div>
        ) : null}
        {biomarker.definition.aliases?.length ? (
          <p>
            <strong>Also known as:</strong> {biomarker.definition.aliases.join(', ')}
          </p>
        ) : null}
        {biomarker.definition.domainKeys?.length ? (
          <p>
            <strong>Health domains:</strong>{' '}
            {biomarker.definition.domainKeys.map(humanizeBiomarkerKey).join(', ')}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="biomarker-units-heading">
        <h2 id="biomarker-units-heading">Units</h2>
        <p>
          <strong>Canonical unit:</strong>{' '}
          {biomarker.definition.canonicalUnit?.display ??
            biomarker.canonicalUnit ??
            'Not specified'}
        </p>
        {units.length ? (
          <ul className="biomarker-unit-list">
            {units.map((unit) => (
              <li key={unit.code}>
                {unit.display}
                {unit.code !== unit.display ? ` (${unit.code})` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="biomarker-ranges-heading">
        <h2 id="biomarker-ranges-heading">
          {isTestingRecord ? 'Testing reference ranges' : 'Reviewed reference ranges'}
        </h2>
        <aside className="biomarker-range-caveat" aria-label="Reference range caveat">
          <strong>
            Reference intervals vary by laboratory, assay, method, population, and individual
            context.
          </strong>{' '}
          Your laboratory’s interval and advice from your clinician take precedence. These ranges
          are educational interpretation references, not diagnostic cut-offs or calculator scoring
          bands.
        </aside>
        {groups.length ? (
          groups.map(([groupKey, group]) => {
            const conflict = groupKey.startsWith('conflict:') && group.length > 1;
            return (
              <div className="biomarker-range-group" key={groupKey}>
                {conflict ? (
                  <div className="biomarker-conflict-note">
                    <h3>Sources publish different ranges</h3>
                    <p>
                      These {isTestingRecord ? 'unapproved testing ranges' : 'reviewed ranges'} are
                      shown side by side. They have not been averaged, merged, or used to alter
                      calculator scoring.
                    </p>
                  </div>
                ) : null}
                <div className="biomarker-range-grid">
                  {group.map((range) => (
                    <ReferenceRangeCard key={range.id} range={range} sources={biomarker.sources} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <h3>
              {isTestingRecord
                ? 'No reference range is available in this testing draft'
                : 'No universal reviewed range is published'}
            </h3>
            <p>
              Use the interval printed by your laboratory and discuss interpretation with your
              clinician.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="biomarker-evidence-heading">
        <h2 id="biomarker-evidence-heading">Evidence and sources</h2>
        <p>
          {isTestingRecord
            ? 'Range-specific source links for this unapproved testing draft appear with each range above. The records below are the API-projected source list for this measurement draft.'
            : 'Range-specific evidence is linked by reviewed claim identifiers and appears with each published range above. The records below are the complete public source list for this measurement definition.'}
        </p>
        {biomarker.sources.length ? (
          <div>
            <h3>General measurement sources</h3>
            <ul className="biomarker-source-list">
              {biomarker.sources.map((source) => {
                const href = safePublicSourceUrl(source.url);
                const headingId = `biomarker-source-${source.id}`;
                return (
                  <li key={source.id}>
                    <article aria-labelledby={headingId}>
                      <h4 id={headingId}>
                        {source.org ? `${source.org}: ` : ''}
                        {source.title}
                      </h4>
                      <p className="muted">
                        {humanizeBiomarkerKey(source.verification)}
                        {source.accessed ? ` · Accessed ${source.accessed}` : ''}
                      </p>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          Visit evidence source{' '}
                          <span className="calculator-visually-hidden">(opens in a new tab)</span>
                        </a>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p>No public evidence records are available for this measurement.</p>
        )}
      </section>

      <section className="biomarker-interlinks" aria-labelledby="related-biomarkers-heading">
        <h2 id="related-biomarkers-heading">Related biomarkers</h2>
        <p>
          These links share a health-domain taxonomy. They do not assert a clinical association.
        </p>
        {biomarker.relatedBiomarkers?.length ? (
          <ul>
            {biomarker.relatedBiomarkers.map((related) => (
              <li key={related.key}>
                <Link href={`/biomarkers/${encodeURIComponent(related.key)}`}>
                  {related.displayName}
                </Link>
                {related.canonicalUnit ? ` · ${related.canonicalUnit}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {isTestingRecord
              ? 'No related biomarkers are currently linked to this testing draft.'
              : 'No reviewed related biomarkers are currently linked.'}
          </p>
        )}
      </section>

      <section className="biomarker-interlinks" aria-labelledby="used-in-calculators-heading">
        <h2 id="used-in-calculators-heading">Used in calculators</h2>
        {biomarker.usedInCalculators?.length ? (
          <ul>
            {biomarker.usedInCalculators.map((calculator) => (
              <li key={`${calculator.calculatorSlug}@${calculator.version}`}>
                <Link href={`/c/${encodeURIComponent(calculator.calculatorSlug)}`}>
                  {calculator.name ?? humanizeBiomarkerKey(calculator.calculatorSlug)}
                </Link>
                {calculator.shortDescription ? <p>{calculator.shortDescription}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {isTestingRecord
              ? 'No calculator links are currently available for this testing record.'
              : 'No published calculators currently reference this measurement.'}
          </p>
        )}
      </section>
    </div>
  );
}
