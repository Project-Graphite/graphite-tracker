import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import MuiTextField from '@mui/material/TextField';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, EmptyState, Pagination, Select, Skeleton, Tabs } from '@project-graphite/ui';
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
import { PosterGridSkeleton } from '../components/Skeleton';
import { YearPicker } from '../components/YearPicker';
import { useFooterSource } from '../footerSource';
import { useSiteSettings } from '../site';
import type { SourceSettings } from '../sources';
import { useResource } from '../useResource';

const sections: Array<{ id: Exclude<CatalogSection, 'search'>; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
];

const filterKeys = ['genre', 'year', 'status', 'sort', 'source'] as const;

function statusOptions(category: DiscoverCategory, section: CatalogSection, source: string) {
  if (category === 'anime' && source !== 'tmdb') {
    return [
      ['releasing', 'Airing'],
      ['finished', 'Finished'],
      ['not_yet_released', 'Not yet aired'],
      ['hiatus', 'Hiatus'],
      ['cancelled', 'Cancelled'],
    ];
  }
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
  if ((category === 'manga' || category === 'manhwa') && source === 'mangadex') {
    return [
      ['ongoing', 'Ongoing'],
      ['completed', 'Completed'],
      ['hiatus', 'Hiatus'],
      ['cancelled', 'Cancelled'],
    ];
  }
  return [];
}

function sortOptions(category: DiscoverCategory, section: CatalogSection, source: string) {
  if (category === 'manga' || category === 'manhwa') {
    return source === 'mangadex'
      ? [
          ['followedCount', 'Most followed'],
          ['latestUploadedChapter', 'Latest update'],
        ]
      : [
          ['list_reading', 'Most read'],
          ['month1_pos', 'Trending'],
          ['rating', 'Rating'],
        ];
  }
  if (category === 'anime' && source !== 'tmdb') {
    return [
      ['TRENDING_DESC', 'Trending'],
      ['POPULARITY_DESC', 'Popularity'],
      ['SCORE_DESC', 'Rating'],
      ['START_DATE_DESC', 'Newest'],
    ];
  }
  const newest =category === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
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
  const site = useSiteSettings();
  const activeSource = source || site.data?.defaultSources[category] || '';
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
  const statuses = statusOptions(category, section, activeSource);
  const activeFilters = filterKeys.filter((key) => searchParams.get(key)).length;
  const hasFilters = activeFilters > 0;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (section === 'search') next.set('q', query);
    const sourceChanged = form.has('source') && form.get('source') !== source;
    for (const key of filterKeys) {
      const value = String(form.get(key) ?? '').trim();
      if (value && !(sourceChanged && ['genre', 'status', 'sort'].includes(key))) {
        next.set(key, value);
      }
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
            <MuiTextField
              defaultValue={query}
              fullWidth
              name="q"
              placeholder={`Search ${categoryLabels[category]} or paste a link`}
              size="small"
              slotProps={{
                htmlInput: {
                  'aria-describedby': searchError || search.error ? 'discover-search-error' : undefined,
                  'aria-invalid': Boolean(searchError || search.error),
                  'aria-label': `Search ${categoryLabels[category]}`,
                },
              }}
              type="search"
            />
            <Button className="shrink-0" disabled={search.opening} type="submit" variant="primary">
              {search.opening ? 'Opening…' : 'Search'}
            </Button>
          </div>
          {(searchError || search.error) && (
            <Alert id="discover-search-error" severity="error">
              {searchError || search.error}
            </Alert>
          )}
        </form>
      </div>
      <nav aria-label="Media categories" className="chip-row mt-7">
        {discoverCategories.map((item) => (
          <Button
            aria-current={item === category ? 'page' : undefined}
            className={`whitespace-nowrap ${item === category ? 'border-ink' : ''}`}
            href={
              section === 'search' && query
                ? `/discover/${item}/search?q=${encodeURIComponent(query)}`
                : `/discover/${item}/${section}`
            }
            key={item}
            size="small"
          >
            {categoryLabels[item]}
          </Button>
        ))}
      </nav>
      <div className="mt-5 flex items-center gap-2 border-b border-line">
        <div className="-mb-px min-w-0 self-end">
          <Tabs
            items={[
              ...sections.map(({ id, label }) => ({
                active: id === section,
                href: `/discover/${category}/${id}`,
                label,
              })),
              ...(section === 'search' && query
                ? [{ active: true, href: `/discover/${category}/search?q=${encodeURIComponent(query)}`, label: `“${query}”` }]
                : []),
            ]}
            label="Discovery section"
          />
        </div>
        <Badge badgeContent={activeFilters} className="ml-auto shrink-0 sm:hidden" color="primary">
          <Button
            aria-controls="discover-filters"
            aria-expanded={filtersOpen}
            icon="filter"
            onClick={() => setFiltersOpen((current) => !current)}
            size="small"
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </Button>
        </Badge>
      </div>
      <form
        className={`mt-5 grid-cols-2 gap-3 sm:mt-6 sm:grid lg:grid-cols-6 ${filtersOpen ? 'grid' : 'hidden'}`}
        id="discover-filters"
        key={`${category}:${section}:${searchParams.toString()}`}
        onSubmit={apply}
      >
        {genres.loading ? (
          <div>
            <input name="genre" type="hidden" value={searchParams.get('genre') ?? ''} />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : (genres.data?.length ?? 0) > 0 && (
          <Select
            defaultValue={searchParams.get('genre') ?? ''}
            label="Genre"
            name="genre"
            options={[
              { value: '', label: 'Any genre' },
              ...(genres.data ?? []).map((genre) => ({ value: genre, label: genre })),
            ]}
          />
        )}
        <YearPicker defaultValue={searchParams.get('year') ?? ''} label="Year" name="year" />
        {statuses.length > 0 && (
          <Select
            defaultValue={searchParams.get('status') ?? ''}
            label="Status"
            name="status"
            options={[
              { value: '', label: 'Any status' },
              ...statuses.map(([value, label]) => ({ value, label })),
            ]}
          />
        )}
        <Select
          defaultValue={searchParams.get('sort') ?? ''}
          label="Sort"
          name="sort"
          options={[
            { value: '', label: section === 'search' ? 'Relevance' : 'Default' },
            ...sortOptions(category, section, activeSource).map(([value, label]) => ({ value, label })),
          ]}
        />
        {sources.length > 1 && (
          <Select
            defaultValue={source}
            label="Source"
            name="source"
            options={[
              { value: '', label: 'Default' },
              ...sources.map((item) => ({ value: item.key, label: item.displayName })),
            ]}
          />
        )}
        <div className="col-span-2 flex items-end gap-3 lg:col-span-1">
          <Button className="flex-1" type="submit" variant="primary">
            {section === 'search' ? 'Search' : 'Apply'}
          </Button>
          {hasFilters && (
            <Button
              className="mono-sm py-3"
              href={`/discover/${category}/${section}${query ? `?q=${encodeURIComponent(query)}` : ''}`}
              size="small"
              variant="text"
            >
              Clear
            </Button>
          )}
        </div>
      </form>
      {error && <Alert className="mt-6 max-w-3xl" severity="error">{error}</Alert>}
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
              <Alert className="mb-5" severity="info">
                The source is temporarily unavailable. Showing the most recent cached result.
              </Alert>
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
            <Pagination maxPages={500} page={results.data.page} pageHref={pageHref} totalPages={results.data.totalPages} />
          </section>
        )
      )}
    </div>
  );
}
