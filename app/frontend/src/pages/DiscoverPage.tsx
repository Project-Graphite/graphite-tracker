import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

interface MovieCandidate {
  externalId: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  releaseDate: string | null;
}

interface CatalogResponse {
  results: MovieCandidate[];
  totalResults: number;
  attribution: string;
}

type DiscoverSection = 'search' | 'recent' | 'popular';

const sections: Array<{ id: DiscoverSection; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
  { id: 'search', label: 'Search' },
];

export function DiscoverPage({ section }: { section: DiscoverSection }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const [result, setResult] = useState<CatalogResponse>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (section === 'search' && query.length < 2) {
      setResult(undefined);
      setError('');
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    setResult(undefined);
    setBusy(true);
    setError('');
    const path =
      section === 'search'
        ? `/catalog/search?query=${encodeURIComponent(query)}&page=1`
        : `/catalog/movies/${section}?page=1`;

    void apiRequest<CatalogResponse>(path, { signal: controller.signal })
      .then(setResult)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Could not load movies');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      });

    return () => controller.abort();
  }, [query, section]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = String(new FormData(event.currentTarget).get('query')).trim();
    navigate(`/discover/movies/search?q=${encodeURIComponent(nextQuery)}`);
  }

  async function add(externalId: string) {
    if (!auth.accessToken) {
      return;
    }
    setError('');
    try {
      await apiRequest(
        '/library',
        { method: 'POST', body: JSON.stringify({ externalId, state: 'planned' }) },
        auth.accessToken,
      );
      setAdded((current) => new Set(current).add(externalId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add movie');
    }
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">TMDB movie catalogue</p>
      <h1 className="page-title">Discover movies.</h1>
      <nav aria-label="Movie discovery" className="mt-8 flex gap-2 border-b border-line">
        {sections.map(({ id, label }) => (
          <NavLink
            className={({ isActive }) =>
              `border-b-2 px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                isActive
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`
            }
            key={id}
            to={`/discover/movies/${id}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {section === 'search' && (
        <form className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={search}>
          <label className="sr-only" htmlFor="movie-query">Movie title</label>
          <input
            className="min-w-0 flex-1"
            defaultValue={query}
            id="movie-query"
            minLength={2}
            name="query"
            placeholder="Search by title"
            required
          />
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>
      )}
      {busy && !result && <p className="mt-8 text-muted">Loading movies…</p>}
      {error && <p className="error-message mt-5 max-w-2xl">{error}</p>}
      {result && (
        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
            <h2 className="m-0 text-xl font-medium">
              {section === 'search'
                ? `${result.totalResults.toLocaleString()} results`
                : section === 'recent'
                  ? 'Recently released'
                  : 'Popular now'}
            </h2>
            <span className="mono-sm text-faint">Data: {result.attribution}</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.results.map((movie) => (
              <article className="overflow-hidden rounded-xl border border-line bg-surface" key={movie.externalId}>
                <div className="aspect-[2/3] bg-line-soft">
                  {movie.posterUrl ? (
                    <img className="h-full w-full object-cover" loading="lazy" src={movie.posterUrl} alt={`Poster for ${movie.title}`} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-faint">No poster</div>
                  )}
                </div>
                <div className="p-5">
                  <p className="mono-sm m-0 text-faint">{movie.releaseDate?.slice(0, 4) ?? 'Date unknown'}</p>
                  <h2 className="mt-2 mb-2 text-xl font-medium leading-tight">{movie.title}</h2>
                  <p className="line-clamp-3 min-h-[4.5rem] text-sm text-muted">{movie.synopsis || 'No synopsis available.'}</p>
                  {auth.user ? (
                    <button className="secondary-button mt-4 w-full" disabled={added.has(movie.externalId)} onClick={() => void add(movie.externalId)} type="button">
                      {added.has(movie.externalId) ? 'Added to plans' : 'Plan to watch'}
                    </button>
                  ) : (
                    <Link className="secondary-button mt-4 flex justify-center" to="/login">Sign in to add</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
