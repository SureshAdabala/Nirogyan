'use client';

import type {
  AdminApiRole,
  AdminCalculatorVersion,
  AdminTestCase,
  AdminTestCaseSource,
  AdminTestRunSummary,
  AdminValidationSummary,
} from '@niro/contracts';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import {
  approveVersion,
  createCalculatorVersion,
  previewVersion,
  publishVersion,
  rollbackVersion,
  runVersionTestCases,
  saveVersionTestCases,
  submitReview,
  validateVersion,
} from '../api';

type JsonRecord = Record<string, unknown>;
type EditableTestSource = Pick<AdminTestCaseSource, 'type' | 'ref' | 'verification'>;
type TestSourceType = NonNullable<AdminTestCaseSource['type']>;
type TestSourceVerification = NonNullable<AdminTestCaseSource['verification']>;

function parseObject(text: string): JsonRecord | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : undefined;
  } catch {
    return undefined;
  }
}

function resultValue(result: JsonRecord | undefined, key: string) {
  return result?.[key];
}

interface Props {
  readonly role: AdminApiRole;
  readonly version: AdminCalculatorVersion;
  readonly etag: string;
  readonly draft: JsonRecord;
  readonly history: readonly AdminCalculatorVersion[];
  readonly flush: () => Promise<string | undefined>;
  readonly onValidation: (validation: AdminValidationSummary) => void;
  readonly onVersion: (version: AdminCalculatorVersion, etag?: string) => void;
  readonly reloadHistory: () => Promise<void>;
}

export function PreviewReleasePanel({
  role,
  version,
  etag,
  draft,
  history,
  flush,
  onValidation,
  onVersion,
  reloadHistory,
}: Props) {
  const router = useRouter();
  const [previewInputs, setPreviewInputs] = useState('{}');
  const [preview, setPreview] = useState<JsonRecord>();
  const [tests, setTests] = useState<readonly AdminTestCase[]>(
    Array.isArray(draft.testCases) ? (draft.testCases as AdminTestCase[]) : [],
  );
  const [testRun, setTestRun] = useState<AdminTestRunSummary>();
  const [changelog, setChangelog] = useState('');
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const trace = Array.isArray(preview?.trace) ? preview.trace : [];
  const canEdit = version.status === 'draft' && ['admin', 'editor'].includes(role);
  const canReview = role === 'medical-reviewer';
  const canPublish = ['admin', 'medical-reviewer'].includes(role);

  const testRows = useMemo(
    () =>
      tests.map((test) => ({
        ...test,
        inputsText: JSON.stringify(test.inputs, null, 2),
        expectedText: JSON.stringify(test.expected, null, 2),
      })),
    [tests],
  );

  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setError(undefined);
    setMessage(undefined);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} failed.`);
    } finally {
      setBusy(undefined);
    }
  }

  async function ensureSaved() {
    const currentEtag = await flush();
    if (!currentEtag)
      throw new Error('Wait for autosave to finish or resolve the draft conflict first.');
    return currentEtag;
  }

  function updateTest(index: number, update: Partial<AdminTestCase>) {
    setTests((current) =>
      current.map((test, itemIndex) => (itemIndex === index ? { ...test, ...update } : test)),
    );
  }

  function updateTestSource(index: number, update: Partial<EditableTestSource>) {
    setTests((current) =>
      current.map((test, itemIndex) => {
        if (itemIndex !== index) return test;
        const { source: existingSource, ...testWithoutSource } = test;
        const source = { ...(existingSource ?? {}), ...update };
        if (!source.type) delete source.type;
        if (!source.ref) delete source.ref;
        if (!source.verification) delete source.verification;
        return Object.keys(source).length > 0
          ? { ...testWithoutSource, source }
          : testWithoutSource;
      }),
    );
  }

  return (
    <div className="admin-release-grid">
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="admin-alert admin-alert--success" role="status">
          {message}
        </p>
      ) : null}

      <section className="admin-panel" aria-labelledby="preview-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Production engine</p>
            <h2 id="preview-heading">Live preview and trace</h2>
          </div>
          <button
            className="admin-secondary-button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Preview', async () => {
                await ensureSaved();
                const inputs = parseObject(previewInputs);
                if (!inputs) throw new Error('Preview inputs must be a JSON object.');
                const response = await previewVersion(
                  version.calculatorSlug,
                  version.version,
                  inputs,
                );
                setPreview(response.data.result);
                setMessage('Preview executed with the production engine.');
              })
            }
            type="button"
          >
            Run preview
          </button>
        </div>
        <label className="admin-field">
          <span>Inputs JSON</span>
          <textarea
            onChange={(event) => setPreviewInputs(event.target.value)}
            rows={8}
            value={previewInputs}
          />
        </label>
        {preview ? (
          <div className="admin-preview-result" aria-live="polite">
            <div className="admin-metric-grid">
              <div>
                <span>Score</span>
                <strong>{String(resultValue(preview, 'score') ?? 'No score')}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{resultValue(preview, 'ok') === true ? 'Executable' : 'Blocked'}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>
                  {String(
                    (resultValue(preview, 'category') as JsonRecord | undefined)?.label ?? 'None',
                  )}
                </strong>
              </div>
            </div>
            <details>
              <summary>Authorized result details</summary>
              <pre
                aria-label="Authorized preview result details JSON"
                className="admin-json-output"
                role="region"
                tabIndex={0}
              >
                {JSON.stringify(
                  {
                    coverage: preview.coverage,
                    domains: preview.domains,
                    contributors: preview.contributors,
                    warnings: preview.warnings,
                    errors: preview.errors,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            <details className="admin-trace">
              <summary>Internal trace ({trace.length} steps)</summary>
              <p className="admin-alert admin-alert--warning">
                Trace data is admin-only and is never included in public responses.
              </p>
              <ol>
                {trace.map((step, index) => (
                  <li key={index}>
                    <pre
                      aria-label={`Internal trace step ${index + 1} JSON`}
                      role="region"
                      tabIndex={0}
                    >
                      {JSON.stringify(step, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ) : null}
      </section>

      <section className="admin-panel" aria-labelledby="tests-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Saved evidence</p>
            <h2 id="tests-heading">Test cases</h2>
          </div>
          <button
            className="admin-secondary-button"
            disabled={!canEdit || Boolean(busy)}
            onClick={() =>
              setTests((current) => [
                ...current,
                {
                  key: `case-${current.length + 1}`,
                  name: 'New reviewed case',
                  kind: 'regression',
                  inputs: {},
                  expected: {},
                },
              ])
            }
            type="button"
          >
            Add case
          </button>
        </div>
        {testRows.map((test, index) => (
          <fieldset className="admin-test-case" key={`${test.key}-${index}`}>
            <legend>{test.name || `Case ${index + 1}`}</legend>
            <div className="admin-two-column">
              <label className="admin-field">
                <span>Key</span>
                <input
                  disabled={!canEdit}
                  onChange={(event) => updateTest(index, { key: event.target.value })}
                  value={test.key}
                />
              </label>
              <label className="admin-field">
                <span>Name</span>
                <input
                  disabled={!canEdit}
                  onChange={(event) => updateTest(index, { name: event.target.value })}
                  value={test.name}
                />
              </label>
              <label className="admin-field">
                <span>Kind</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateTest(index, { kind: event.target.value as AdminTestCase['kind'] })
                  }
                  value={test.kind}
                >
                  <option value="source-worked-example">Source worked example</option>
                  <option value="boundary">Boundary</option>
                  <option value="regression">Regression</option>
                  <option value="nonclinical-fixture">Nonclinical fixture</option>
                </select>
              </label>
            </div>
            <div className="admin-two-column">
              <label className="admin-field">
                <span>Inputs JSON</span>
                <textarea
                  disabled={!canEdit}
                  onChange={(event) => {
                    const value = parseObject(event.target.value);
                    if (value) updateTest(index, { inputs: value });
                  }}
                  rows={6}
                  defaultValue={test.inputsText}
                />
              </label>
              <label className="admin-field">
                <span>Expected JSON</span>
                <textarea
                  disabled={!canEdit}
                  onChange={(event) => {
                    const value = parseObject(event.target.value);
                    if (value) updateTest(index, { expected: value });
                  }}
                  rows={6}
                  defaultValue={test.expectedText}
                />
              </label>
            </div>
            <p className="muted">
              Record the exact provenance for this saved case. A clinical source-worked example
              still needs a precise locator and source-provided or fetch-verified evidence;
              recording metadata does not approve it.
            </p>
            <div className="admin-two-column">
              <label className="admin-field">
                <span>Test source type</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateTestSource(index, {
                      type: (event.target.value || undefined) as TestSourceType | undefined,
                    })
                  }
                  value={test.source?.type ?? ''}
                >
                  <option value="">Not recorded</option>
                  <option value="niro">Niro source</option>
                  <option value="external">External source</option>
                  <option value="internal">Internal source</option>
                  <option value="needs-clarification">Needs clarification</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Test source locator / reference</span>
                <input
                  disabled={!canEdit}
                  maxLength={1000}
                  onChange={(event) =>
                    updateTestSource(index, { ref: event.target.value || undefined })
                  }
                  placeholder="Source file, version, sheet/section, and exact range"
                  value={test.source?.ref ?? ''}
                />
              </label>
              <label className="admin-field">
                <span>Test source verification</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateTestSource(index, {
                      verification: (event.target.value || undefined) as
                        TestSourceVerification | undefined,
                    })
                  }
                  value={test.source?.verification ?? ''}
                >
                  <option value="">Not recorded</option>
                  <option value="source-provided">Source provided</option>
                  <option value="fetch-verified">Fetch verified</option>
                  <option value="search-verified">Search verified</option>
                  <option value="blocked-cited">Blocked, citation retained</option>
                  <option value="needs-verification">Needs verification</option>
                </select>
              </label>
            </div>
            {canEdit ? (
              <button
                className="admin-danger-button"
                onClick={() =>
                  setTests((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                type="button"
              >
                Remove case
              </button>
            ) : null}
          </fieldset>
        ))}
        <div className="admin-button-row">
          <button
            className="admin-secondary-button"
            disabled={!canEdit || Boolean(busy)}
            onClick={() =>
              void run('Save tests', async () => {
                const currentEtag = await ensureSaved();
                if (!tests.length || tests.some((test) => Object.keys(test.expected).length === 0))
                  throw new Error(
                    'Every saved test needs at least one reviewed expected assertion.',
                  );
                const response = await saveVersionTestCases(
                  version.calculatorSlug,
                  version.version,
                  tests,
                  currentEtag,
                );
                onVersion(response.data.version, response.etag);
                setMessage('Test cases saved.');
              })
            }
            type="button"
          >
            Save tests
          </button>
          <button
            className="admin-primary-button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Run tests', async () => {
                await ensureSaved();
                const response = await runVersionTestCases(version.calculatorSlug, version.version);
                setTestRun(response.data);
                setMessage(
                  response.data.passed
                    ? 'All saved tests passed.'
                    : 'One or more saved tests failed.',
                );
              })
            }
            type="button"
          >
            Run all
          </button>
        </div>
        {testRun ? (
          <pre
            aria-label="Test run result JSON"
            className="admin-json-output"
            role="region"
            tabIndex={0}
          >
            {JSON.stringify(testRun, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="admin-panel" aria-labelledby="lifecycle-heading">
        <p className="eyebrow">Four-layer gate</p>
        <h2 id="lifecycle-heading">Validate, review, and publish</h2>
        <div className="admin-button-row">
          <button
            className="admin-secondary-button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Validate', async () => {
                await ensureSaved();
                const response = await validateVersion(version.calculatorSlug, version.version);
                onValidation(response.data);
                setMessage(
                  response.data.publishEligible
                    ? 'All publication gates pass.'
                    : 'Validation completed with blockers.',
                );
              })
            }
            type="button"
          >
            Validate
          </button>
          <button
            className="admin-secondary-button"
            disabled={!canEdit || Boolean(busy)}
            onClick={() =>
              void run('Submit review', async () => {
                const currentEtag = await ensureSaved();
                const response = await submitReview(
                  version.calculatorSlug,
                  version.version,
                  currentEtag,
                );
                onVersion(response.data, response.etag);
                setMessage('Draft submitted for independent review.');
                await reloadHistory();
              })
            }
            type="button"
          >
            Submit review
          </button>
          <button
            className="admin-secondary-button"
            disabled={!canReview || version.status !== 'in-review' || Boolean(busy)}
            onClick={() =>
              void run('Approve', async () => {
                const response = await approveVersion(
                  version.calculatorSlug,
                  version.version,
                  etag,
                );
                onVersion(response.data, response.etag);
                setMessage('Authenticated review evidence recorded.');
                await reloadHistory();
              })
            }
            type="button"
          >
            Approve review
          </button>
        </div>
        <label className="admin-field">
          <span>Publication changelog</span>
          <textarea
            onChange={(event) => setChangelog(event.target.value)}
            rows={3}
            value={changelog}
          />
        </label>
        <button
          className="admin-primary-button"
          disabled={
            !canPublish || version.status !== 'approved' || !changelog.trim() || Boolean(busy)
          }
          onClick={() =>
            void run('Publish', async () => {
              const response = await publishVersion(
                version.calculatorSlug,
                version.version,
                etag,
                changelog,
              );
              onVersion(response.data, response.etag);
              setMessage('Version published transactionally.');
              await reloadHistory();
            })
          }
          type="button"
        >
          Publish immutable version
        </button>
      </section>

      <section className="admin-panel" aria-labelledby="history-heading">
        <p className="eyebrow">Immutable lineage</p>
        <h2 id="history-heading">Version history and rollback</h2>
        <div className="admin-history-list">
          {history.map((item) => (
            <article key={item.id}>
              <div>
                <strong>Version {item.version}</strong>{' '}
                <span className={`admin-status admin-status--${item.status}`}>{item.status}</span>
                <p className="muted">
                  Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'unknown'}
                </p>
              </div>
              <div className="admin-button-row">
                <button
                  className="admin-secondary-button"
                  onClick={() =>
                    router.push(
                      `/admin/calculators/${encodeURIComponent(item.calculatorSlug)}/versions/${item.version}`,
                    )
                  }
                  type="button"
                >
                  Open
                </button>
                {['published', 'retired'].includes(item.status) && role === 'admin' ? (
                  <button
                    className="admin-secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run('Rollback', async () => {
                        const response = await rollbackVersion(
                          item.calculatorSlug,
                          item.version,
                          false,
                        );
                        router.push(
                          `/admin/calculators/${encodeURIComponent(item.calculatorSlug)}/versions/${response.data.version.version}`,
                        );
                      })
                    }
                    type="button"
                  >
                    Rollback as new draft
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {canEdit ? (
          <button
            className="admin-secondary-button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('Create version', async () => {
                await ensureSaved();
                const response = await createCalculatorVersion(version.calculatorSlug, {
                  sourceVersion: version.version,
                });
                router.push(
                  `/admin/calculators/${encodeURIComponent(version.calculatorSlug)}/versions/${response.data.version}`,
                );
              })
            }
            type="button"
          >
            Create edit-by-copy version
          </button>
        ) : null}
      </section>
    </div>
  );
}
