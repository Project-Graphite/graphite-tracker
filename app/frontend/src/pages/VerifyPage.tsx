import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth';

export function VerifyPage() {
  const auth = useAuth();
  const [parameters] = useSearchParams();
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await auth.verify(String(form.get('token')));
      setVerified(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <section className="form-panel page-enter">
        <p className="eyebrow">Email verified</p>
        <h1 className="page-title">Your account is ready.</h1>
        <Link className="primary-button mt-7 inline-flex" to="/login">Sign in</Link>
      </section>
    );
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">One last step</p>
      <h1 className="page-title">Verify your email</h1>
      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <label className="field-label">
          Verification token
          <input defaultValue={parameters.get('token') ?? ''} name="token" required />
        </label>
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Verifying…' : 'Verify email'}
        </button>
      </form>
    </section>
  );
}
