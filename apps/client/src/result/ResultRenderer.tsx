'use client';

import React, { useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

import { LeadCapture } from './LeadCapture';
import type {
  LeadCaptureOptions,
  ResultContributorProjection,
  ResultCoverageSegment,
  ResultDomainProjection,
  ResultLayoutBlock,
  ResultParameterPresentation,
  ResultParameterProjection,
  ResultPresentation,
  ResultProjection,
} from './types';

export interface ResultRendererProps {
  readonly projection: ResultProjection;
  readonly presentation: ResultPresentation;
  /** Defaults to true; disable when a containing calculator page owns the summary. */
  readonly renderSummary?: boolean;
  /** Defaults to true; disable when a containing calculator page owns these disclaimers. */
  readonly renderDisclaimers?: boolean;
  readonly shareUrl?: string;
  readonly retakeHref?: string;
  readonly onRetake?: () => void;
  readonly onRetakeAction?: () => void;
  readonly onShareCopy?: () => void;
  readonly leadCapture?: LeadCaptureOptions;
}

interface ResultBlockProps {
  readonly projection: ResultProjection;
  readonly presentation: ResultPresentation;
}

type ResultBlockComponent = (props: ResultBlockProps) => ReactNode;

export function humanizeResultIdentifier(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!normalized) return 'Result item';
  return normalized
    .split(/\s+/)
    .map((word) =>
      /^[a-z0-9]+$/.test(word) && (word.length <= 4 || /\d/.test(word))
        ? word.toUpperCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(' ');
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: Math.min(6, Math.max(0, decimals)),
  }).format(value);
}

function formatRatio(value: number | undefined): string | undefined {
  if (!finite(value)) return undefined;
  return `${formatNumber(value * 100, 1)}%`;
}

function safeHexColor(value: string | undefined): string | undefined {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : undefined;
}

function safeRetakeHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function parameterPresentation(
  parameter: ResultParameterProjection,
  presentation: ResultPresentation,
): ResultParameterPresentation {
  const snapshot = presentation.parameters?.find((item) => item.key === parameter.key);
  return {
    key: parameter.key,
    label: parameter.label ?? snapshot?.label ?? humanizeResultIdentifier(parameter.key),
    group: parameter.group ?? snapshot?.group,
    biomarkerKey: parameter.biomarkerKey ?? snapshot?.biomarkerKey,
    kind: parameter.kind ?? snapshot?.kind,
  };
}

function domainLabel(domain: ResultDomainProjection, presentation: ResultPresentation): string {
  return (
    domain.label ??
    presentation.domains?.find((item) => item.key === domain.key)?.label ??
    humanizeResultIdentifier(domain.key)
  );
}

function ScoreGauge({ projection, presentation }: ResultBlockProps) {
  const score = projection.score;
  const display = presentation.scoreDisplay;
  const decimals = display?.displayDecimals ?? 2;
  const scoreText = finite(score)
    ? `${formatNumber(score, decimals)}${display?.unit ? ` ${display.unit}` : ''}`
    : 'Not available';
  const canRenderMeter =
    finite(score) &&
    display !== undefined &&
    finite(display.min) &&
    finite(display.max) &&
    display.max > display.min &&
    score >= display.min &&
    score <= display.max;
  const directionText =
    display?.direction === 'higher-is-worse'
      ? 'Higher scores indicate a less favourable result.'
      : display?.direction === 'lower-is-worse'
        ? 'Lower scores indicate a less favourable result.'
        : display?.direction === 'higher-is-better'
          ? 'Higher scores indicate a more favourable result.'
          : display?.direction === 'lower-is-better'
            ? 'Lower scores indicate a more favourable result.'
            : undefined;

  return (
    <section className="result-block result-score" aria-labelledby="result-score-heading">
      <h3 id="result-score-heading">Result</h3>
      <p className="result-score-value">{scoreText}</p>
      {canRenderMeter && (
        <meter
          min={display.min}
          max={display.max}
          value={score}
          aria-label={`Score ${scoreText} on a scale from ${formatNumber(display.min)} to ${formatNumber(display.max)}`}
        >
          {scoreText}
        </meter>
      )}
      {directionText && <p>{directionText}</p>}
    </section>
  );
}

function Category({ projection }: ResultBlockProps) {
  const category = projection.category;
  const color = safeHexColor(category?.color);
  return (
    <section className="result-block result-category" aria-labelledby="result-category-heading">
      <h3 id="result-category-heading">Category</h3>
      <p>
        {color && (
          <span
            className="result-category-swatch"
            aria-hidden="true"
            style={{ backgroundColor: color }}
          />
        )}
        <strong>{category?.label ?? 'Category not available'}</strong>
      </p>
      {category?.message && <p>{category.message}</p>}
    </section>
  );
}

function contributorLabel(
  contributor: ResultContributorProjection,
  presentation: ResultPresentation,
): string {
  return (
    contributor.label ??
    presentation.parameters?.find((item) => item.key === contributor.key)?.label ??
    humanizeResultIdentifier(contributor.key)
  );
}

function ContributorList({
  title,
  items,
  presentation,
}: {
  readonly title: string;
  readonly items: readonly ResultContributorProjection[];
  readonly presentation: ResultPresentation;
}) {
  return (
    <div>
      <h4>{title}</h4>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.key}>{contributorLabel(item, presentation)}</li>
          ))}
        </ul>
      ) : (
        <p>None identified from the available inputs.</p>
      )}
    </div>
  );
}

function Contributors({ projection, presentation }: ResultBlockProps) {
  const harmful = projection.contributors?.harmful ?? [];
  const protective = projection.contributors?.protective ?? [];
  return (
    <section
      className="result-block result-contributors"
      aria-labelledby="result-contributors-heading"
    >
      <h3 id="result-contributors-heading">Why this result</h3>
      <ContributorList
        title="Factors increasing the score"
        items={harmful}
        presentation={presentation}
      />
      <ContributorList title="Protective factors" items={protective} presentation={presentation} />
    </section>
  );
}

function DomainBreakdown({ projection, presentation }: ResultBlockProps) {
  const domains = projection.domains ?? [];
  return (
    <section className="result-block result-domains" aria-labelledby="result-domains-heading">
      <h3 id="result-domains-heading">Domain details</h3>
      {domains.length ? (
        <ul className="result-domain-list">
          {domains.map((domain) => {
            const coverage = formatRatio(domain.coverage);
            return (
              <li key={domain.key}>
                <article>
                  <h4>{domainLabel(domain, presentation)}</h4>
                  <p>Score: {finite(domain.score) ? formatNumber(domain.score) : 'Not scored'}</p>
                  {coverage && (
                    <>
                      <p>Coverage: {coverage}</p>
                      {finite(domain.coverage) && domain.coverage >= 0 && domain.coverage <= 1 && (
                        <progress
                          max={1}
                          value={domain.coverage}
                          aria-label={`${domainLabel(domain, presentation)} coverage ${coverage}`}
                        />
                      )}
                    </>
                  )}
                  {domain.applicableCount !== undefined && (
                    <p>
                      {domain.scoredCount ?? 0} of {domain.applicableCount} applicable inputs scored
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No domain breakdown is available for this result.</p>
      )}
    </section>
  );
}

function parameterState(parameter: ResultParameterProjection): string {
  if (parameter.applicable === false) return 'Not applicable';
  if (parameter.imputed) return 'Estimated by the calculator';
  if (parameter.status === 'blocked') return 'Required value unavailable';
  if (parameter.missing || parameter.status === 'missing' || parameter.status === 'excluded')
    return 'Not provided';
  return 'Included';
}

function parameterValue(parameter: ResultParameterProjection): string {
  if (parameter.value === undefined || parameter.value === null) return '—';
  const value =
    typeof parameter.value === 'number'
      ? formatNumber(parameter.value)
      : typeof parameter.value === 'boolean'
        ? parameter.value
          ? 'Yes'
          : 'No'
        : parameter.value;
  return `${value}${parameter.canonicalUnit ? ` ${parameter.canonicalUnit}` : ''}`;
}

function BiomarkerDetails({ projection, presentation }: ResultBlockProps) {
  const parameters = projection.parameters ?? [];
  return (
    <section className="result-block result-parameters" aria-labelledby="result-parameters-heading">
      <h3 id="result-parameters-heading">Biomarker and input details</h3>
      {parameters.length ? (
        <ul className="result-parameter-list">
          {parameters.map((parameter) => {
            const metadata = parameterPresentation(parameter, presentation);
            const biomarkerHref =
              metadata.biomarkerKey && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.biomarkerKey)
                ? `/biomarkers/${encodeURIComponent(metadata.biomarkerKey)}`
                : undefined;
            return (
              <li key={parameter.key}>
                <article>
                  <h4>{metadata.label}</h4>
                  <dl>
                    <div>
                      <dt>Value</dt>
                      <dd>{parameterValue(parameter)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{parameterState(parameter)}</dd>
                    </div>
                  </dl>
                  {biomarkerHref && <Link href={biomarkerHref}>Learn about {metadata.label}</Link>}
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No input details are available for this result.</p>
      )}
    </section>
  );
}

function Recommendations({ projection }: ResultBlockProps) {
  const recommendations = [
    projection.category?.recommendation,
    ...(projection.recommendations ?? []),
  ].filter((item, index, items): item is string =>
    Boolean(item && item.trim() && items.indexOf(item) === index),
  );
  return (
    <section
      className="result-block result-recommendations"
      aria-labelledby="result-recommendations-heading"
    >
      <h3 id="result-recommendations-heading">Recommendations</h3>
      {recommendations.length ? (
        <ul>
          {recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No reviewed recommendations are attached to this result.</p>
      )}
    </section>
  );
}

export const RESULT_BLOCK_REGISTRY: Readonly<Record<ResultLayoutBlock, ResultBlockComponent>> = {
  'score-gauge': ScoreGauge,
  category: Category,
  'key-contributors': Contributors,
  'domain-breakdown': DomainBreakdown,
  'biomarker-details': BiomarkerDetails,
  recommendations: Recommendations,
};

function deriveCoverageSegment(
  parameters: readonly ResultParameterProjection[],
  presentation: ResultPresentation,
  kind: 'measurement' | 'questionnaire',
): ResultCoverageSegment | undefined {
  const matching = parameters.filter((parameter) => {
    const metadata = parameterPresentation(parameter, presentation);
    const resolvedKind = metadata.kind ?? (metadata.biomarkerKey ? 'measurement' : 'questionnaire');
    return resolvedKind === kind && parameter.applicable !== false;
  });
  if (!matching.length) return undefined;
  const scoredCount = matching.filter((parameter) => parameter.status === 'scored').length;
  return {
    scoredCount,
    applicableCount: matching.length,
    coverage: matching.length ? scoredCount / matching.length : 0,
  };
}

function CoverageNotice({ projection, presentation }: ResultBlockProps) {
  const coverage = projection.coverage;
  const scored = coverage?.scoredParameterCount;
  const applicable = coverage?.applicableScoredParameterCount;
  const measured =
    coverage?.measuredLab ??
    deriveCoverageSegment(projection.parameters ?? [], presentation, 'measurement');
  const questionnaire =
    coverage?.questionnaire ??
    deriveCoverageSegment(projection.parameters ?? [], presentation, 'questionnaire');
  const omitted = (projection.parameters ?? []).filter(
    (parameter) =>
      parameter.applicable !== false &&
      (parameter.missing || parameter.status === 'missing' || parameter.status === 'excluded'),
  );
  const partial = finite(scored) && finite(applicable) && scored < applicable;

  if (!coverage && !omitted.length) return null;
  return (
    <aside className="result-coverage" aria-labelledby="result-coverage-heading">
      <h3 id="result-coverage-heading">Information used</h3>
      {finite(scored) && finite(applicable) && (
        <p>
          This result used {scored} of {applicable} applicable inputs
          {formatRatio(coverage?.parameterCoverage)
            ? ` (${formatRatio(coverage?.parameterCoverage)} coverage)`
            : ''}
          .
        </p>
      )}
      {partial && (
        <p>This is a partial result because some applicable information was unavailable.</p>
      )}
      {measured && (
        <p>
          Measured laboratory inputs: {measured.scoredCount} of {measured.applicableCount}
          {formatRatio(measured.coverage) ? ` (${formatRatio(measured.coverage)})` : ''}.
        </p>
      )}
      {questionnaire && (
        <p>
          Questionnaire and context inputs: {questionnaire.scoredCount} of{' '}
          {questionnaire.applicableCount}
          {formatRatio(questionnaire.coverage) ? ` (${formatRatio(questionnaire.coverage)})` : ''}.
        </p>
      )}
      {omitted.length > 0 && (
        <details>
          <summary>
            {omitted.length} input{omitted.length === 1 ? '' : 's'} not provided
          </summary>
          <ul>
            {omitted.map((parameter) => (
              <li key={parameter.key}>{parameterPresentation(parameter, presentation).label}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

function ShareControls({
  shareUrl,
  retakeHref,
  onRetake,
  onRetakeAction,
  onShareCopy,
}: {
  readonly shareUrl?: string;
  readonly retakeHref?: string;
  readonly onRetake?: () => void;
  readonly onRetakeAction?: () => void;
  readonly onShareCopy?: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<string>();
  const href = safeRetakeHref(retakeHref);

  async function copyShareLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl ?? '');
      setCopyStatus('Share link copied.');
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopyStatus('Automatic copy is unavailable. Select and copy the share link manually.');
      return;
    }
    try {
      onShareCopy?.();
    } catch {
      // Optional telemetry must never affect a successful clipboard action.
    }
  }

  if (!shareUrl && !href && !onRetake) return null;
  return (
    <section className="result-actions" aria-labelledby="result-actions-heading">
      <h2 id="result-actions-heading">Next actions</h2>
      {shareUrl && (
        <div>
          <label htmlFor={inputId}>Temporary share link</label>
          <input id={inputId} ref={inputRef} value={shareUrl} readOnly />
          <button type="button" onClick={() => void copyShareLink()}>
            Copy share link
          </button>
          <p>
            This capability link gives anyone who has it access to this result until it expires.
          </p>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </div>
      )}
      {onRetake && (
        <button
          type="button"
          onClick={() => {
            onRetakeAction?.();
            onRetake();
          }}
        >
          Retake calculator
        </button>
      )}
      {!onRetake && href && (
        <a href={href} onClick={onRetakeAction}>
          Retake calculator
        </a>
      )}
    </section>
  );
}

function PresentationDisclaimers({ disclaimers }: { readonly disclaimers: readonly string[] }) {
  const uniqueDisclaimers = [...new Set(disclaimers)].filter(
    (disclaimer) => disclaimer.trim().length > 0,
  );
  if (!uniqueDisclaimers.length) return null;
  return (
    <aside className="disclaimer-list" aria-label="Calculator disclaimers">
      <h3>Important information</h3>
      {uniqueDisclaimers.map((disclaimer) => (
        <p key={disclaimer}>{disclaimer}</p>
      ))}
    </aside>
  );
}

export function ResultRenderer({
  projection,
  presentation,
  renderSummary = true,
  renderDisclaimers = true,
  shareUrl,
  retakeHref,
  onRetake,
  onRetakeAction,
  onShareCopy,
  leadCapture,
}: ResultRendererProps) {
  const headingId = useId();
  return (
    <section className="result-renderer" aria-labelledby={headingId}>
      {presentation.releaseState === 'testing-unapproved' ? (
        <div className="testing-warning" role="note">
          <strong>Testing result · Unapproved calculator</strong>
          <span>
            This result is for functional testing only and must not guide clinical decisions.
          </span>
        </div>
      ) : null}
      <h2 id={headingId}>
        {presentation.calculatorName
          ? `${presentation.calculatorName} result`
          : 'Assessment result'}
      </h2>
      {presentation.calculatorVersion !== undefined && (
        <p>Assessed with calculator version {presentation.calculatorVersion}.</p>
      )}
      {renderSummary && presentation.summary && <p>{presentation.summary}</p>}
      <CoverageNotice projection={projection} presentation={presentation} />
      {presentation.layout.map((block, index) => {
        const Block = RESULT_BLOCK_REGISTRY[block];
        return Block ? (
          <Block key={`${block}-${index}`} projection={projection} presentation={presentation} />
        ) : null;
      })}
      {projection.warnings && projection.warnings.length > 0 && (
        <aside className="result-warnings" aria-labelledby="result-warnings-heading">
          <h3 id="result-warnings-heading">Important notes</h3>
          <ul>
            {projection.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}
      {renderDisclaimers && presentation.disclaimers && (
        <PresentationDisclaimers disclaimers={presentation.disclaimers} />
      )}
      <ShareControls
        shareUrl={shareUrl}
        retakeHref={retakeHref}
        onRetake={onRetake}
        onRetakeAction={onRetakeAction}
        onShareCopy={onShareCopy}
      />
      {leadCapture?.enabled && <LeadCapture options={leadCapture} />}
    </section>
  );
}
