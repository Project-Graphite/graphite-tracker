import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import MuiLink from '@mui/material/Link';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, errorMessage, ListSkeleton } from '@project-graphite/ui';
import { useAuth } from '../auth';
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
      <MuiLink className="mono-sm" component={Link} to="/library" underline="always">
        Back to library
      </MuiLink>
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
        <FormControl error={Boolean(fileError)}>
          <FormLabel id="backup-label">Backup file</FormLabel>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <Button className="w-fit shrink-0" component="label" icon="upload" size="small">
              Choose file
              <input
                accept=".tachibk,.gz,application/gzip"
                aria-describedby={fileError ? 'backup-error' : undefined}
                aria-invalid={fileError ? true : undefined}
                aria-labelledby="backup-label"
                className="sr-only"
                name="file"
                onChange={(event) => {
                  setFile(event.target.files?.[0]);
                  setFileError('');
                }}
                type="file"
              />
            </Button>
            <span className={`min-w-0 truncate text-sm ${file ? 'text-ink' : 'text-faint'}`}>
              {file?.name ?? 'No file chosen'}
            </span>
          </div>
          {fileError && <FormHelperText id="backup-error">{fileError}</FormHelperText>}
        </FormControl>
        <Button className="sm:mt-6" disabled={busy} type="submit" variant="primary">
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
        {error && <Alert className="sm:col-span-2" severity="error">{error}</Alert>}
      </form>
      <section className="mt-14 max-w-3xl">
        <h2 className="m-0 border-b border-line pb-4 text-xl font-medium">Recent imports</h2>
        {history.error ? (
          <Alert className="mt-5" severity="error">{history.error}</Alert>
        ) : !history.data ? (
          <ListSkeleton label="Loading imports" rows={3} />
        ) : history.data.length === 0 ? (
          <p className="mt-5 text-muted">No imports in the last seven days.</p>
        ) : (
          <ul className="fade-in m-0 p-0">
            {history.data.map((batch) => (
              <li className="flex list-none flex-wrap items-baseline justify-between gap-3 border-b border-line-soft py-3" key={batch.id}>
                <MuiLink component={Link} to={`/import/${batch.id}`} underline="always">
                  {batch.sourceApp ? `${importApps[batch.sourceApp]} backup` : 'Backup'} ·{' '}
                  {new Date(batch.createdAt).toLocaleString()}
                </MuiLink>
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
