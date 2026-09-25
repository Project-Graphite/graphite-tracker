import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { ResendVerification } from '../components/ResendVerification';

export function RegisterPage() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    try {
      await auth.register({
        email,
        handle: String(form.get('handle')),
        displayName: String(form.get('displayName')),
        password: String(form.get('password')),
      });
      setCreatedEmail(email);
    } catch (reason) {
      setError(errorMessage(reason, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }

  if (createdEmail) {
    return (
      <section className="form-panel page-enter">
        <p className="eyebrow">Account created</p>
        <h1 className="page-title">Check your inbox</h1>
        <p className="mt-5 text-muted">
          We sent a verification link to {createdEmail}. Open it within 24 hours to finish setting
          up your account.
        </p>
        <ResendVerification email={createdEmail} />
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
