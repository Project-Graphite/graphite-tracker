import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await auth.login(String(form.get('email')), String(form.get('password')));
      navigate('/discover/movies/recent');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">Welcome back</p>
      <h1 className="page-title">Sign in</h1>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <label className="field-label">
          Email
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label className="field-label">
          Password
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        New here? <Link className="rule-link" to="/register">Create an account</Link>
      </p>
    </section>
  );
}
