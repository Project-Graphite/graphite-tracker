import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

type LibraryState = 'planned' | 'in_progress' | 'completed' | 'dropped';

interface LibraryEntry {
  id: string;
  state: LibraryState;
  item: {
    title: string;
    synopsis: string | null;
    posterUrl: string | null;
    releaseDate: string | null;
  };
}

const labels: Record<LibraryState, string> = {
  planned: 'Plan to watch',
  in_progress: 'Watching',
  completed: 'Watched',
  dropped: 'Dropped',
};

export function LibraryPage() {
  const auth = useAuth();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth.accessToken) {
      return;
    }
    try {
      setEntries(await apiRequest<LibraryEntry[]>('/library', {}, auth.accessToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load library');
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, state: LibraryState) {
    if (!auth.accessToken) return;
    try {
      const updated = await apiRequest<LibraryEntry>(
        `/library/${id}`,
        { method: 'PATCH', body: JSON.stringify({ state }) },
        auth.accessToken,
      );
      setEntries((current) => current.map((entry) => (entry.id === id ? updated : entry)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update entry');
    }
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Your collection</p>
      <h1 className="page-title">Library</h1>
      {error && <p className="error-message mt-5">{error}</p>}
      {loading ? (
        <p className="mt-8 text-muted">Loading your library…</p>
      ) : entries.length === 0 ? (
        <div className="mt-9 rounded-xl border border-dashed border-line p-8 text-center">
          <h2 className="m-0 text-xl font-medium">Nothing tracked yet.</h2>
          <p className="mt-2 text-muted">Find a movie and add it to your plans.</p>
          <Link className="primary-button mt-5 inline-flex" to="/discover/movies/recent">Discover movies</Link>
        </div>
      ) : (
        <div className="mt-9 grid gap-4">
          {entries.map((entry) => (
            <article className="grid grid-cols-[5rem_1fr] gap-4 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[6rem_1fr_auto] sm:items-center" key={entry.id}>
              <div className="aspect-[2/3] overflow-hidden rounded-md bg-line-soft">
                {entry.item.posterUrl && <img className="h-full w-full object-cover" src={entry.item.posterUrl} alt={`Poster for ${entry.item.title}`} />}
              </div>
              <div>
                <p className="mono-sm m-0 text-faint">{entry.item.releaseDate?.slice(0, 4) ?? 'Date unknown'}</p>
                <h2 className="mt-1 mb-0 text-lg font-medium">{entry.item.title}</h2>
              </div>
              <label className="col-span-2 grid gap-1 text-xs text-muted sm:col-span-1">
                List
                <select value={entry.state} onChange={(event) => void update(entry.id, event.target.value as LibraryState)}>
                  {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
