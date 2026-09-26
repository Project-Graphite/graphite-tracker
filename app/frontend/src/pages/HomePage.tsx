import type { FormEvent } from 'react';
import {
  categoryLabels,
  discoverCategories,
  type CatalogResponse,
  type DiscoverCategory,
} from '../catalog';
import { useCatalogSearch } from '../catalogSearch';
import { CatalogRow } from '../components/CatalogRow';
import { useResource } from '../useResource';
import { searchQuery, useFormErrors } from '../validation';

function RecentRow({ category }: { category: DiscoverCategory }) {
  const { data, error } = useResource<CatalogResponse>(`/catalog/${category}/recent?page=1`);
  return (
    <CatalogRow
      empty="No recent titles are available."
      error={error}
      eyebrow="Recently released"
      items={data?.results}
      link={{ href: `/discover/${category}/recent`, label: 'View all' }}
      title={categoryLabels[category]}
    />
  );
}

export function HomePage() {
  const search = useCatalogSearch();
  const form = useFormErrors();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.check(event.currentTarget, { query: searchQuery })) return;
    const query = String(new FormData(event.currentTarget).get('query')).trim();
    void search.submit(query, (value) => `/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page-enter">
      <section className="border-b border-line pb-12">
        <p className="eyebrow">One library · every medium</p>
        <h1 className="page-title">Track what you watch, read and play.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Movies, TV, anime, manga, manhwa and games in one library, with your progress in each.
        </p>
        <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" noValidate onSubmit={submit} role="search">
          <input
            aria-describedby={form.errors.query ? 'search-error' : undefined}
            aria-invalid={form.errors.query ? true : undefined}
            aria-label="Title"
            name="query"
            onInput={form.field('query').onInput}
            placeholder="Search every medium, or paste a TMDB, MangaDex, IGDB or RAWG link"
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
      </section>
      {discoverCategories.map((category) => (
        <RecentRow category={category} key={category} />
      ))}
    </div>
  );
}
