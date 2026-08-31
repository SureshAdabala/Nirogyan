'use client';

import React, { useId, useState, type FormEvent } from 'react';

import type { LeadCaptureOptions } from './types';

export function LeadCapture({ options }: { readonly options: LeadCaptureOptions }) {
  const headingId = useId();
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>();

  if (!options.enabled) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setState('error');
      setError('Enter a valid email address.');
      return;
    }
    if (!consented) {
      setState('error');
      setError('Consent is required before submitting your email.');
      return;
    }
    setState('submitting');
    try {
      await options.onSubmit({ email: normalizedEmail, consentVersion: options.consentVersion });
      setState('success');
    } catch {
      setState('error');
      setError('We could not save your email. Your result is still available above.');
    }
  }

  return (
    <aside className="result-lead-capture" aria-labelledby={headingId}>
      <h2 id={headingId}>{options.heading ?? 'Get future health education updates'}</h2>
      {state === 'success' ? (
        <p role="status">Thanks. Your email preference was saved.</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p>Your result does not depend on providing an email address.</p>
          <label htmlFor={emailId}>Email address</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            disabled={state === 'submitting'}
            aria-invalid={error?.startsWith('Enter') ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="consent-control">
            <input
              type="checkbox"
              checked={consented}
              disabled={state === 'submitting'}
              onChange={(event) => setConsented(event.target.checked)}
            />
            <span>{options.consentText}</span>
          </label>
          {error && (
            <p id={errorId} role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Submitting…' : 'Submit email'}
          </button>
        </form>
      )}
    </aside>
  );
}
