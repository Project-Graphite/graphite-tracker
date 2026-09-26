import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  catalogCategories,
  categoryLabels,
  countLabel,
  type CatalogCategory,
  type CatalogResponse,
} from '../catalog';
import { useCatalogSearch } from '../catalogSearch';
import { CatalogRow } from '../components/CatalogRow';
import { EmptyState } from '../components/EmptyState';
import { useResource } from '../useResource';

function CategoryResults({ category, query }: { category: CatalogCategory; query: string }) {
  const results = useResource<CatalogResponse>(
    `/catalog/${category}/search?query=${encodeURIComponent(query)}&page=1`,
  );
  const encoded = encodeURIComponent(query);
  return (
    <CatalogRow
      empty="No matches."
      error={results.error}
      eyebrow={
        results.data
          ? results.data.totalResults === null
            ? 'results'
            : countLabel(results.data.totalResults, 'result')
          : 'searching'
      }
      items={results.data?.results.slice(0, 10)}
      link={{
        href: category === 'game' ? `/games?q=${encoded}` : `/discover/${category}/search?q=${encoded}`,
        label: 'View all',
      }}
      title={categoryLabels[category]}
    />
  );
}

export function SearchPage() {
  const search = useCatalogSearch();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get('query')).trim();
    void search.submit(next, (value) => `/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Unified catalogue</p>
      <h1 className="page-title">{query.length >= 2 ? `Results for “${query}”` : 'Search'}</h1>
      <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" key={query} onSubmit={submit} role="search">
        <input
          aria-label="Title"
          defaultValue={query}
          minLength={2}
          name="query"
          placeholder="Search every medium, or paste a TMDB, MangaDex, IGDB or RAWG link"
          required
          type="search"
        />
        <button className="primary-button" disabled={search.opening} type="submit">
          {search.opening ? 'Opening…' : 'Search'}
        </button>
        {search.error && <p className="error-message m-0 sm:col-span-2">{search.error}</p>}
      </form>
      {query.length >= 2 ? (
        catalogCategories.map((category) => (
          <CategoryResults category={category} key={category} query={query} />
        ))
      ) : (
        <div className="mt-10">
          <EmptyState title="Search every medium">
            <p className="mt-2 mb-0 text-muted">Enter at least two characters of a title.</p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
