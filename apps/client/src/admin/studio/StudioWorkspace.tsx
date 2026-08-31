'use client';

import type {
  AdminCalculatorVersion,
  AdminValidationSummary,
  ValidationFinding,
} from '@niro/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

void React;

import {
  CategoryEditor,
  DomainEditor,
  LayoutContentEditor,
  ParameterEditor,
  ScoringEditor,
} from '../editors';
import {
  jsonRecord,
  jsonRecordArray,
  replaceArrayItem,
  setJsonField,
  type JsonRecord,
} from '../editor-helpers';
import type { AdminMeasurementRecord } from '../api';
import { useAdminSession } from '../auth/AdminSessionProvider';
import { PreviewReleasePanel } from './PreviewReleasePanel';
import { allValidationFindings, tabForFinding, type StudioTab } from './validation-navigation';
import { useStudioDraft } from './use-studio-draft';

const TABS: readonly { readonly id: StudioTab; readonly label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'scoring', label: 'Scoring & rules' },
  { id: 'domains', label: 'Domains & formulas' },
  { id: 'categories', label: 'Categories' },
  { id: 'content', label: 'Layout, content & SEO' },
  { id: 'release', label: 'Preview, tests & publish' },
];

interface Props {
  readonly initialVersion: AdminCalculatorVersion;
  readonly initialEtag: string;
  readonly initialHistory: readonly AdminCalculatorVersion[];
  readonly measurements: readonly AdminMeasurementRecord[];
  readonly reloadHistory: () => Promise<void>;
}

function syncMeasurementBindings(
  draft: JsonRecord,
  measurements: readonly AdminMeasurementRecord[],
): JsonRecord {
  const parameters = jsonRecordArray(draft.parameters);
  const governance = jsonRecord(draft.governance);
  const existingIds = Array.isArray(governance.measurementRevisionIds)
    ? governance.measurementRevisionIds.filter((item): item is string => typeof item === 'string')
    : [];
  const byId = new Map(measurements.map((measurement) => [measurement.id, measurement]));
  const ids: string[] = [];
  for (const parameter of parameters) {
    if (typeof parameter.biomarkerKey !== 'string') continue;
    const existing = existingIds.find((id) => byId.get(id)?.key === parameter.biomarkerKey);
    const selected =
      existing ??
      measurements.find((measurement) => measurement.key === parameter.biomarkerKey)?.id;
    if (selected && !ids.includes(selected)) ids.push(selected);
  }
  return setJsonField(draft, 'governance', {
    ...governance,
    measurementRevisionIds: ids,
  });
}

export function DetailsEditor({
  draft,
  onChange,
  disabled,
}: Readonly<{ draft: JsonRecord; onChange: (draft: JsonRecord) => void; disabled?: boolean }>) {
  const sourceStatus = jsonRecord(draft.NIRO_SOURCE_STATUS);
  const disclaimers = Array.isArray(draft.disclaimers)
    ? draft.disclaimers.filter((item): item is string => typeof item === 'string')
    : [];

  function setSourceStatus(key: string, value: unknown) {
    onChange(setJsonField(draft, 'NIRO_SOURCE_STATUS', setJsonField(sourceStatus, key, value)));
  }

  return (
    <section className="studio-editor" aria-labelledby="studio-details-heading">
      <h2 id="studio-details-heading">Basic details and source status</h2>
      <div className="admin-two-column">
        <label className="admin-field">
          <span>Calculator name</span>
          <input
            disabled={disabled}
            onChange={(event) => onChange(setJsonField(draft, 'name', event.target.value))}
            value={typeof draft.name === 'string' ? draft.name : ''}
          />
        </label>
        <label className="admin-field">
          <span>Immutable slug</span>
          <input
            disabled
            value={typeof draft.calculatorSlug === 'string' ? draft.calculatorSlug : ''}
          />
        </label>
      </div>
      <label className="admin-field">
        <span>Short description</span>
        <textarea
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(draft, 'shortDescription', event.target.value))
          }
          rows={3}
          value={typeof draft.shortDescription === 'string' ? draft.shortDescription : ''}
        />
      </label>
      <label className="admin-field">
        <span>Engine semantic version</span>
        <input
          disabled={disabled}
          onChange={(event) =>
            onChange(setJsonField(draft, 'engineSemanticVersion', event.target.value || undefined))
          }
          placeholder="1.0.0"
          value={typeof draft.engineSemanticVersion === 'string' ? draft.engineSemanticVersion : ''}
        />
      </label>
      <label className="admin-field">
        <span>Educational disclaimers — one per line</span>
        <textarea
          disabled={disabled}
          onChange={(event) =>
            onChange(
              setJsonField(
                draft,
                'disclaimers',
                event.target.value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean),
              ),
            )
          }
          rows={5}
          value={disclaimers.join('\n')}
        />
      </label>
      <fieldset>
        <legend>Niro source and clarification banner</legend>
        <p className="muted">
          These labels disclose unresolved source decisions. They do not resolve or change clinical
          logic.
        </p>
        <label className="admin-field">
          <span>Banner</span>
          <input
            disabled={disabled}
            onChange={(event) => setSourceStatus('banner', event.target.value)}
            value={typeof sourceStatus.banner === 'string' ? sourceStatus.banner : ''}
          />
        </label>
        <label className="admin-field">
          <span>Explanation</span>
          <textarea
            disabled={disabled}
            onChange={(event) => setSourceStatus('explanation', event.target.value)}
            rows={3}
            value={typeof sourceStatus.explanation === 'string' ? sourceStatus.explanation : ''}
          />
        </label>
        <label className="admin-field">
          <span>Governance caveat</span>
          <textarea
            disabled={disabled}
            onChange={(event) =>
              setSourceStatus('governanceCaveat', event.target.value || undefined)
            }
            rows={3}
            value={
              typeof sourceStatus.governanceCaveat === 'string' ? sourceStatus.governanceCaveat : ''
            }
          />
        </label>
        <label className="admin-field">
          <span>Open clarifications — one per line</span>
          <textarea
            disabled={disabled}
            onChange={(event) =>
              setSourceStatus(
                'remainingClarifications',
                event.target.value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
            rows={6}
            value={
              Array.isArray(sourceStatus.remainingClarifications)
                ? sourceStatus.remainingClarifications
                    .filter((item): item is string => typeof item === 'string')
                    .join('\n')
                : ''
            }
          />
        </label>
      </fieldset>
    </section>
  );
}

function ValidationSidebar({
  validation,
  onFinding,
}: Readonly<{
  validation?: AdminValidationSummary;
  onFinding: (finding: ValidationFinding) => void;
}>) {
  const findings = allValidationFindings(validation);
  return (
    <aside className="admin-validation-sidebar" aria-labelledby="validation-sidebar-heading">
      <p className="eyebrow">Authoritative server validator</p>
      <h2 id="validation-sidebar-heading">Validation</h2>
      {!validation ? (
        <p className="muted">
          Run validation from the release tab to see structural, semantic, clinical, and publication
          findings.
        </p>
      ) : null}
      {validation ? (
        <div className="admin-metric-grid">
          <div>
            <span>Errors</span>
            <strong>{validation.errorCount}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{validation.warningCount}</strong>
          </div>
        </div>
      ) : null}
      {validation?.publishEligible ? (
        <p className="admin-alert admin-alert--success">
          All computed publication gates pass. Independent authenticated review is still enforced by
          the lifecycle API.
        </p>
      ) : null}
      <ul className="admin-validation-list">
        {findings.map((finding, index) => (
          <li key={`${finding.layer}-${finding.id}-${finding.jsonPath}-${index}`}>
            <button onClick={() => onFinding(finding)} type="button">
              <small>
                {finding.layer} · {finding.id} · {finding.jsonPath}
              </small>
              {finding.message}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function StudioWorkspace({
  initialVersion,
  initialEtag,
  initialHistory,
  measurements,
  reloadHistory,
}: Props) {
  const router = useRouter();
  const { admin, logout } = useAdminSession();
  const [tab, setTab] = useState<StudioTab>('details');
  const [validation, setValidation] = useState<AdminValidationSummary>();
  const [selectedParameter, setSelectedParameter] = useState<number>();
  const studio = useStudioDraft(initialVersion, initialEtag);
  const parameters = jsonRecordArray(studio.draft.parameters);
  const readonly = studio.version.status !== 'draft' || studio.saveState === 'conflict';
  const parameterKeys = parameters.flatMap((parameter) =>
    typeof parameter.key === 'string' ? [parameter.key] : [],
  );
  const aggregateKeys = jsonRecordArray(studio.draft.parameterGroupsAggregation).flatMap((item) =>
    typeof item.key === 'string' ? [item.key] : [],
  );
  const formulaKeys = jsonRecordArray(studio.draft.formulas).flatMap((item) =>
    typeof item.key === 'string' ? [item.key] : [],
  );
  const measurementRecords = useMemo(
    () => measurements.map((item) => ({ ...item }) as JsonRecord),
    [measurements],
  );

  function changeDraft(next: JsonRecord) {
    studio.setDraft(syncMeasurementBindings(next, measurements));
  }

  function changeParameter(index: number, parameter: JsonRecord) {
    changeDraft(
      setJsonField(studio.draft, 'parameters', replaceArrayItem(parameters, index, parameter)),
    );
  }

  function jumpToFinding(finding: ValidationFinding) {
    const targetTab = tabForFinding(finding);
    setTab(targetTab);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-studio-tab="${targetTab}"]`)?.focus();
    });
  }

  return (
    <main className="admin-shell" id="main-content">
      <header className="admin-workspace-header">
        <div>
          <Link href="/admin">← All calculators</Link>
          <p className="eyebrow">
            {studio.version.calculatorSlug} · version {studio.version.version}
          </p>
          <h1>
            {typeof studio.draft.name === 'string'
              ? studio.draft.name
              : studio.version.calculatorSlug}
          </h1>
        </div>
        <div className="admin-session-summary">
          <span className={`admin-status admin-status--${studio.version.status}`}>
            {studio.version.status}
          </span>
          <span className={`admin-save-state admin-save-state--${studio.saveState}`}>
            {studio.saveState}
          </span>
          <span className="admin-role-chip">{admin?.role}</span>
          <button
            className="admin-secondary-button"
            onClick={() => void logout().then(() => router.replace('/admin/login'))}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      {studio.saveError ? (
        <div className="admin-alert admin-alert--error" role="alert">
          {studio.saveError}{' '}
          {studio.saveState === 'conflict' ? (
            <button
              className="admin-secondary-button"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload server version
            </button>
          ) : (
            <button
              className="admin-secondary-button"
              onClick={() => void studio.flush()}
              type="button"
            >
              Retry save
            </button>
          )}
        </div>
      ) : null}
      {readonly ? (
        <p className="admin-alert admin-alert--warning">
          This version is read-only. Create an edit-by-copy version to make changes.
        </p>
      ) : null}

      <nav className="admin-tabs" aria-label="Calculator Studio steps" role="tablist">
        {TABS.map((item) => (
          <button
            aria-controls={`studio-panel-${item.id}`}
            aria-selected={tab === item.id}
            className="admin-tab"
            data-studio-tab={item.id}
            id={`studio-tab-${item.id}`}
            key={item.id}
            onClick={() => setTab(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="admin-workspace-layout">
        <section
          className="admin-workspace-main"
          id={`studio-panel-${tab}`}
          aria-labelledby={`studio-tab-${tab}`}
          role="tabpanel"
        >
          {tab === 'details' ? (
            <DetailsEditor disabled={readonly} draft={studio.draft} onChange={changeDraft} />
          ) : null}
          {tab === 'parameters' ? (
            <section className="studio-editor" aria-labelledby="parameters-heading">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">Central measurement binding</p>
                  <h2 id="parameters-heading">Parameters</h2>
                </div>
                <button
                  className="admin-secondary-button"
                  disabled={readonly}
                  onClick={() => {
                    const next = {
                      key: `parameter-${parameters.length + 1}`,
                      label: 'New parameter',
                      group: 'general',
                      inputType: 'number',
                      order: parameters.length + 1,
                    };
                    changeDraft(setJsonField(studio.draft, 'parameters', [...parameters, next]));
                    setSelectedParameter(parameters.length);
                  }}
                  type="button"
                >
                  Add parameter
                </button>
              </div>
              <div className="admin-history-list">
                {parameters.map((parameter, index) => (
                  <article key={`${String(parameter.key)}-${index}`}>
                    <div>
                      <strong>
                        {typeof parameter.label === 'string'
                          ? parameter.label
                          : `Parameter ${index + 1}`}
                      </strong>
                      <p className="muted">
                        {String(parameter.key ?? 'missing-key')} ·{' '}
                        {String(parameter.inputType ?? 'missing type')}
                      </p>
                    </div>
                    <div className="admin-button-row">
                      <button
                        className="admin-secondary-button"
                        onClick={() => setSelectedParameter(index)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="admin-danger-button"
                        disabled={readonly}
                        onClick={() => {
                          changeDraft(
                            setJsonField(
                              studio.draft,
                              'parameters',
                              parameters.filter((_, itemIndex) => itemIndex !== index),
                            ),
                          );
                          setSelectedParameter(undefined);
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {selectedParameter !== undefined && parameters[selectedParameter] ? (
                <ParameterEditor
                  aggregateKeys={aggregateKeys}
                  biomarkers={measurementRecords}
                  disabled={readonly}
                  formulaKeys={formulaKeys}
                  onChange={(parameter) => changeParameter(selectedParameter, parameter)}
                  onClose={() => setSelectedParameter(undefined)}
                  parameter={parameters[selectedParameter]}
                  parameterKeys={parameterKeys}
                />
              ) : null}
            </section>
          ) : null}
          {tab === 'scoring' ? (
            <ScoringEditor disabled={readonly} draft={studio.draft} onChange={changeDraft} />
          ) : null}
          {tab === 'domains' ? (
            <DomainEditor disabled={readonly} draft={studio.draft} onChange={changeDraft} />
          ) : null}
          {tab === 'categories' ? (
            <CategoryEditor disabled={readonly} draft={studio.draft} onChange={changeDraft} />
          ) : null}
          {tab === 'content' ? (
            <LayoutContentEditor disabled={readonly} draft={studio.draft} onChange={changeDraft} />
          ) : null}
          {tab === 'release' && admin ? (
            <PreviewReleasePanel
              draft={studio.draft}
              etag={studio.etag}
              flush={studio.flush}
              history={initialHistory}
              onValidation={setValidation}
              onVersion={studio.acceptServerVersion}
              reloadHistory={reloadHistory}
              role={admin.role}
              version={studio.version}
            />
          ) : null}
        </section>
        <ValidationSidebar onFinding={jumpToFinding} validation={validation} />
      </div>
    </main>
  );
}
