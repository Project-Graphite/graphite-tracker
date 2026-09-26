import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  categoryLabels,
  discoverCategories,
  type CatalogResponse,
  type DiscoverCategory,
} from '../catalog';
import { CatalogRow } from '../components/CatalogRow';
import { useResource } from '../useResource';

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
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('query')).trim();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="page-enter">
      <section className="border-b border-line pb-12">
        <p className="eyebrow">One library · every medium</p>
        <h1 className="page-title">Track what you watch, read and play.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Movies, TV, anime, manga, manhwa and games in one library, with your progress in each.
        </p>
        <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" onSubmit={search} role="search">
          <input
            aria-label="Title"
            minLength={2}
            name="query"
            placeholder="Search movies, TV, anime, manga, manhwa and games"
            required
            type="search"
          />
          <button className="primary-button" type="submit">
            Search
          </button>
        </form>
      </section>
      {discoverCategories.map((category) => (
        <RecentRow category={category} key={category} />
      ))}
    </div>
  );
}
