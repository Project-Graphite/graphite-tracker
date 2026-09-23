import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import { titleHref, type CatalogCandidate } from '../catalog';
import {
  libraryStates,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';
import { ExpandableText } from './ExpandableText';

export function AddToListButton({
  className = 'secondary-button px-3 py-2',
  entry,
  item,
  libraryReady,
  onAdded,
}: {
  className?: string;
  entry: LibraryEntry | null;
  item: CatalogCandidate;
  libraryReady: boolean;
  onAdded: (entry: LibraryEntry) => void;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<LibraryState>('planned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function showModal() {
    if (!auth.user) {
      navigate('/login');
      return;
    }
    setState('planned');
    setError('');
    dialog.current?.showModal();
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.accessToken) return;
    setBusy(true);
    setError('');
    try {
      const added = await apiRequest<LibraryEntry>(
        '/library',
        {
          method: 'POST',
          body: JSON.stringify({
            externalId: item.externalId,
            category: item.category,
            source: item.source,
            state,
          }),
        },
        auth.accessToken,
      );
      onAdded(added);
      dialog.current?.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add title');
    } finally {
      setBusy(false);
    }
  }

  const loading = !auth.ready || (Boolean(auth.user) && !libraryReady);

  return (
    <>
      <button
        className={className}
        disabled={loading || Boolean(entry)}
        onClick={showModal}
        type="button"
      >
        {loading ? 'Loading…' : entry ? 'Added' : 'Add to list'}
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface text-ink backdrop:bg-paper/80"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        ref={dialog}
      >
        <form className="p-6" onSubmit={(event) => void add(event)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Add to list</p>
              <h2 className="mt-2 mb-0 text-2xl font-medium" id={titleId}>
                {item.title}
              </h2>
            </div>
            <button
              aria-label="Close"
              className="text-button text-xl"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              type="button"
            >
              ×
            </button>
          </div>
          <label className="field-label mt-6">
            List
            <select
              onChange={(event) => setState(event.target.value as LibraryState)}
              value={state}
            >
              {libraryStates.map((value) => (
                <option key={value} value={value}>
                  {stateLabel(item.category, value)}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="error-message mt-4">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'Adding…' : 'Add to list'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function CatalogCard({
  entry,
  item,
  libraryReady,
  onAdded,
  showSynopsis = true,
}: {
  entry: LibraryEntry | null;
  item: CatalogCandidate;
  libraryReady: boolean;
  onAdded: (entry: LibraryEntry) => void;
  showSynopsis?: boolean;
}) {
  const href = titleHref(item);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="aspect-[2/3] bg-line-soft">
        {item.posterUrl ? (
          <Link to={href}>
            <img
              alt={`Poster for ${item.title}`}
              className="h-full w-full object-cover"
              loading="lazy"
              src={item.posterUrl}
            />
          </Link>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-faint">
            No poster
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mono-sm flex flex-wrap items-center gap-2 text-faint">
          <span>{item.releaseDate?.slice(0, 4) ?? 'Date unknown'}</span>
          {item.genres.slice(0, 3).map((genre) => (
            <span className="rounded-full border border-line px-2 py-0.5" key={genre}>
              {genre}
            </span>
          ))}
        </div>
        <h3 className="mt-2 mb-2 text-xl font-medium leading-tight">
          <Link className="text-ink no-underline hover:underline" to={href}>
            {item.title}
          </Link>
        </h3>
        {showSynopsis && (
          <ExpandableText>{item.synopsis || 'No synopsis available.'}</ExpandableText>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="mono-sm text-faint">
            {item.rating ? `${item.rating.toFixed(1)} / 10` : 'Not rated'}
          </span>
          <AddToListButton
            entry={entry}
            item={item}
            libraryReady={libraryReady}
            onAdded={onAdded}
          />
        </div>
      </div>
    </article>
  );
}
