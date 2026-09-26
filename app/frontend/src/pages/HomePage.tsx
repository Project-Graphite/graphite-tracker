import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  catalogCategories,
  catalogRef,
  categoryLabels,
  discoverCategories,
  type CatalogResponse,
  type DiscoverCategory,
} from '../catalog';
import { CatalogCard } from '../components/CatalogCard';
import { PosterRowSkeleton } from '../components/Skeleton';
import { useLibraryStates } from '../useLibraryStates';
import { useResource } from '../useResource';

const scrollButtonClass =
  'absolute top-[35%] z-10 hidden -translate-y-1/2 rounded-full border border-line bg-paper/90 p-3 text-ink backdrop-blur-sm transition-colors hover:border-muted hover:bg-surface sm:flex';

function RecentRow({ category }: { category: DiscoverCategory }) {
  const { data, error } = useResource<CatalogResponse>(`/catalog/${category}/recent?page=1`);
  const items = data?.results;
  const library = useLibraryStates(items);
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 4,
        end: element.scrollLeft >= element.scrollWidth - element.clientWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [items]);

  function scroll(direction: -1 | 1) {
    const element = row.current;
    if (!element) return;
    element.scrollBy({ behavior: 'smooth', left: direction * element.clientWidth });
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Recently released</p>
          <h2 className="mt-2 mb-0 text-2xl font-medium">{categoryLabels[category]}</h2>
        </div>
        <Link className="rule-link mono-sm" to={`/discover/${category}/recent`}>
          View all
        </Link>
      </div>
      {error || library.error ? (
        <p className="error-message mt-5">{error || library.error}</p>
      ) : !items ? (
        <div className="mt-5">
          <PosterRowSkeleton label={`Loading recent ${categoryLabels[category]}`} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-5 text-muted">No recent titles are available.</p>
      ) : (
        <div className="fade-in relative mt-5">
          <div className="catalog-row" ref={row}>
            {items.map((item) => (
              <div className="snap-start" key={catalogRef(item)}>
                <CatalogCard
                  entry={library.entryFor(item)}
                  item={item}
                  libraryReady={library.ready}
                  onAdded={library.add}
                />
              </div>
            ))}
          </div>
          {!edges.start && (
            <button
              aria-label={`Show previous ${categoryLabels[category]}`}
              className={`${scrollButtonClass} -left-3`}
              onClick={() => scroll(-1)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
                <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          )}
          {!edges.end && (
            <button
              aria-label={`Show more ${categoryLabels[category]}`}
              className={`${scrollButtonClass} -right-3`}
              onClick={() => scroll(1)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
                <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category'));
    const query = encodeURIComponent(String(form.get('query')).trim());
    navigate(category === 'game' ? `/games?q=${query}` : `/discover/${category}/search?q=${query}`);
  }

  return (
    <div className="page-enter">
      <section className="border-b border-line pb-12">
        <p className="eyebrow">One library · every medium</p>
        <h1 className="page-title">Track what you watch, read and play.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Movies, TV, anime, manga, manhwa and games in one library, with your progress in each.
        </p>
        <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[10rem_1fr_auto]" onSubmit={search}>
          <select aria-label="Category" defaultValue="movie" name="category">
            {catalogCategories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          <input
            aria-label="Title"
            minLength={2}
            name="query"
            placeholder="Search by title"
            required
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
