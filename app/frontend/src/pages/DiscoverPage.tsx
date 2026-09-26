import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth';
import {
  categoryLabels,
  countLabel,
  discoverCategories,
  type CatalogResponse,
  type CatalogSection,
  type ConnectorDescriptor,
  type DiscoverCategory,
} from '../catalog';
import { useCatalogSearch } from '../catalogSearch';
import { CatalogGrid } from '../components/CatalogCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { PosterGridSkeleton, Skeleton } from '../components/Skeleton';
import { Icon } from '../components/Icon';
import { YearPicker } from '../components/YearPicker';
import { useFooterSource } from '../footerSource';
import type { SourceSettings } from '../sources';
import { useResource } from '../useResource';

const sections: Array<{ id: Exclude<CatalogSection, 'search'>; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
];

const filterKeys = ['genre', 'year', 'status', 'sort', 'source'] as const;

function statusOptions(category: DiscoverCategory, section: CatalogSection) {
  if ((category === 'tv' || category === 'anime') && section !== 'search') {
    return [
      ['returning', 'Returning'],
      ['planned', 'Planned'],
      ['production', 'In production'],
      ['ended', 'Ended'],
      ['canceled', 'Canceled'],
      ['pilot', 'Pilot'],
    ];
  }
  if (category === 'manga' || category === 'manhwa') {
    return [
      ['ongoing', 'Ongoing'],
      ['completed', 'Completed'],
      ['hiatus', 'Hiatus'],
      ['cancelled', 'Cancelled'],
    ];
  }
  return [];
}

function sortOptions(category: DiscoverCategory, section: CatalogSection) {
  if (category === 'manga' || category === 'manhwa') {
    return [
      ['followedCount', 'Most followed'],
      ['latestUploadedChapter', 'Latest update'],
    ];
  }
  const newest = category === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
  return [
    ...(section === 'search' ? [] : [['popularity.desc', 'Popularity']]),
    ['vote_average.desc', 'Rating'],
    [newest, 'Newest'],
  ];
}

function pageFrom(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1;
}

export function DiscoverPage({
  category,
  section,
}: {
  category: DiscoverCategory;
  section: CatalogSection;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const search = useCatalogSearch();
  const [searchError, setSearchError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = pageFrom(searchParams.get('page'));
  const settings = useResource<SourceSettings>(
    auth.ready && auth.user ? '/sources' : null,
    true,
  );
  const publicSources = useResource<ConnectorDescriptor[]>(
    auth.ready && !auth.user ? `/catalog/sources?category=${category}` : null,
  );
  const sources = settings.data
    ? settings.data.sources.filter(
        (source) => source.enabled && source.categories.includes(category),
      )
    : (publicSources.data ?? []).filter((source) => source.enabled);
  const preferred = settings.data?.categories[category] ?? settings.data?.global;
  const source =
    searchParams.get('source') ||
    (preferred && sources.some((item) => item.key === preferred) ? preferred : '');
  const sourcesReady = Boolean(
    settings.data ?? publicSources.data ?? (settings.error || publicSources.error),
  );
  const genres = useResource<string[]>(
    `/catalog/${category}/genres${source ? `?source=${source}` : ''}`,
  );

  const parameters = new URLSearchParams({ page: String(page) });
  if (section === 'search') parameters.set('query', query);
  for (const key of filterKeys) {
    const value = key === 'source' ? source : searchParams.get(key);
    if (value) parameters.set(key, value);
  }
  const canLoad = sourcesReady && (section !== 'search' || query.length >= 2);
  const results = useResource<CatalogResponse>(
    canLoad ? `/catalog/${category}/${section}?${parameters.toString()}` : null,
  );
  useFooterSource(
    results.data && {
      attribution: results.data.attribution,
      attributionUrl: results.data.attributionUrl,
    },
  );
  const statuses = statusOptions(category, section);
  const activeFilters = filterKeys.filter((key) => searchParams.get(key)).length;
  const hasFilters = activeFilters > 0;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (section === 'search') next.set('q', query);
    for (const key of filterKeys) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    navigate(`/discover/${category}/${section}?${next.toString()}`);
  }

  function searchTitles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('q')).trim();
    if (value.length < 2) {
      setSearchError('Enter at least two characters of a title, or paste a link.');
      return;
    }
    setSearchError('');
    void search.submit(
      value,
      (title) =>
        `/discover/${category}/search?q=${encodeURIComponent(title)}${searchParams.get('source') ? `&source=${encodeURIComponent(source)}` : ''}`,
    );
  }

  function pageHref(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    return `/discover/${category}/${section}?${next.toString()}`;
  }

  const error = settings.error || publicSources.error || genres.error || results.error;

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <p className="eyebrow">Unified catalogue</p>
          <h1 className="page-title">Discover {categoryLabels[category]}</h1>
        </div>
        <form
          className="grid w-full gap-2 sm:w-[26rem]"
          key={`${category}:${query}`}
          noValidate
          onSubmit={searchTitles}
          role="search"
        >
          <div className="flex gap-2">
            <input
              aria-describedby={searchError || search.error ? 'discover-search-error' : undefined}
              aria-invalid={Boolean(searchError || search.error)}
              aria-label={`Search ${categoryLabels[category]}`}
              defaultValue={query}
              name="q"
              placeholder={`Search ${categoryLabels[category]} or paste a link`}
              type="search"
            />
            <button className="primary-button shrink-0" disabled={search.opening} type="submit">
              {search.opening ? 'Opening…' : 'Search'}
            </button>
          </div>
          {(searchError || search.error) && (
            <p className="error-message m-0" id="discover-search-error">
              {searchError || search.error}
            </p>
          )}
        </form>
      </div>
      <nav aria-label="Media categories" className="chip-row mt-7">
        {discoverCategories.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `secondary-button px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'border-ink' : ''}`
            }
            key={item}
            to={
              section === 'search' && query
                ? `/discover/${item}/search?q=${encodeURIComponent(query)}`
                : `/discover/${item}/${section}`
            }
          >
            {categoryLabels[item]}
          </NavLink>
        ))}
      </nav>
      <nav aria-label="Discovery section" className="mt-5 flex items-end gap-2 border-b border-line">
        {sections.map(({ id, label }) => (
          <NavLink className="tab-link -mb-px" key={id} to={`/discover/${category}/${id}`}>
            {label}
          </NavLink>
        ))}
        {section === 'search' && query && (
          <span aria-current="page" className="tab-link active -mb-px min-w-0 truncate">
            “{query}”
          </span>
        )}
      </nav>
      <button
        aria-controls="discover-filters"
        aria-expanded={filtersOpen}
        className="secondary-button mt-5 inline-flex gap-2 px-3 py-2 text-sm sm:hidden"
        onClick={() => setFiltersOpen((current) => !current)}
        type="button"
      >
        <Icon name="filter" size={16} />
        {filtersOpen ? 'Hide filters' : 'Filters'}
        {activeFilters > 0 && <span className="count-badge static border-0">{activeFilters}</span>}
      </button>
      <form
        className={`mt-5 grid-cols-2 gap-3 sm:mt-6 sm:grid lg:grid-cols-6 ${filtersOpen ? 'grid' : 'hidden'}`}
        id="discover-filters"
        key={`${category}:${section}:${searchParams.toString()}`}
        onSubmit={apply}
      >
        {(genres.loading || (genres.data?.length ?? 0) > 0) && (
          <label className="field-label">
            Genre
            <select
              defaultValue={searchParams.get('genre') ?? ''}
              disabled={genres.loading}
              key={genres.loading ? 'loading' : 'loaded'}
              name="genre"
            >
              <option value="">Any genre</option>
              {genres.data?.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </label>
        )}
        <YearPicker defaultValue={searchParams.get('year') ?? ''} label="Year" name="year" />
        {statuses.length > 0 && (
          <label className="field-label">
            Status
            <select defaultValue={searchParams.get('status') ?? ''} name="status">
              <option value="">Any status</option>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field-label">
          Sort
          <select defaultValue={searchParams.get('sort') ?? ''} name="sort">
            <option value="">{section === 'search' ? 'Relevance' : 'Default'}</option>
            {sortOptions(category, section).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {sources.length > 1 && (
          <label className="field-label">
            Source
            <select defaultValue={source} name="source">
              <option value="">Default</option>
              {sources.map((item) => (
                <option key={item.key} value={item.key}>{item.displayName}</option>
              ))}
            </select>
          </label>
        )}
        <div className="col-span-2 flex items-end gap-3 lg:col-span-1">
          <button className="primary-button flex-1" type="submit">
            {section === 'search' ? 'Search' : 'Apply'}
          </button>
          {hasFilters && (
            <Link
              className="text-button mono-sm py-3"
              to={`/discover/${category}/${section}${query ? `?q=${encodeURIComponent(query)}` : ''}`}
            >
              Clear
            </Link>
          )}
        </div>
      </form>
      {error && <p className="error-message mt-6 max-w-3xl">{error}</p>}
      {section === 'search' && query.length < 2 ? (
        <div className="mt-10">
          <EmptyState title={`Search ${categoryLabels[category]}`}>
            <p className="mt-2 mb-0 text-muted">
              Use the search above: enter at least two characters of a title, or paste a source link.
            </p>
          </EmptyState>
        </div>
      ) : results.loading || !sourcesReady ? (
        <div className="mt-10">
          <div className="mb-6 border-b border-line pb-4">
            <Skeleton className="h-7 w-48" />
          </div>
          <PosterGridSkeleton />
        </div>
      ) : (
        results.data && (
          <section className="fade-in mt-10">
            {results.data.stale && (
              <p className="notice mb-5">
                The source is temporarily unavailable. Showing the most recent cached result.
              </p>
            )}
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
              <h2 className="m-0 text-xl font-medium">
                {section === 'search'
                  ? `${results.data.totalResults === null ? 'Results' : countLabel(results.data.totalResults, 'result')} for “${query}”`
                  : section === 'recent'
                    ? 'Recently released'
                    : 'Popular now'}
              </h2>
            </div>
            {results.data.results.length === 0 ? (
              <EmptyState title={results.data.totalPages > 1 ? 'Nothing on this page' : 'No titles found'}>
                <p className="mt-2 mb-0 text-muted">
                  {results.data.totalPages > 1
                    ? 'The source pages its results before your filters apply. Try the next page or broader filters.'
                    : 'Try broader filters or another search.'}
                </p>
              </EmptyState>
            ) : (
              <CatalogGrid items={results.data.results} />
            )}
            <Pagination page={results.data.page} pageHref={pageHref} totalPages={results.data.totalPages} />
          </section>
        )
      )}
    </div>
  );
}
