'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  ApiError,
  assessCalculator,
  sharedResult,
  submitLead,
  type CalculatorConfig,
  type PublicSharedResult,
} from './api';
import { useAnalytics } from './analytics/AnalyticsProvider';
import {
  CalculatorRenderer,
  clearProgress,
  type AssessmentPayload,
  type AssessmentSubmissionLifecycle,
} from './calculator';
import {
  ResultRenderer,
  type LeadCaptureOptions,
  type ResultDirection,
  type ResultLayoutBlock,
  type ResultParameterStatus,
  type ResultPresentation,
  type ResultProjection,
} from './result';

const DEFAULT_RESULT_LAYOUT: readonly ResultLayoutBlock[] = [
  'score-gauge',
  'category',
  'key-contributors',
  'domain-breakdown',
  'biomarker-details',
  'recommendations',
];

function resultStatus(value: string | undefined): ResultParameterStatus | undefined {
  return value && ['scored', 'missing', 'excluded', 'blocked'].includes(value)
    ? (value as ResultParameterStatus)
    : undefined;
}

function resultDirection(value: string | undefined): ResultDirection | undefined {
  return value &&
    ['higher-is-worse', 'lower-is-worse', 'higher-is-better', 'lower-is-better'].includes(value)
    ? (value as ResultDirection)
    : undefined;
}

function adaptProjection(result: PublicSharedResult): ResultProjection {
  return {
    score: result.score,
    category: result.category,
    parameters: result.parameters?.map((parameter) => ({
      key: parameter.key,
      input: parameter.input,
      value: parameter.value ?? undefined,
      canonicalUnit: parameter.canonicalUnit,
      missing: parameter.missing,
      imputed: parameter.imputed,
      applicable: parameter.applicable,
      status: resultStatus(parameter.status),
    })),
    domains: result.domains?.map((domain) => ({
      ...domain,
      status:
        domain.status && ['scored', 'empty', 'blocked'].includes(domain.status)
          ? (domain.status as 'scored' | 'empty' | 'blocked')
          : undefined,
    })),
    coverage: result.coverage,
    contributors: result.contributors
      ? {
          harmful: result.contributors.harmful.map((item) => ({
            key: item.key,
            status: resultStatus(item.status),
          })),
          protective: result.contributors.protective.map((item) => ({
            key: item.key,
            status: resultStatus(item.status),
          })),
        }
      : undefined,
    warnings: result.warnings,
  };
}

function adaptPresentation(result: PublicSharedResult): ResultPresentation {
  const snapshot = result.presentation;
  const layout = snapshot?.resultLayout.filter((item): item is ResultLayoutBlock =>
    DEFAULT_RESULT_LAYOUT.includes(item as ResultLayoutBlock),
  );
  const direction = resultDirection(snapshot?.scoreScale?.direction);
  return {
    calculatorSlug: snapshot?.calculatorSlug,
    calculatorVersion: snapshot?.calculatorVersion,
    calculatorName: snapshot?.name,
    summary: snapshot?.shortDescription,
    disclaimers: snapshot?.disclaimers,
    layout: layout?.length ? layout : DEFAULT_RESULT_LAYOUT,
    scoreDisplay: snapshot?.scoreScale
      ? {
          min: snapshot.scoreScale.min,
          max: snapshot.scoreScale.max,
          direction,
        }
      : undefined,
    parameters: snapshot?.parameters.map((parameter) => ({
      key: parameter.key,
      label: parameter.label,
      biomarkerKey: parameter.biomarkerKey,
      kind: parameter.biomarkerKey ? 'measurement' : 'questionnaire',
    })),
    domains: snapshot?.domains,
    releaseState: snapshot?.releaseState,
  };
}

function leadCaptureOptions(): LeadCaptureOptions | undefined {
  const consentText = process.env.NEXT_PUBLIC_LEAD_CONSENT_TEXT?.trim();
  const consentVersion = process.env.NEXT_PUBLIC_LEAD_CONSENT_VERSION?.trim();
  if (process.env.NEXT_PUBLIC_LEAD_CAPTURE_ENABLED !== 'true' || !consentText || !consentVersion)
    return undefined;
  return {
    enabled: true,
    consentText,
    consentVersion,
    onSubmit: async ({ email, consentVersion: submittedVersion }) => {
      await submitLead({ email, consent: true, consentVersion: submittedVersion });
    },
  };
}

const subscribeToStaticBrowserOrigin = () => () => undefined;

function useAbsoluteShareUrl(token: string | undefined): string | undefined {
  const origin = useSyncExternalStore(
    subscribeToStaticBrowserOrigin,
    () => window.location.origin,
    () => '',
  );
  return token && origin
    ? new URL(`/results/${encodeURIComponent(token)}`, origin).toString()
    : undefined;
}

function clearSavedProgress(config: CalculatorConfig): void {
  try {
    clearProgress(window.sessionStorage, config);
  } catch {
    // Progress storage is a convenience and may be unavailable in hardened browsers.
  }
}

function ResultExperience({
  result,
  shareToken,
  onRetake,
  renderSummary = true,
  renderDisclaimers = true,
  openedShareLink = false,
}: Readonly<{
  result: PublicSharedResult;
  shareToken?: string;
  onRetake?: () => void;
  renderSummary?: boolean;
  renderDisclaimers?: boolean;
  openedShareLink?: boolean;
}>) {
  const { track } = useAnalytics();
  const shareUrl = useAbsoluteShareUrl(shareToken);
  const presentation = useMemo(() => adaptPresentation(result), [result]);
  const projection = useMemo(() => adaptProjection(result), [result]);
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    if (openedShareLink) {
      track('share_open', {
        calculatorSlug: presentation.calculatorSlug,
        path: '/results/[capability]',
        action: 'open',
      });
    } else {
      track('result_view', { calculatorSlug: presentation.calculatorSlug });
    }
  }, [openedShareLink, presentation.calculatorSlug, track]);
  return (
    <div className="result-card card" aria-live="polite">
      <ResultRenderer
        projection={projection}
        presentation={presentation}
        renderSummary={renderSummary}
        renderDisclaimers={renderDisclaimers}
        shareUrl={shareUrl}
        retakeHref={
          presentation.calculatorSlug
            ? `/c/${encodeURIComponent(presentation.calculatorSlug)}`
            : undefined
        }
        onRetake={onRetake}
        onRetakeAction={() =>
          track('retake', { calculatorSlug: presentation.calculatorSlug, action: 'retake' })
        }
        onShareCopy={() =>
          track('share', { calculatorSlug: presentation.calculatorSlug, action: 'copy' })
        }
        leadCapture={leadCaptureOptions()}
      />
    </div>
  );
}

export function CalculatorExperience({ config }: Readonly<{ config: CalculatorConfig }>) {
  const [completed, setCompleted] = useState<{
    readonly result: PublicSharedResult;
    readonly shareToken: string;
  }>();
  const [rendererKey, setRendererKey] = useState(0);

  async function submit(
    payload: AssessmentPayload,
    lifecycle: AssessmentSubmissionLifecycle,
  ): Promise<void> {
    const assessment = await assessCalculator(
      config.calculatorSlug,
      { inputs: payload.inputs, omitted: payload.omitted },
      payload.idempotencyKey,
    );
    lifecycle.assessmentSucceeded();
    const result = await sharedResult(assessment.shareToken, { cache: 'no-store' });
    clearSavedProgress(config);
    setCompleted({ result, shareToken: assessment.shareToken });
  }

  function retake(): void {
    clearSavedProgress(config);
    setCompleted(undefined);
    setRendererKey((value) => value + 1);
  }

  if (completed)
    return (
      <ResultExperience
        result={completed.result}
        shareToken={completed.shareToken}
        onRetake={retake}
        renderSummary={false}
        renderDisclaimers={false}
      />
    );
  return (
    <section className="calculator-panel" aria-labelledby="calculator-form-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Anonymous assessment</p>
          <h2 id="calculator-form-heading">Enter your information</h2>
        </div>
        <p className="muted">Progress is saved only in this browser tab.</p>
      </div>
      <CalculatorRenderer key={rendererKey} config={config} onSubmit={submit} />
    </section>
  );
}

export function SharedResultExperience({
  token,
  initialResult,
}: Readonly<{ token: string; initialResult: PublicSharedResult }>) {
  const query = useQuery({
    queryKey: ['shared-result', token],
    queryFn: () => sharedResult(token, { cache: 'no-store' }),
    initialData: initialResult,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (query.isError) {
    const message =
      query.error instanceof ApiError && query.error.status === 404
        ? 'This result link has expired or was revoked.'
        : 'This result is temporarily unavailable.';
    return (
      <section className="error-state" role="alert">
        <h1>Result unavailable</h1>
        <p>{message}</p>
      </section>
    );
  }
  return <ResultExperience result={query.data} shareToken={token} openedShareLink />;
}
