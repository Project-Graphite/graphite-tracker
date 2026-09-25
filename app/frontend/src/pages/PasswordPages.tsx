import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiRequest, errorMessage } from '../api';

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSentTo(email);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not send the reset link'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">Account help</p>
      <h1 className="page-title">Reset your password</h1>
      {sentTo ? (
        <p className="mt-6 text-muted">
          If an account uses {sentTo}, a reset link is on its way. It works for one hour.
        </p>
      ) : (
        <form className="mt-8 grid gap-5" onSubmit={submit}>
          <label className="field-label">
            Email
            <input autoComplete="email" name="email" required type="email" />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted">
        <Link className="rule-link" to="/login">Back to sign in</Link>
      </p>
    </section>
  );
}

export function ResetPasswordPage() {
  const [parameters] = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: parameters.get('token') ?? '',
          password: String(new FormData(event.currentTarget).get('password')),
        }),
      });
      setDone(true);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not reset the password'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="form-panel page-enter">
        <p className="eyebrow">Password changed</p>
        <h1 className="page-title">Sign in with your new password.</h1>
        <p className="mt-5 text-muted">Every device that was signed in has been signed out.</p>
        <Link className="primary-button mt-7 inline-flex" to="/login">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">Account help</p>
      <h1 className="page-title">Choose a new password</h1>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <label className="field-label">
          New password
          <input autoComplete="new-password" maxLength={128} minLength={12} name="password" required type="password" />
        </label>
        {error && (
          <p className="error-message">
            {error} <Link className="rule-link" to="/forgot-password">Request a new link</Link>
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </section>
  );
}
