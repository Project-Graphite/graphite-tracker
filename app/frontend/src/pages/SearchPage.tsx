import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { Skeleton } from '../components/Skeleton';
import { useResource } from '../useResource';
import { searchQuery, useFormErrors } from '../validation';

function CategoryResults({ category, query }: { category: CatalogCategory; query: string }) {
  const section = useRef<HTMLDivElement>(null);
  const [nearView, setNearView] = useState(false);

  useEffect(() => {
    const element = section.current;
    if (!element || nearView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNearView(true);
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [nearView]);

  const results = useResource<CatalogResponse>(
    nearView ? `/catalog/${category}/search?query=${encodeURIComponent(query)}&page=1` : null,
  );
  const encoded = encodeURIComponent(query);
  return (
    <div ref={section}>
      <CatalogRow
        empty="No matches."
        error={results.error}
        eyebrow={
          results.data
            ? results.data.totalResults === null
              ? 'results'
              : countLabel(results.data.totalResults, 'result')
            : <Skeleton className="inline-block h-3 w-16 align-middle" />
        }
        items={results.data?.results.slice(0, 10)}
        link={{
          href: category === 'game' ? `/games?q=${encoded}` : `/discover/${category}/search?q=${encoded}`,
          label: 'View all',
        }}
        title={categoryLabels[category]}
      />
    </div>
  );
}

export function SearchPage() {
  const search = useCatalogSearch();
  const form = useFormErrors();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.check(event.currentTarget, { query: searchQuery })) return;
    const next = String(new FormData(event.currentTarget).get('query')).trim();
    void search.submit(next, (value) => `/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Unified catalogue</p>
      <h1 className="page-title">{query.length >= 2 ? `Results for “${query}”` : 'Search'}</h1>
      <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" key={query} noValidate onSubmit={submit} role="search">
        <input
          aria-describedby={form.errors.query ? 'search-error' : undefined}
          aria-invalid={form.errors.query ? true : undefined}
          aria-label="Title"
          defaultValue={query}
          name="query"
          onInput={form.field('query').onInput}
          placeholder="Search every medium, or paste a TMDB, AniList, MangaUpdates, MangaDex, IGDB or RAWG link"
          type="search"
        />
        <button className="primary-button" disabled={search.opening} type="submit">
          {search.opening ? 'Opening…' : 'Search'}
        </button>
        {(form.errors.query || search.error) && (
          <p className="error-message m-0 sm:col-span-2" id="search-error">
            {form.errors.query || search.error}
          </p>
        )}
      </form>
      {query.length >= 2 ? (
        catalogCategories.map((category) => (
          <CategoryResults category={category} key={`${category}|${query}`} query={query} />
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
