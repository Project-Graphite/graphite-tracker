import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import { countLabel, type CatalogResponse } from '../catalog';
import { CatalogCard } from '../components/CatalogCard';
import {
  entryHref,
  libraryStateLabels,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';
import { librarySourceKey, useLibraryEntries } from '../useLibraryEntries';

export function TrackGamesPage() {
  const auth = useAuth();
  const library = useLibraryEntries('game');
  const [result, setResult] = useState<CatalogResponse>();
  const [searchedQuery, setSearchedQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query')).trim();
    setBusy(true);
    setError('');
    try {
      setResult(
        await apiRequest<CatalogResponse>(
          `/catalog/game/search?query=${encodeURIComponent(query)}&page=1`,
        ),
      );
      setSearchedQuery(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not search games');
    } finally {
      setBusy(false);
    }
  }

  async function updateState(entry: LibraryEntry, state: LibraryState) {
    if (!auth.accessToken) return;
    setUpdatingId(entry.id);
    setError('');
    try {
      library.upsert(
        await apiRequest<LibraryEntry>(
          `/library/${entry.id}`,
          { method: 'PATCH', body: JSON.stringify({ state }) },
          auth.accessToken,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update game');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Your game catalogue</p>
      <h1 className="page-title">Track games.</h1>
      <p className="mt-5 max-w-2xl text-muted">
        Find a game, choose the list it belongs to, and keep its status in one place.
      </p>

      <form
        className="mt-8 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => void search(event)}
      >
        <label className="field-label">
          Search games
          <input
            minLength={2}
            name="query"
            placeholder="Enter a game title"
            required
          />
        </label>
        <button className="primary-button self-end" disabled={busy} type="submit">
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {(error || library.error) && (
        <p className="error-message mt-5">{error || library.error}</p>
      )}

      {result && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
            <h2 className="m-0 text-2xl font-medium">
              Results for {searchedQuery}
            </h2>
            <span className="mono-sm text-faint">
              Data:{' '}
              {result.attributionUrl ? (
                <a
                  className="rule-link"
                  href={result.attributionUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {result.attribution}
                </a>
              ) : (
                result.attribution
              )}
            </span>
          </div>
          {result.results.length === 0 ? (
            <p className="mt-5 text-muted">No games found.</p>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {result.results.slice(0, 10).map((item) => {
                const itemKey = librarySourceKey(item.source, item.externalId);
                return (
                  <CatalogCard
                    entry={library.bySource.get(itemKey) ?? null}
                    item={item}
                    key={itemKey}
                    libraryReady={library.ready}
                    onAdded={library.upsert}
                    showSynopsis={false}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="mt-14">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 className="mt-2 mb-0 text-2xl font-medium">Tracked games</h2>
          </div>
          <span className="mono-sm text-faint">
            {library.ready && countLabel(library.entries.length, 'game')}
          </span>
        </div>
        {!library.ready ? (
          <p className="mt-5 text-muted">Loading tracked games…</p>
        ) : library.entries.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-8 text-center">
            <h3 className="m-0 text-xl font-medium">No games tracked yet.</h3>
            <p className="mt-2 text-muted">Search above and add your first game.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {library.entries.map((entry) => {
              const href = entryHref(entry);
              return (
                <article
                  className="grid grid-cols-[5rem_1fr] gap-4 rounded-xl border border-line bg-surface p-4"
                  key={entry.id}
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-md bg-line-soft">
                    {entry.item.posterUrl && (
                      <img
                        alt={`Poster for ${entry.item.title}`}
                        className="h-full w-full object-cover"
                        src={entry.item.posterUrl}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mono-sm m-0 text-faint">
                      {entry.item.releaseDate?.slice(0, 4) ?? 'Date unknown'}
                    </p>
                    <h3 className="mt-1 mb-0 text-lg font-medium">
                      {href ? (
                        <Link className="text-ink no-underline hover:underline" to={href}>
                          {entry.item.title}
                        </Link>
                      ) : (
                        entry.item.title
                      )}
                    </h3>
                    <label className="field-label mt-4">
                      List
                      <select
                        disabled={updatingId === entry.id}
                        onChange={(event) =>
                          void updateState(entry, event.target.value as LibraryState)
                        }
                        value={entry.state}
                      >
                        {(Object.keys(libraryStateLabels) as LibraryState[]).map((state) => (
                          <option key={state} value={state}>
                            {stateLabel('game', state)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mono-sm mt-3 mb-0 text-faint">
                      {entry.progress.hours === null
                        ? 'No play time recorded'
                        : `${countLabel(entry.progress.hours, 'hour')} played`}
                      {entry.progress.percentage === null
                        ? ''
                        : ` / ${entry.progress.percentage}% complete`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
