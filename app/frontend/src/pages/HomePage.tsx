import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, isAbortError } from '../api';
import {
  categoryLabels,
  discoverCategories,
  type CatalogCandidate,
  type CatalogCategory,
  type CatalogResponse,
  type DiscoverCategory,
} from '../catalog';
import { CatalogCard } from '../components/CatalogCard';
import type { LibraryEntry } from '../library';
import { librarySourceKey, useLibraryEntries } from '../useLibraryEntries';

const carouselButtonClass =
  'absolute top-1/2 z-10 flex -translate-y-1/2 rounded-full border border-line bg-paper/90 p-3 text-ink backdrop-blur-sm transition-colors hover:border-muted hover:bg-surface';

function RecentCarousel({
  bySource,
  category,
  items,
  libraryReady,
  onAdded,
}: {
  bySource: Map<string, LibraryEntry>;
  category: DiscoverCategory;
  items: CatalogCandidate[];
  libraryReady: boolean;
  onAdded: (entry: LibraryEntry) => void;
}) {
  const carousel = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const element = carousel.current;
    if (!element) return undefined;
    const updateControls = () => {
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(
        element.scrollLeft < element.scrollWidth - element.clientWidth - 4,
      );
    };
    const observer = new ResizeObserver(updateControls);
    observer.observe(element);
    element.addEventListener('scroll', updateControls, { passive: true });
    updateControls();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', updateControls);
    };
  }, [items.length]);

  function scroll(direction: -1 | 1) {
    const element = carousel.current;
    if (!element) return;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap);
    element.scrollBy({
      behavior: 'smooth',
      left: direction * (element.clientWidth + gap),
    });
  }

  return (
    <div className="relative mt-5">
      <div className="catalog-carousel" ref={carousel}>
        {items.slice(0, 14).map((item) => {
          const itemKey = librarySourceKey(item.source, item.externalId);
          return (
            <div className="snap-start" key={itemKey}>
              <CatalogCard
                entry={bySource.get(itemKey) ?? null}
                item={item}
                libraryReady={libraryReady}
                onAdded={onAdded}
                showSynopsis={false}
              />
            </div>
          );
        })}
        <Link
          className="flex h-full min-h-96 snap-start flex-col items-center justify-center rounded-xl border border-line bg-surface p-8 text-center text-ink no-underline transition-colors hover:border-muted hover:bg-line-soft"
          to={`/discover/${category}/recent`}
        >
          <span className="mono-sm text-faint">Recently released</span>
          <strong className="mt-3 text-2xl font-medium">View more</strong>
          <span className="mt-3 text-sm text-muted">
            Browse all recent {categoryLabels[category]}.
          </span>
        </Link>
      </div>
      {canScrollLeft && (
        <button
          aria-label="Show previous titles"
          className={`${carouselButtonClass} left-3`}
          onClick={() => scroll(-1)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          aria-label="Show more titles"
          className={`${carouselButtonClass} right-3`}
          onClick={() => scroll(1)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
            <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Partial<Record<DiscoverCategory, CatalogResponse>>>({});
  const [errors, setErrors] = useState<Partial<Record<DiscoverCategory, string>>>({});
  const library = useLibraryEntries();

  useEffect(() => {
    const controller = new AbortController();
    discoverCategories.forEach((category) => {
      void apiRequest<CatalogResponse>(
        `/catalog/${category}/recent?page=1`,
        { signal: controller.signal },
      )
        .then((result) => {
          setRows((current) => ({ ...current, [category]: result }));
        })
        .catch((reason: unknown) => {
          if (!isAbortError(reason)) {
            setErrors((current) => ({
              ...current,
              [category]: reason instanceof Error
                ? reason.message
                : `Could not load recent ${categoryLabels[category]}`,
            }));
          }
        });
    });
    return () => controller.abort();
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category')) as CatalogCategory;
    const query = String(form.get('query')).trim();
    navigate(`/discover/${category}/search?q=${encodeURIComponent(query)}&page=1`);
  }

  return (
    <div className="page-enter">
      <section className="grid gap-10 border-b border-line pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="eyebrow">One library · every medium</p>
          <h1 className="page-title">Track what you watch, read, and play.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Browse five entertainment categories, track games separately, and keep one library for everything.
          </p>
        </div>
        <form className="grid gap-3 rounded-xl border border-line bg-surface p-5" onSubmit={search}>
          <label className="field-label">
            Search category
            <select defaultValue="movie" name="category">
              {discoverCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="field-label">
            Title
            <input minLength={2} name="query" placeholder="What are you looking for?" required />
          </label>
          <button className="primary-button" type="submit">Search catalogue</button>
        </form>
      </section>
      {library.error && <p className="error-message mt-8">{library.error}</p>}
      {discoverCategories.map((category) => {
        const row = rows[category];
        return (
          <section className="mt-12" key={category}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
              <div>
                <p className="eyebrow">Recently released</p>
                <h2 className="mt-2 mb-0 text-2xl font-medium">{categoryLabels[category]}</h2>
              </div>
              <Link className="rule-link mono-sm" to={`/discover/${category}/recent`}>
                View more
              </Link>
            </div>
            {errors[category] ? (
              <p className="error-message mt-5">{errors[category]}</p>
            ) : !row ? (
              <p className="mt-5 text-muted">Loading recent titles…</p>
            ) : row.results.length === 0 ? (
              <p className="mt-5 text-muted">No recent titles are available.</p>
            ) : (
              <RecentCarousel
                bySource={library.bySource}
                category={category}
                items={row.results}
                libraryReady={library.ready}
                onAdded={library.upsert}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
