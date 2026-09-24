import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { importApps, importStateLabels, type ImportDetail, type ImportSummary } from '../imports';
import { useResource } from '../useResource';

export function ImportPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const history = useResource<ImportSummary[]>('/imports', true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const batch = await auth.request<ImportDetail>('/imports', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      navigate(`/import/${batch.id}`);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not upload the backup'));
      setBusy(false);
    }
  }

  return (
    <div className="page-enter">
      <Link className="rule-link mono-sm" to="/library">
        Back to library
      </Link>
      <p className="eyebrow mt-8">Library import</p>
      <h1 className="page-title">Import from Mihon or AniYomi</h1>
      <div className="mt-5 grid max-w-3xl gap-3 text-muted">
        <p className="m-0">
          Create a backup in Mihon or AniYomi and upload the <span className="mono-sm text-ink">.tachibk</span> or{' '}
          <span className="mono-sm text-ink">.proto.gz</span> file. Manga and manhwa come from both
          apps; AniYomi backups also bring anime.
        </p>
        <p className="m-0">
          Only titles, reading or watching progress and tracker status are read. Nothing changes in
          your library until you review the matches and apply them. The file itself is discarded as
          soon as it has been read.
        </p>
      </div>
      <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => void upload(event)}>
        <label className="field-label">
          Backup file
          <input accept=".tachibk,.gz,application/gzip" name="file" required type="file" />
        </label>
        <button className="primary-button self-end" disabled={busy} type="submit">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {error && <p className="error-message m-0 sm:col-span-2">{error}</p>}
      </form>
      <section className="mt-14 max-w-3xl">
        <h2 className="m-0 border-b border-line pb-4 text-xl font-medium">Recent imports</h2>
        {history.error ? (
          <p className="error-message mt-5">{history.error}</p>
        ) : !history.data ? (
          <p className="mt-5 text-muted">Loading imports…</p>
        ) : history.data.length === 0 ? (
          <p className="mt-5 text-muted">No imports in the last seven days.</p>
        ) : (
          <ul className="m-0 p-0">
            {history.data.map((batch) => (
              <li className="flex list-none flex-wrap items-baseline justify-between gap-3 border-b border-line-soft py-3" key={batch.id}>
                <Link className="rule-link" to={`/import/${batch.id}`}>
                  {batch.sourceApp ? `${importApps[batch.sourceApp]} backup` : 'Backup'} ·{' '}
                  {new Date(batch.createdAt).toLocaleString()}
                </Link>
                <span className="mono-sm text-faint">{importStateLabels[batch.state]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mono-sm mt-4 text-faint">Import reviews are kept for seven days.</p>
      </section>
    </div>
  );
}
