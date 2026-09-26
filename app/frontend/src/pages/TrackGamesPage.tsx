import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Page } from '../api';
import { useAuth } from '../auth';
import { countLabel, type CatalogResponse } from '../catalog';
import { useCatalogSearch } from '../catalogSearch';
import { CatalogGrid } from '../components/CatalogCard';
import { EmptyState } from '../components/EmptyState';
import { LibraryCard } from '../components/LibraryCard';
import { Pagination } from '../components/Pagination';
import { posterGridClass } from '../components/Poster';
import { PosterGridSkeleton, Skeleton } from '../components/Skeleton';
import { useFooterSource } from '../footerSource';
import type { LibraryEntry } from '../library';
import { useResource, type Resource } from '../useResource';

function TrackedGames({ tracked }: { tracked: Resource<Page<LibraryEntry>> }) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Your collection</p>
          <h2 className="mt-2 mb-0 text-2xl font-medium">Tracked games</h2>
        </div>
        {tracked.data && tracked.data.totalPages > 1 && (
          <Link className="rule-link mono-sm" to="/library?category=game">
            View all {tracked.data.totalResults.toLocaleString()}
          </Link>
        )}
      </div>
      {tracked.error ? (
        <p className="error-message mt-5">{tracked.error}</p>
      ) : !tracked.data ? (
        <div className="mt-6">
          <PosterGridSkeleton count={5} label="Loading tracked games" />
        </div>
      ) : tracked.data.results.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="No games tracked yet">
            <p className="mt-2 mb-0 text-muted">Search above and add your first game.</p>
          </EmptyState>
        </div>
      ) : (
        <div className={`fade-in mt-6 ${posterGridClass}`}>
          {tracked.data.results.map((entry) => (
            <LibraryCard
              entry={entry}
              key={entry.id}
              layout="grid"
              onChange={(next) =>
                tracked.mutate((current) => ({
                  ...current,
                  results: current.results.map((item) => (item.id === next.id ? next : item)),
                }))
              }
              onRemove={() =>
                tracked.mutate((current) => ({
                  ...current,
                  totalResults: current.totalResults - 1,
                  results: current.results.filter((item) => item.id !== entry.id),
                }))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TrackGamesPage() {
  const auth = useAuth();
  const search = useCatalogSearch();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = Number(searchParams.get('page')) || 1;
  const results = useResource<CatalogResponse>(
    query.length >= 2
      ? `/catalog/game/search?query=${encodeURIComponent(query)}&page=${page}`
      : null,
  );
  const tracked = useResource<Page<LibraryEntry>>(
    auth.user ? '/library?category=game' : null,
    true,
  );
  useFooterSource(
    results.data && {
      attribution: results.data.attribution,
      attributionUrl: results.data.attributionUrl,
    },
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get('query')).trim();
    void search.submit(next, (value) => `/games?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Your game catalogue</p>
      <h1 className="page-title">Track games</h1>
      <p className="mt-5 max-w-2xl text-muted">
        Find a game, choose its list, and record hours, completion and the platforms you play on.
      </p>
      <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" key={query} onSubmit={submit} role="search">
        <input
          aria-label="Game title"
          defaultValue={query}
          minLength={2}
          name="query"
          placeholder="Search games, or paste an IGDB or RAWG link"
          required
          type="search"
        />
        <button className="primary-button" disabled={search.opening} type="submit">
          {search.opening ? 'Opening…' : 'Search'}
        </button>
        {search.error && <p className="error-message m-0 sm:col-span-2">{search.error}</p>}
      </form>
      {results.error && <p className="error-message mt-6">{results.error}</p>}
      {results.loading && (
        <div className="mt-10">
          <div className="mb-6 border-b border-line pb-4">
            <Skeleton className="h-7 w-56" />
          </div>
          <PosterGridSkeleton label="Searching games" />
        </div>
      )}
      {results.data && (
        <section className="fade-in mt-10">
          {results.data.stale && (
            <p className="notice mb-5">
              The game source is temporarily unavailable. Showing the most recent cached result.
            </p>
          )}
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
            <h2 className="m-0 text-xl font-medium">
              {results.data.totalResults === null
                ? 'Results'
                : countLabel(results.data.totalResults, 'result')}{' '}
              for “{query}”
            </h2>
          </div>
          {results.data.results.length === 0 ? (
            <EmptyState title="No games found">
              <p className="mt-2 mb-0 text-muted">Try another title.</p>
            </EmptyState>
          ) : (
            <CatalogGrid items={results.data.results} onAdded={tracked.reload} />
          )}
          <Pagination
            page={results.data.page}
            pageHref={(next) => `/games?q=${encodeURIComponent(query)}&page=${next}`}
            totalPages={results.data.totalPages}
          />
        </section>
      )}
      {auth.user && <TrackedGames tracked={tracked} />}
    </div>
  );
}
