import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export function RegisterPage() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await auth.register({
        email: String(form.get('email')),
        handle: String(form.get('handle')),
        displayName: String(form.get('displayName')),
        password: String(form.get('password')),
      });
      setToken(result.verificationToken ?? '');
      setCreated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <section className="form-panel page-enter">
        <p className="eyebrow">Account created</p>
        <h1 className="page-title">Verify your email</h1>
        <p className="mt-5 text-muted">
          Email delivery is not connected in this phase. Local development exposes a one-time token
          so the verification flow can be completed.
        </p>
        {token ? (
          <Link className="primary-button mt-6 inline-flex" to={`/verify?token=${token}`}>
            Verify local account
          </Link>
        ) : (
          <p className="mt-6 text-muted">Use the verification link sent by the configured service.</p>
        )}
      </section>
    );
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">Start a library</p>
      <h1 className="page-title">Create your account</h1>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <label className="field-label">
          Display name
          <input autoComplete="name" maxLength={80} name="displayName" required />
        </label>
        <label className="field-label">
          Handle
          <input autoCapitalize="none" maxLength={32} minLength={3} name="handle" required />
        </label>
        <label className="field-label">
          Email
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label className="field-label">
          Password
          <input autoComplete="new-password" minLength={12} name="password" required type="password" />
        </label>
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already registered? <Link className="rule-link" to="/login">Sign in</Link>
      </p>
    </section>
  );
}
