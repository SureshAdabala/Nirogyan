import React, { Fragment, type ReactNode } from 'react';

import { SafeMarkdown, safeContentUrl } from './SafeMarkdown';
import type {
  ContentBlock,
  ContentCitation,
  ContentClaim,
  ContentRendererProps,
  RelatedContentKind,
} from './types';

function humanize(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Related item';
}

function citationHref(citation: ContentCitation): string | undefined {
  return safeContentUrl(citation.url);
}

function CitationDisclosure({
  claimIds,
  claims,
  citations,
}: {
  readonly claimIds?: readonly string[];
  readonly claims: readonly ContentClaim[];
  readonly citations: readonly ContentCitation[];
}) {
  const linkedClaims = (claimIds ?? []).flatMap((id) => {
    const claim = claims.find((candidate) => candidate.id === id);
    return claim ? [claim] : [];
  });
  const citationIds = [...new Set(linkedClaims.flatMap((claim) => claim.citationIds))];
  const linkedCitations = citationIds.flatMap((id) => {
    const citation = citations.find((candidate) => candidate.id === id);
    return citation ? [citation] : [];
  });
  if (!linkedClaims.length && !linkedCitations.length) return null;

  return (
    <details className="content-sources">
      <summary>Source{linkedCitations.length === 1 ? '' : 's'} for this information</summary>
      {linkedClaims.length > 0 && (
        <ul className="content-claims">
          {linkedClaims.map((claim) => (
            <li key={claim.id}>
              {claim.text} <small>Review: {humanize(claim.reviewStatus)}</small>
            </li>
          ))}
        </ul>
      )}
      {linkedCitations.length > 0 && (
        <ol className="content-citations">
          {linkedCitations.map((citation) => {
            const href = citationHref(citation);
            return (
              <li key={citation.id}>
                {citation.org && <span>{citation.org}. </span>}
                {href ? (
                  <a href={href} rel={/^https?:/i.test(href) ? 'noopener noreferrer' : undefined}>
                    {citation.title}
                  </a>
                ) : (
                  <span>{citation.title}</span>
                )}
                {citation.localRef && <span> — {citation.localRef}</span>}
                {citation.accessedAt && <span> (accessed {citation.accessedAt})</span>}
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}

function withSources(
  content: ContentRendererProps['content'],
  claimIds: readonly string[] | undefined,
  node: ReactNode,
) {
  return (
    <>
      {node}
      <CitationDisclosure
        claimIds={claimIds}
        claims={content.claims}
        citations={content.citations}
      />
    </>
  );
}

function defaultRelatedHref(kind: RelatedContentKind, key: string): string | undefined {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) return undefined;
  if (kind === 'calculator') return `/c/${key}`;
  if (kind === 'measurement') return `/biomarkers/${key}`;
  return `/content/${key}`;
}

function RelatedList({
  title,
  kind,
  keys,
  hrefFor,
}: {
  readonly title: string;
  readonly kind: RelatedContentKind;
  readonly keys: readonly string[];
  readonly hrefFor: (kind: RelatedContentKind, key: string) => string | undefined;
}) {
  if (!keys.length) return null;
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {keys.map((key) => {
          const href = safeContentUrl(hrefFor(kind, key));
          return <li key={key}>{href ? <a href={href}>{humanize(key)}</a> : humanize(key)}</li>;
        })}
      </ul>
    </div>
  );
}

function renderBlock(block: ContentBlock, props: ContentRendererProps): ReactNode {
  const { content } = props;
  const headingId = `content-block-${block.id}`;
  switch (block.type) {
    case 'markdown':
      return withSources(
        content,
        block.claimIds,
        <div className="content-markdown">
          <SafeMarkdown markdown={block.markdown} />
        </div>,
      );
    case 'callout':
      return withSources(
        content,
        block.claimIds,
        <aside className={`content-callout content-callout-${block.tone}`}>
          {block.title && <h2 id={headingId}>{block.title}</h2>}
          <SafeMarkdown markdown={block.markdown} />
        </aside>,
      );
    case 'faq':
      return (
        <section aria-labelledby={headingId}>
          <h2 id={headingId}>Frequently asked questions</h2>
          {block.items.map((item) => (
            <details key={item.id}>
              <summary>{item.question}</summary>
              <SafeMarkdown markdown={item.answerMarkdown} />
              <CitationDisclosure
                claimIds={[...(block.claimIds ?? []), ...(item.claimIds ?? [])]}
                claims={content.claims}
                citations={content.citations}
              />
            </details>
          ))}
        </section>
      );
    case 'steps':
      return (
        <section aria-labelledby={headingId}>
          <h2 id={headingId}>Steps</h2>
          <ol>
            {block.steps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <h3>{step.title}</h3>
                <SafeMarkdown markdown={step.markdown} />
                <CitationDisclosure
                  claimIds={[...(block.claimIds ?? []), ...(step.claimIds ?? [])]}
                  claims={content.claims}
                  citations={content.citations}
                />
              </li>
            ))}
          </ol>
        </section>
      );
    case 'table':
      return withSources(
        content,
        block.claimIds,
        <div className="content-table-scroll" role="region" aria-label={block.caption} tabIndex={0}>
          <table>
            <caption>{block.caption}</caption>
            <thead>
              <tr>
                {block.headers.map((header, index) => (
                  <th key={`${header}-${index}`} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    case 'media': {
      const source = safeContentUrl(props.resolveAsset?.(block.assetId));
      return withSources(
        content,
        block.claimIds,
        <figure>
          {source ? (
            // The managed asset resolver supplies reviewed runtime URLs; dimensions are not
            // available at this generic registry boundary.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source} alt={block.alt} />
          ) : (
            <div role="img" aria-label={block.alt} className="content-media-placeholder">
              Managed media unavailable
            </div>
          )}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>,
      );
    }
    case 'related': {
      const hrefFor = props.relatedHref ?? defaultRelatedHref;
      return withSources(
        content,
        block.claimIds,
        <nav aria-labelledby={headingId}>
          <h2 id={headingId}>Related information</h2>
          <RelatedList
            title="Calculators"
            kind="calculator"
            keys={block.calculatorSlugs ?? []}
            hrefFor={hrefFor}
          />
          <RelatedList
            title="Measurements"
            kind="measurement"
            keys={block.measurementKeys ?? []}
            hrefFor={hrefFor}
          />
          <RelatedList
            title="Articles"
            kind="content"
            keys={block.contentSlugs ?? []}
            hrefFor={hrefFor}
          />
        </nav>,
      );
    }
    case 'disclaimer':
      return withSources(
        content,
        block.claimIds,
        <aside className="content-disclaimer" aria-label="Educational disclaimer">
          <SafeMarkdown markdown={block.markdown} />
        </aside>,
      );
    case 'calculator-embed':
      return withSources(
        content,
        block.claimIds,
        <section aria-label={`Calculator: ${humanize(block.calculatorSlug)}`}>
          {props.renderCalculatorEmbed?.(block.calculatorSlug) ?? (
            <p>
              <a href={`/c/${block.calculatorSlug}`}>Open {humanize(block.calculatorSlug)}</a>
            </p>
          )}
        </section>,
      );
    case 'crisis-resources':
      return withSources(
        content,
        block.claimIds,
        <aside
          className="content-crisis-resources"
          aria-labelledby={headingId}
          data-trigger-ref={block.triggerRef}
        >
          <h2 id={headingId}>Urgent support</h2>
          <SafeMarkdown markdown={block.markdown} />
          <ul>
            {block.resources.map((resource) => {
              const href = safeContentUrl(resource.url);
              return (
                <li key={`${resource.region}-${resource.label}`}>
                  <strong>{resource.region}: </strong>
                  {href ? (
                    <a href={href} rel={/^https?:/i.test(href) ? 'noopener noreferrer' : undefined}>
                      {resource.label}
                    </a>
                  ) : (
                    resource.label
                  )}{' '}
                  — {resource.contact}
                </li>
              );
            })}
          </ul>
        </aside>,
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

export function ContentRenderer(props: ContentRendererProps) {
  const { content, renderTitle = true, renderSummary = true, visibleBlockIds } = props;
  const visibleBlocks = visibleBlockIds
    ? content.blocks.filter((block) => visibleBlockIds.has(block.id))
    : content.blocks;
  return (
    <article className="content-renderer" lang={content.locale}>
      {(renderTitle || renderSummary) && (
        <header>
          {renderTitle && <h1>{content.title}</h1>}
          {renderSummary && <p>{content.summary}</p>}
        </header>
      )}
      {visibleBlocks.map((block) => (
        <Fragment key={block.id}>{renderBlock(block, props)}</Fragment>
      ))}
    </article>
  );
}
