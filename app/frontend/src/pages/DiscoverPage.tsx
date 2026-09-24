import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';
import { apiRequest, errorMessage } from '../api';
import { useAuth } from '../auth';
import {
  categoryLabels,
  countLabel,
  discoverCategories,
  titleHref,
  type CatalogCategory,
  type CatalogResponse,
  type CatalogSection,
  type ConnectorDescriptor,
  type DiscoverCategory,
} from '../catalog';
import { Attribution } from '../components/Attribution';
import { CatalogGrid } from '../components/CatalogCard';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import type { SourceSettings } from '../sources';
import { useResource } from '../useResource';

const sections: Array<{ id: CatalogSection; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
  { id: 'search', label: 'Search' },
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
  const [searchParams] = useSearchParams();
  const [urlError, setUrlError] = useState('');
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
  const statuses = statusOptions(category, section);
  const hasFilters = filterKeys.some((key) => searchParams.get(key));

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['q', ...filterKeys]) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    navigate(`/discover/${category}/${section}?${next.toString()}`);
  }

  function pageHref(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    return `/discover/${category}/${section}?${next.toString()}`;
  }

  async function openFromUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUrlError('');
    const url = String(new FormData(event.currentTarget).get('url')).trim();
    try {
      navigate(
        titleHref(
          await apiRequest<{ category: CatalogCategory; externalId: string; source: string }>(
            `/catalog/recognize?url=${encodeURIComponent(url)}`,
          ),
        ),
      );
    } catch (reason) {
      setUrlError(errorMessage(reason, 'This link was not recognized'));
    }
  }

  const error = settings.error || publicSources.error || genres.error || results.error;

  return (
    <div className="page-enter">
      <p className="eyebrow">Unified catalogue</p>
      <h1 className="page-title">Discover {categoryLabels[category]}</h1>
      <nav aria-label="Media categories" className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {discoverCategories.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `secondary-button px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'border-ink' : ''}`
            }
            key={item}
            to={`/discover/${item}/${section}`}
          >
            {categoryLabels[item]}
          </NavLink>
        ))}
      </nav>
      <nav aria-label="Discovery section" className="mt-5 flex gap-2 border-b border-line">
        {sections.map(({ id, label }) => (
          <NavLink
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`
            }
            key={id}
            to={`/discover/${category}/${id}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        key={`${category}:${section}:${searchParams.toString()}`}
        onSubmit={apply}
      >
        {section === 'search' && (
          <label className="field-label sm:col-span-2">
            Title
            <input defaultValue={query} minLength={2} name="q" placeholder="Search by title" required />
          </label>
        )}
        {(genres.data?.length ?? 0) > 0 && (
          <label className="field-label">
            Genre
            <select defaultValue={searchParams.get('genre') ?? ''} name="genre">
              <option value="">Any genre</option>
              {genres.data?.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field-label">
          Year
          <input
            defaultValue={searchParams.get('year') ?? ''}
            max="2200"
            min="1800"
            name="year"
            placeholder="Any year"
            type="number"
          />
        </label>
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
        <div className="flex items-end gap-3">
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
      {section === 'search' && (
        <form className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => void openFromUrl(event)}>
          <label className="field-label">
            Open from a source link
            <input name="url" placeholder="Paste a TMDB, MangaDex, IGDB or RAWG link" required type="url" />
          </label>
          <button className="secondary-button self-end" type="submit">Open</button>
          {urlError && <p className="error-message m-0 sm:col-span-2">{urlError}</p>}
        </form>
      )}
      {error && <p className="error-message mt-6 max-w-3xl">{error}</p>}
      {section === 'search' && query.length < 2 ? (
        <div className="mt-10">
          <EmptyState title={`Search ${categoryLabels[category]}`}>
            <p className="mt-2 mb-0 text-muted">Enter at least two characters of a title.</p>
          </EmptyState>
        </div>
      ) : results.loading || !sourcesReady ? (
        <p className="mt-10 text-muted">Loading titles…</p>
      ) : (
        results.data && (
          <section className="mt-10">
            {results.data.stale && (
              <p className="notice mb-5">
                The source is temporarily unavailable. Showing the most recent cached result.
              </p>
            )}
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
              <h2 className="m-0 text-xl font-medium">
                {section === 'search'
                  ? `${countLabel(results.data.totalResults, 'result')} for “${query}”`
                  : section === 'recent'
                    ? 'Recently released'
                    : 'Popular now'}
              </h2>
              <Attribution source={results.data} />
            </div>
            {results.data.results.length === 0 ? (
              <EmptyState title="No titles found">
                <p className="mt-2 mb-0 text-muted">Try broader filters or another search.</p>
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
