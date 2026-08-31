'use client';

import React, { useState } from 'react';

void React;

import {
  jsonArray,
  jsonRecord,
  jsonRecordArray,
  parseJsonEditor,
  parseOptionalNumber,
  removeArrayItem,
  replaceArrayItem,
  setJsonField,
  type JsonRecord,
} from '../editor-helpers';

const RESULT_BLOCKS = [
  'score-gauge',
  'category',
  'key-contributors',
  'domain-breakdown',
  'biomarker-details',
  'recommendations',
] as const;

function recordGuard(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function moveItem<T>(values: readonly T[], index: number, offset: -1 | 1): readonly T[] {
  const target = index + offset;
  if (index < 0 || index >= values.length || target < 0 || target >= values.length) return values;
  const next = [...values];
  const item = next[index];
  if (item === undefined) return values;
  next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export interface JsonAreaEditorProps {
  readonly label: string;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly disabled?: boolean;
  readonly expect?: 'array' | 'object' | 'any';
}

export function JsonAreaEditor({
  label,
  value,
  onChange,
  disabled,
  expect = 'any',
}: Readonly<JsonAreaEditorProps>) {
  const serialized = JSON.stringify(value ?? (expect === 'array' ? [] : {}), null, 2);
  return (
    <JsonAreaEditorInput
      key={serialized}
      label={label}
      initialText={serialized}
      onChange={onChange}
      disabled={disabled}
      expect={expect}
    />
  );
}

function JsonAreaEditorInput({
  label,
  initialText,
  onChange,
  disabled,
  expect,
}: Readonly<{
  label: string;
  initialText: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  expect: 'array' | 'object' | 'any';
}>) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string>();

  function commit() {
    const parsed = parseJsonEditor(text);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (expect === 'array' && !Array.isArray(parsed.value)) {
      setError('This field must contain a JSON array.');
      return;
    }
    if (expect === 'object' && !recordGuard(parsed.value)) {
      setError('This field must contain a JSON object.');
      return;
    }
    setError(undefined);
    onChange(parsed.value);
  }

  return (
    <label className="studio-json-editor">
      {label}
      <textarea
        value={text}
        disabled={disabled}
        rows={8}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={commit}
      />
      {error ? <span role="alert">JSON was not saved: {error}</span> : null}
    </label>
  );
}

export interface LayoutContentEditorProps {
  readonly draft: JsonRecord;
  readonly onChange: (draft: JsonRecord) => void;
  readonly disabled?: boolean;
}

export function LayoutContentEditor({
  draft,
  onChange,
  disabled,
}: Readonly<LayoutContentEditorProps>) {
  const uiConfig = jsonRecord(draft.uiConfig);
  const theme = jsonRecord(uiConfig.theme);
  const steps = jsonRecordArray(uiConfig.steps);
  const result = jsonRecord(uiConfig.result);
  const resultLayout = jsonArray(result.layout).filter(
    (item): item is string => typeof item === 'string',
  );
  const content = jsonRecord(draft.content);
  const seo = jsonRecord(content.seo);
  const robots = jsonRecord(seo.robots);
  const authorship = jsonRecord(content.authorship);
  const medicalReview = jsonRecord(content.medicalReview);
  const publication = jsonRecord(content.publication);
  const claims = jsonRecordArray(content.claims);
  const citations = jsonRecordArray(content.citations);
  const governance = jsonRecord(draft.governance);

  function setUi(next: JsonRecord) {
    onChange(setJsonField(draft, 'uiConfig', next));
  }

  function setSteps(next: readonly JsonRecord[]) {
    setUi(setJsonField(uiConfig, 'steps', next));
  }

  function changeStep(index: number, next: JsonRecord) {
    setSteps(replaceArrayItem(steps, index, next).filter(recordGuard));
  }

  function setContent(next: JsonRecord) {
    onChange(setJsonField(draft, 'content', next));
  }

  function setContentField(key: string, value: unknown) {
    setContent(setJsonField(content, key, value));
  }

  function setSeoField(key: string, value: unknown) {
    setContentField('seo', setJsonField(seo, key, value));
  }

  function changeClaim(index: number, next: JsonRecord) {
    setContentField('claims', replaceArrayItem(claims, index, next).filter(recordGuard));
  }

  function changeCitation(index: number, next: JsonRecord) {
    setContentField('citations', replaceArrayItem(citations, index, next).filter(recordGuard));
  }

  return (
    <section className="studio-layout-content-editor" aria-labelledby="studio-layout-content-title">
      <h3 id="studio-layout-content-title">UI layout, content, SEO and governance</h3>

      <fieldset>
        <legend>Form and result layout</legend>
        <label>
          Theme accent
          <input
            value={typeof theme.accent === 'string' ? theme.accent : ''}
            disabled={disabled}
            onChange={(event) =>
              setUi(
                setJsonField(
                  uiConfig,
                  'theme',
                  setJsonField(theme, 'accent', event.currentTarget.value || undefined),
                ),
              )
            }
          />
        </label>
        {steps.map((step, index) => (
          <fieldset key={`${String(step.key ?? 'step')}-${index}`}>
            <legend>Form step {index + 1}</legend>
            <label>
              Step key
              <input
                value={typeof step.key === 'string' ? step.key : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeStep(index, setJsonField(step, 'key', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Step title
              <input
                value={typeof step.title === 'string' ? step.title : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeStep(index, setJsonField(step, 'title', event.currentTarget.value))
                }
              />
            </label>
            <label>
              Parameter groups (comma separated)
              <input
                value={jsonArray(step.parameterGroups).join(', ')}
                disabled={disabled}
                onChange={(event) =>
                  changeStep(
                    index,
                    setJsonField(
                      step,
                      'parameterGroups',
                      event.currentTarget.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              disabled={disabled || index === 0}
              onClick={() => setSteps(moveItem(steps, index, -1))}
            >
              Move step {index + 1} up
            </button>
            <button
              type="button"
              disabled={disabled || index === steps.length - 1}
              onClick={() => setSteps(moveItem(steps, index, 1))}
            >
              Move step {index + 1} down
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSteps(removeArrayItem(steps, index).filter(recordGuard))}
            >
              Remove form step {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSteps([...steps, { key: '', title: '', parameterGroups: [] }])}
        >
          Add form step
        </button>

        <fieldset>
          <legend>Result blocks and order</legend>
          {resultLayout.map((block, index) => (
            <div key={`${block}-${index}`}>
              <span>{block}</span>{' '}
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => {
                  const next = moveItem(resultLayout, index, -1);
                  setUi(setJsonField(uiConfig, 'result', setJsonField(result, 'layout', next)));
                }}
              >
                Move {block} up
              </button>{' '}
              <button
                type="button"
                disabled={disabled || index === resultLayout.length - 1}
                onClick={() => {
                  const next = moveItem(resultLayout, index, 1);
                  setUi(setJsonField(uiConfig, 'result', setJsonField(result, 'layout', next)));
                }}
              >
                Move {block} down
              </button>{' '}
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  setUi(
                    setJsonField(
                      uiConfig,
                      'result',
                      setJsonField(result, 'layout', removeArrayItem(resultLayout, index)),
                    ),
                  )
                }
              >
                Remove {block}
              </button>
            </div>
          ))}
          <label>
            Add result block
            <select
              value=""
              disabled={disabled}
              onChange={(event) => {
                const block = event.currentTarget.value;
                if (!block || resultLayout.includes(block)) return;
                setUi(
                  setJsonField(
                    uiConfig,
                    'result',
                    setJsonField(result, 'layout', [...resultLayout, block]),
                  ),
                );
              }}
            >
              <option value="">Choose a block</option>
              {RESULT_BLOCKS.filter((block) => !resultLayout.includes(block)).map((block) => (
                <option key={block} value={block}>
                  {block}
                </option>
              ))}
            </select>
          </label>
          <label>
            Information hierarchy note
            <textarea
              value={
                typeof result.informationHierarchy === 'string' ? result.informationHierarchy : ''
              }
              disabled={disabled}
              onChange={(event) =>
                setUi(
                  setJsonField(
                    uiConfig,
                    'result',
                    setJsonField(
                      result,
                      'informationHierarchy',
                      event.currentTarget.value || undefined,
                    ),
                  ),
                )
              }
            />
          </label>
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>Associated structured content</legend>
        <label>
          Content schema version
          <input
            value={typeof content.schemaVersion === 'string' ? content.schemaVersion : ''}
            disabled={disabled}
            placeholder="content-page.v1"
            onChange={(event) =>
              setContentField('schemaVersion', event.currentTarget.value || undefined)
            }
          />
        </label>
        {(
          [
            ['contentId', 'Content ID'],
            ['slug', 'Content slug'],
            ['locale', 'Locale'],
            ['title', 'Page title'],
            ['summary', 'Page summary'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            {key === 'summary' ? (
              <textarea
                value={typeof content[key] === 'string' ? content[key] : ''}
                disabled={disabled}
                onChange={(event) => setContentField(key, event.currentTarget.value || undefined)}
              />
            ) : (
              <input
                value={typeof content[key] === 'string' ? content[key] : ''}
                disabled={disabled}
                onChange={(event) => setContentField(key, event.currentTarget.value || undefined)}
              />
            )}
          </label>
        ))}
        <label>
          Content version
          <input
            type="number"
            value={typeof content.version === 'number' ? content.version : ''}
            disabled={disabled}
            onChange={(event) =>
              setContentField('version', parseOptionalNumber(event.currentTarget.value))
            }
          />
        </label>
        <JsonAreaEditor
          label="Content blocks JSON"
          value={content.blocks}
          expect="array"
          disabled={disabled}
          onChange={(value) => setContentField('blocks', value)}
        />
      </fieldset>

      <fieldset>
        <legend>Claims and citations</legend>
        {claims.map((claim, index) => (
          <fieldset key={`${String(claim.id ?? 'claim')}-${index}`}>
            <legend>Claim {index + 1}</legend>
            {(['id', 'text'] as const).map((key) => (
              <label key={key}>
                {key === 'id' ? 'Claim ID' : 'Claim text'}
                <input
                  value={typeof claim[key] === 'string' ? claim[key] : ''}
                  disabled={disabled}
                  onChange={(event) =>
                    changeClaim(index, setJsonField(claim, key, event.currentTarget.value))
                  }
                />
              </label>
            ))}
            <label>
              Claim kind
              <select
                value={typeof claim.kind === 'string' ? claim.kind : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeClaim(index, setJsonField(claim, 'kind', event.currentTarget.value))
                }
              >
                <option value="">Choose kind</option>
                {[
                  'medical-fact',
                  'threshold',
                  'formula',
                  'recommendation',
                  'product-description',
                  'disclaimer',
                  'nonmedical',
                ].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Citation IDs (comma separated)
              <input
                value={jsonArray(claim.citationIds).join(', ')}
                disabled={disabled}
                onChange={(event) =>
                  changeClaim(
                    index,
                    setJsonField(
                      claim,
                      'citationIds',
                      event.currentTarget.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    ),
                  )
                }
              />
            </label>
            <label>
              Claim review status
              <select
                value={typeof claim.reviewStatus === 'string' ? claim.reviewStatus : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeClaim(index, setJsonField(claim, 'reviewStatus', event.currentTarget.value))
                }
              >
                <option value="">Choose status</option>
                {['unreviewed', 'verified', 'disputed', 'expired', 'not-applicable'].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setContentField('claims', removeArrayItem(claims, index).filter(recordGuard))
              }
            >
              Remove claim {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setContentField('claims', [
              ...claims,
              { id: '', text: '', kind: '', citationIds: [], reviewStatus: 'unreviewed' },
            ])
          }
        >
          Add claim
        </button>

        {citations.map((citation, index) => (
          <fieldset key={`${String(citation.id ?? 'citation')}-${index}`}>
            <legend>Citation {index + 1}</legend>
            {(['id', 'title', 'org', 'url', 'localRef'] as const).map((key) => (
              <label key={key}>
                {key}
                <input
                  value={typeof citation[key] === 'string' ? citation[key] : ''}
                  disabled={disabled}
                  onChange={(event) =>
                    changeCitation(
                      index,
                      setJsonField(citation, key, event.currentTarget.value || undefined),
                    )
                  }
                />
              </label>
            ))}
            <label>
              Citation type
              <select
                value={typeof citation.type === 'string' ? citation.type : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeCitation(index, setJsonField(citation, 'type', event.currentTarget.value))
                }
              >
                <option value="">Choose type</option>
                {['niro', 'guideline', 'government', 'journal', 'reference', 'internal'].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Verification status
              <select
                value={
                  typeof citation.verificationStatus === 'string' ? citation.verificationStatus : ''
                }
                disabled={disabled}
                onChange={(event) =>
                  changeCitation(
                    index,
                    setJsonField(citation, 'verificationStatus', event.currentTarget.value),
                  )
                }
              >
                <option value="">Choose status</option>
                {[
                  'fetch-verified',
                  'source-provided',
                  'search-verified',
                  'blocked-cited',
                  'needs-verification',
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              License status
              <select
                value={typeof citation.licenseStatus === 'string' ? citation.licenseStatus : ''}
                disabled={disabled}
                onChange={(event) =>
                  changeCitation(
                    index,
                    setJsonField(citation, 'licenseStatus', event.currentTarget.value),
                  )
                }
              >
                <option value="">Choose status</option>
                {['clear', 'permission-required', 'licensed', 'unknown', 'not-applicable'].map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Citation review expires at (ISO 8601)
              <input
                value={typeof citation.reviewExpiresAt === 'string' ? citation.reviewExpiresAt : ''}
                disabled={disabled}
                placeholder="2027-08-30T00:00:00.000Z"
                onChange={(event) =>
                  changeCitation(
                    index,
                    setJsonField(
                      citation,
                      'reviewExpiresAt',
                      event.currentTarget.value || undefined,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setContentField('citations', removeArrayItem(citations, index).filter(recordGuard))
              }
            >
              Remove citation {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setContentField('citations', [
              ...citations,
              { id: '', type: '', title: '', verificationStatus: '', licenseStatus: '' },
            ])
          }
        >
          Add citation
        </button>
      </fieldset>

      <fieldset>
        <legend>Authorship and medical review metadata</legend>
        <p className="admin-alert admin-alert--warning">
          These fields prepare the protected review snapshot only. Reviewer credential acceptance,
          jurisdiction, independence, and review-cadence policy remain external governance
          decisions; entering metadata here cannot approve a calculator.
        </p>
        {(['ownerId', 'createdAt', 'updatedAt'] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={typeof authorship[key] === 'string' ? authorship[key] : ''}
              disabled={disabled}
              onChange={(event) =>
                setContentField(
                  'authorship',
                  setJsonField(authorship, key, event.currentTarget.value || undefined),
                )
              }
            />
          </label>
        ))}
        <JsonAreaEditor
          label="Authorship contributors JSON"
          value={authorship.contributors}
          expect="array"
          disabled={disabled}
          onChange={(value) =>
            setContentField('authorship', setJsonField(authorship, 'contributors', value))
          }
        />
        <label>
          Medical review status
          <select
            value={typeof medicalReview.status === 'string' ? medicalReview.status : ''}
            disabled={disabled}
            onChange={(event) =>
              setContentField('medicalReview', {
                ...setJsonField(medicalReview, 'status', event.currentTarget.value || undefined),
                ...(event.currentTarget.value === 'not-applicable'
                  ? {
                      reviewerId: null,
                      reviewedAt: null,
                      nextReviewAt: null,
                      decisionNote: null,
                    }
                  : {}),
              })
            }
          >
            <option value="">Choose status</option>
            {[
              'unreviewed',
              'in-review',
              'approved',
              'changes-requested',
              'rejected',
              'expired',
              'not-applicable',
            ].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Medical review scope
          <select
            value={typeof medicalReview.scope === 'string' ? medicalReview.scope : ''}
            disabled={disabled}
            onChange={(event) =>
              setContentField(
                'medicalReview',
                setJsonField(medicalReview, 'scope', event.currentTarget.value || undefined),
              )
            }
          >
            <option value="">Choose scope</option>
            {['content-only', 'clinical-claims', 'full-page', 'not-applicable'].map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
        </label>
        {(['reviewerId', 'reviewedAt', 'nextReviewAt', 'decisionNote'] as const).map((key) => (
          <label key={key}>
            {key}
            {key === 'decisionNote' ? (
              <textarea
                value={typeof medicalReview[key] === 'string' ? medicalReview[key] : ''}
                disabled={disabled}
                onChange={(event) =>
                  setContentField(
                    'medicalReview',
                    setJsonField(medicalReview, key, event.currentTarget.value || null),
                  )
                }
              />
            ) : (
              <input
                value={typeof medicalReview[key] === 'string' ? medicalReview[key] : ''}
                disabled={disabled}
                onChange={(event) =>
                  setContentField(
                    'medicalReview',
                    setJsonField(medicalReview, key, event.currentTarget.value || null),
                  )
                }
              />
            )}
          </label>
        ))}
        <label>
          Approved claim IDs (one per line)
          <textarea
            value={jsonArray(medicalReview.approvedClaimIds).join('\n')}
            disabled={disabled}
            onChange={(event) =>
              setContentField(
                'medicalReview',
                setJsonField(
                  medicalReview,
                  'approvedClaimIds',
                  event.currentTarget.value
                    .split(/\r?\n/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                ),
              )
            }
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>SEO and publication</legend>
        {(['metaTitle', 'metaDescription', 'canonicalPath'] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={typeof seo[key] === 'string' ? seo[key] : ''}
              disabled={disabled}
              onChange={(event) => setSeoField(key, event.currentTarget.value || undefined)}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={robots.index === true}
            disabled={disabled}
            onChange={(event) =>
              setSeoField('robots', setJsonField(robots, 'index', event.currentTarget.checked))
            }
          />
          Allow indexing
        </label>
        <label>
          <input
            type="checkbox"
            checked={robots.follow === true}
            disabled={disabled}
            onChange={(event) =>
              setSeoField('robots', setJsonField(robots, 'follow', event.currentTarget.checked))
            }
          />
          Allow link following
        </label>
        <label>
          Schema types (comma separated)
          <input
            value={jsonArray(seo.schemaTypes).join(', ')}
            disabled={disabled}
            onChange={(event) =>
              setSeoField(
                'schemaTypes',
                event.currentTarget.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <JsonAreaEditor
          label="OpenGraph, keywords and redirects JSON"
          value={{
            openGraph: seo.openGraph,
            keywords: seo.keywords,
            redirectsFrom: seo.redirectsFrom,
          }}
          expect="object"
          disabled={disabled}
          onChange={(value) => {
            const metadata = jsonRecord(value);
            let next = { ...seo };
            for (const key of ['openGraph', 'keywords', 'redirectsFrom'])
              next = setJsonField(next, key, metadata[key]);
            setContentField('seo', next);
          }}
        />
        <label>
          Content publication status
          <select
            value={typeof publication.status === 'string' ? publication.status : ''}
            disabled={disabled}
            onChange={(event) =>
              setContentField('publication', {
                ...setJsonField(publication, 'status', event.currentTarget.value || undefined),
                publishedAt: publication.publishedAt ?? null,
                retiredAt: publication.retiredAt ?? null,
                changelog: typeof publication.changelog === 'string' ? publication.changelog : '',
              })
            }
          >
            <option value="">Choose status</option>
            {['draft', 'in-review', 'approved', 'published', 'retired'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Content changelog
          <textarea
            value={typeof publication.changelog === 'string' ? publication.changelog : ''}
            disabled={disabled}
            onChange={(event) =>
              setContentField(
                'publication',
                setJsonField(publication, 'changelog', event.currentTarget.value),
              )
            }
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Calculator governance</legend>
        <label>
          Clinical status
          <select
            value={typeof governance.clinicalStatus === 'string' ? governance.clinicalStatus : ''}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                setJsonField(
                  draft,
                  'governance',
                  setJsonField(
                    governance,
                    'clinicalStatus',
                    event.currentTarget.value || undefined,
                  ),
                ),
              )
            }
          >
            <option value="">Choose status</option>
            {['unreviewed', 'in-review', 'approved', 'rejected', 'not-applicable'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source review status
          <select
            value={
              typeof governance.sourceReviewStatus === 'string' ? governance.sourceReviewStatus : ''
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                setJsonField(
                  draft,
                  'governance',
                  setJsonField(
                    governance,
                    'sourceReviewStatus',
                    event.currentTarget.value || undefined,
                  ),
                ),
              )
            }
          >
            <option value="">Choose status</option>
            {['unreviewed', 'partial', 'verified', 'expired', 'not-applicable'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source review expires at (ISO 8601)
          <input
            value={
              typeof governance.sourceReviewExpiresAt === 'string'
                ? governance.sourceReviewExpiresAt
                : ''
            }
            disabled={disabled}
            placeholder="2027-08-30T00:00:00.000Z"
            onChange={(event) =>
              onChange(
                setJsonField(
                  draft,
                  'governance',
                  setJsonField(
                    governance,
                    'sourceReviewExpiresAt',
                    event.currentTarget.value || undefined,
                  ),
                ),
              )
            }
          />
        </label>
        {(['discrepancyIds', 'publishBlockers'] as const).map((key) => (
          <label key={key}>
            {key === 'discrepancyIds' ? 'Discrepancy IDs' : 'Publish blockers'} (one per line)
            <textarea
              value={jsonArray(governance[key]).join('\n')}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  setJsonField(
                    draft,
                    'governance',
                    setJsonField(
                      governance,
                      key,
                      event.currentTarget.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    ),
                  ),
                )
              }
            />
          </label>
        ))}
        <JsonAreaEditor
          label="Governance review evidence JSON"
          value={governance.reviews}
          expect="array"
          disabled={disabled}
          onChange={(value) =>
            onChange(setJsonField(draft, 'governance', setJsonField(governance, 'reviews', value)))
          }
        />
      </fieldset>

      <details>
        <summary>Advanced contract fields</summary>
        <p>
          These fields preserve engine primitives that do not yet have a visual editor. Invalid JSON
          is never applied.
        </p>
        {(
          [
            ['parameterGroupsAggregation', 'Parameter-group aggregation'],
            ['imputationRules', 'Imputation rules'],
            ['lookupTables', 'Lookup tables'],
            ['formulas', 'Formulas'],
            ['floorRules', 'Floor rules'],
            ['sources', 'Calculator source manifest'],
          ] as const
        ).map(([key, label]) => (
          <JsonAreaEditor
            key={key}
            label={`${label} JSON`}
            value={draft[key]}
            expect="array"
            disabled={disabled}
            onChange={(value) => onChange(setJsonField(draft, key, value))}
          />
        ))}
        <JsonAreaEditor
          label="Domain aggregation policy JSON"
          value={draft.domainAggregationPolicy}
          expect="object"
          disabled={disabled}
          onChange={(value) => onChange(setJsonField(draft, 'domainAggregationPolicy', value))}
        />
        <JsonAreaEditor
          label="Related content JSON"
          value={content.related}
          expect="object"
          disabled={disabled}
          onChange={(value) => setContentField('related', value)}
        />
      </details>
    </section>
  );
}
