import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiRequest, errorMessage } from '../api';
import { categoryLabels, type CatalogCategory } from '../catalog';

type Unsubscribed =
  | { scope: 'all' }
  | { scope: 'category'; category: CatalogCategory }
  | { scope: 'title'; title: string | null };

function outcome(result: Unsubscribed) {
  if (result.scope === 'all') return 'You will not get release emails any more.';
  if (result.scope === 'category') {
    return `You will not get release emails about ${categoryLabels[result.category].toLowerCase()} any more.`;
  }
  return `You will not get release emails about ${result.title ?? 'this title'} any more.`;
}

export function UnsubscribePage() {
  const [parameters] = useSearchParams();
  const [result, setResult] = useState<Unsubscribed>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function unsubscribe() {
    setBusy(true);
    setError('');
    try {
      setResult(
        await apiRequest<Unsubscribed>(
          `/notifications/unsubscribe?token=${encodeURIComponent(parameters.get('token') ?? '')}`,
          { method: 'POST' },
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason, 'Could not unsubscribe'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-panel page-enter">
      <p className="eyebrow">Release emails</p>
      <h1 className="page-title">{result ? 'Unsubscribed' : 'Stop these emails?'}</h1>
      {result ? (
        <p className="mt-5 text-muted">{outcome(result)}</p>
      ) : (
        <>
          <p className="mt-5 text-muted">Confirm to stop the emails this link belongs to.</p>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button mt-6" disabled={busy} onClick={() => void unsubscribe()} type="button">
            {busy ? 'Unsubscribing…' : 'Unsubscribe'}
          </button>
        </>
      )}
      <p className="mt-6 text-sm text-muted">
        Signed in? Manage every email in{' '}
        <Link className="rule-link" to="/settings/notifications">notification settings</Link>.
      </p>
    </section>
  );
}
