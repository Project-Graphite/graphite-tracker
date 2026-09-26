import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { ListSkeleton } from '../components/Skeleton';
import { importApps, importStateLabels, type ImportDetail, type ImportSummary } from '../imports';
import { useResource } from '../useResource';

export function ImportPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const history = useResource<ImportSummary[]>('/imports', true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState('');

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = !file
      ? 'Choose a .tachibk or .proto.gz backup first.'
      : !/\.(tachibk|gz)$/i.test(file.name)
        ? 'Choose a .tachibk or .proto.gz file. Other files cannot be read.'
        : file.size > 50 * 1024 * 1024
          ? 'Backups can be up to 50 MB.'
          : '';
    setFileError(problem);
    if (problem) return;
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
      <form
        className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
        noValidate
        onSubmit={(event) => void upload(event)}
      >
        <div className="field-label">
          <span id="backup-label">Backup file</span>
          <label className="file-picker" aria-invalid={fileError ? true : undefined}>
            <input
              accept=".tachibk,.gz,application/gzip"
              aria-describedby={fileError ? 'backup-error' : undefined}
              aria-labelledby="backup-label"
              className="sr-only"
              name="file"
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setFileError('');
              }}
              type="file"
            />
            <span className="secondary-button shrink-0 px-3 py-2 text-sm">Choose file</span>
            <span className={`min-w-0 truncate text-sm ${file ? 'text-ink' : 'text-faint'}`}>
              {file?.name ?? 'No file chosen'}
            </span>
          </label>
          {fileError && (
            <span className="field-error" id="backup-error">
              {fileError}
            </span>
          )}
        </div>
        <button className="primary-button sm:mt-6" disabled={busy} type="submit">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {error && <p className="error-message m-0 sm:col-span-2">{error}</p>}
      </form>
      <section className="mt-14 max-w-3xl">
        <h2 className="m-0 border-b border-line pb-4 text-xl font-medium">Recent imports</h2>
        {history.error ? (
          <p className="error-message mt-5">{history.error}</p>
        ) : !history.data ? (
          <ListSkeleton label="Loading imports" rows={3} />
        ) : history.data.length === 0 ? (
          <p className="mt-5 text-muted">No imports in the last seven days.</p>
        ) : (
          <ul className="fade-in m-0 p-0">
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
