'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { AdminApiError } from '../api';
import { useAdminSession } from './AdminSessionProvider';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(email, password);
      router.replace('/admin');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : 'Login could not be completed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login-card" onSubmit={submit}>
      <p className="eyebrow">Calculator Studio</p>
      <h1>Admin sign in</h1>
      <p className="muted">
        Only authorized Niro administrators, editors, and reviewers can continue.
      </p>
      {error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {error}
        </p>
      ) : null}
      <label className="admin-field">
        <span>Email</span>
        <input
          autoComplete="username"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="admin-field">
        <span>Password</span>
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <button className="admin-primary-button" disabled={busy} type="submit">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
