'use client';

import type { AdminCalculatorSummary } from '@niro/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminApiError, calculatorVersions, calculators, createCalculator } from '../api';
import { useAdminSession } from '../auth/AdminSessionProvider';
import { createEmptyDraft, measurementIdsFromPayload } from './draft-template';

type JsonRecord = Record<string, unknown>;

function validSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function AdminHome() {
  const router = useRouter();
  const { admin, logout } = useAdminSession();
  const [items, setItems] = useState<readonly AdminCalculatorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [importText, setImportText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await calculators());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Calculators could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void calculators()
      .then((records) => {
        if (active) setItems(records);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Calculators could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function open(summary: AdminCalculatorSummary) {
    setError(undefined);
    try {
      const versions = await calculatorVersions(summary.slug);
      const target = versions.find((version) => version.status === 'draft') ?? versions[0];
      if (!target) throw new Error('This calculator has no version to open.');
      router.push(
        `/admin/calculators/${encodeURIComponent(summary.slug)}/versions/${target.version}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The calculator could not be opened.');
    }
  }

  async function create() {
    setError(undefined);
    const normalizedSlug = slug.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!validSlug(normalizedSlug) || !normalizedName) {
      setError('Enter a lowercase hyphenated slug and a calculator name.');
      return;
    }
    let payload: JsonRecord;
    try {
      payload = importText.trim()
        ? (JSON.parse(importText) as JsonRecord)
        : createEmptyDraft(normalizedSlug, normalizedName);
    } catch {
      setError('The imported configuration is not valid JSON.');
      return;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      setError('The imported configuration must be a JSON object.');
      return;
    }
    setCreating(true);
    try {
      const result = await createCalculator({
        slug: normalizedSlug,
        name: normalizedName,
        payload,
        measurementRevisionIds: measurementIdsFromPayload(payload),
      });
      router.push(
        `/admin/calculators/${encodeURIComponent(normalizedSlug)}/versions/${result.data.version.version}`,
      );
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : 'The calculator draft could not be created.',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="admin-shell" id="main-content">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">Niro configuration workspace</p>
          <h1>Calculator Studio</h1>
        </div>
        <div className="admin-session-summary">
          <Link className="admin-secondary-button" href="/admin/analytics">
            Analytics dashboard
          </Link>
          <span>{admin?.email}</span>
          <span className="admin-role-chip">{admin?.role}</span>
          <button className="admin-secondary-button" onClick={() => void logout()} type="button">
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-create-panel" aria-labelledby="create-calculator-heading">
        <div>
          <p className="eyebrow">Draft only</p>
          <h2 id="create-calculator-heading">Create or import a calculator</h2>
          <p className="muted">
            Imports preserve the supplied clinical configuration. They are never approved or
            published automatically.
          </p>
        </div>
        <div className="admin-create-grid">
          <label className="admin-field">
            <span>Slug</span>
            <input
              onChange={(event) => setSlug(event.target.value)}
              placeholder="example-risk"
              value={slug}
            />
          </label>
          <label className="admin-field">
            <span>Name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Example risk calculator"
              value={name}
            />
          </label>
        </div>
        <label className="admin-field">
          <span>Optional draft configuration JSON</span>
          <textarea
            onChange={(event) => setImportText(event.target.value)}
            placeholder="Paste a complete calculator-version.v1 draft. Leave blank for an empty authoring draft."
            rows={7}
            value={importText}
          />
        </label>
        <button
          className="admin-primary-button"
          disabled={creating}
          onClick={() => void create()}
          type="button"
        >
          {creating ? 'Creating draft…' : 'Create draft'}
        </button>
      </section>

      <section aria-labelledby="calculator-list-heading">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Versioned configurations</p>
            <h2 id="calculator-list-heading">Calculators</h2>
          </div>
          <button
            className="admin-secondary-button"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            Refresh
          </button>
        </div>
        {loading ? <p>Loading calculators…</p> : null}
        {!loading && items.length === 0 ? (
          <div className="admin-empty-state">No calculator identities exist yet.</div>
        ) : null}
        <div className="admin-calculator-grid">
          {items.map((item) => (
            <article className="admin-calculator-card" key={item.id}>
              <div>
                <span className={`admin-status admin-status--${item.status}`}>{item.status}</span>
                <h3>{item.name}</h3>
                <p className="muted">{item.slug}</p>
              </div>
              <button
                className="admin-secondary-button"
                onClick={() => void open(item)}
                type="button"
              >
                Open workspace
              </button>
            </article>
          ))}
        </div>
      </section>
      <footer className="admin-footer">
        <Link href="/">Return to public site</Link>
      </footer>
    </main>
  );
}
