import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import {
  catalogCategories,
  categoryLabels,
  titleHref,
  type CatalogCategory,
  type CatalogResponse,
  type CatalogSection,
  type ConnectorDescriptor,
} from '../catalog';
import { CatalogCard } from '../components/CatalogCard';
import { Pagination } from '../components/Pagination';
import type { SourceSettings } from '../sources';
import { librarySourceKey, useLibraryEntries } from '../useLibraryEntries';

const sections: Array<{ id: CatalogSection; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
  { id: 'search', label: 'Search' },
];

const televisionStatuses = [
  ['returning', 'Returning'],
  ['planned', 'Planned'],
  ['production', 'In production'],
  ['ended', 'Ended'],
  ['canceled', 'Canceled'],
  ['pilot', 'Pilot'],
] as const;

const comicStatuses = [
  ['ongoing', 'Ongoing'],
  ['completed', 'Completed'],
  ['hiatus', 'Hiatus'],
  ['cancelled', 'Cancelled'],
] as const;

function statusOptions(category: CatalogCategory) {
  if (category === 'tv' || category === 'anime') return televisionStatuses;
  if (category === 'manga' || category === 'manhwa') return comicStatuses;
  return [];
}

function sortOptions(category: CatalogCategory) {
  if (category === 'movie') {
    return [
      ['popularity.desc', 'Popularity'],
      ['vote_average.desc', 'Rating'],
      ['primary_release_date.desc', 'Newest'],
    ] as const;
  }
  if (category === 'tv' || category === 'anime') {
    return [
      ['popularity.desc', 'Popularity'],
      ['vote_average.desc', 'Rating'],
      ['first_air_date.desc', 'Newest'],
    ] as const;
  }
  if (category === 'manga' || category === 'manhwa') {
    return [
      ['followedCount', 'Most followed'],
      ['latestUploadedChapter', 'Latest update'],
      ['relevance', 'Relevance'],
    ] as const;
  }
  return [];
}

function pageFrom(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1;
}

export function DiscoverPage({
  category,
  section,
}: {
  category: CatalogCategory;
  section: CatalogSection;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = pageFrom(searchParams.get('page'));
  const [result, setResult] = useState<CatalogResponse>();
  const [sources, setSources] = useState<ConnectorDescriptor[]>([]);
  const [preferredSource, setPreferredSource] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const library = useLibraryEntries();
  const source = section === 'search'
    ? searchParams.get('source') || preferredSource
    : preferredSource;
  const isRecentPreview = section === 'search' && query.length < 2;
  const availableStatuses = statusOptions(category);
  const availableSorts = sortOptions(category);

  useEffect(() => {
    const controller = new AbortController();
    const request = auth.accessToken
      ? apiRequest<SourceSettings>('/sources', { signal: controller.signal }, auth.accessToken)
          .then((settings) => {
            setSources(
              settings.sources
                .filter((item) => item.categories.includes(category))
                .map((item) => ({
                  ...item,
                  languages: [],
                  attribution: '',
                  capabilities: [],
                  outboundDomains: [],
                })),
            );
            const preferred = settings.categories[category] ?? settings.global ?? '';
            setPreferredSource(
              settings.sources.some(
                (item) =>
                  item.key === preferred &&
                  item.enabled &&
                  item.categories.includes(category),
              )
                ? preferred
                : '',
            );
          })
      : apiRequest<ConnectorDescriptor[]>(
          `/catalog/sources?category=${category}`,
          { signal: controller.signal },
        ).then(setSources);
    void request.catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : 'Could not load sources');
      }
    });
    return () => controller.abort();
  }, [auth.accessToken, category]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      page: String(isRecentPreview ? 1 : page),
    });
    if (section === 'search' && !isRecentPreview) {
      parameters.set('query', query);
      for (const key of ['genre', 'year', 'status', 'sort'] as const) {
        const value = searchParams.get(key);
        if (value) parameters.set(key, value);
      }
    }
    if (source) parameters.set('source', source);
    setResult(undefined);
    setBusy(true);
    setError('');
    void apiRequest<CatalogResponse>(
      `/catalog/${category}/${isRecentPreview ? 'recent' : section}?${parameters.toString()}`,
      { signal: controller.signal },
    )
      .then(setResult)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'Could not load titles');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [category, isRecentPreview, page, query, searchParams, section, source]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameters = new URLSearchParams({ page: '1' });
    for (const key of ['q', 'genre', 'year', 'status', 'source', 'sort']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) parameters.set(key, value);
    }
    navigate(`/discover/${category}/${section}?${parameters.toString()}`);
  }

  function pageHref(nextPage: number) {
    const parameters = new URLSearchParams(searchParams);
    parameters.set('page', String(nextPage));
    return `/discover/${category}/${section}?${parameters.toString()}`;
  }

  async function openFromUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get('url') ?? '').trim();
    try {
      const match = await apiRequest<{
        category: CatalogCategory;
        externalId: string;
        source: string;
      }>(`/catalog/recognize?url=${encodeURIComponent(url)}`);
      navigate(
        titleHref({
          category: match.category,
          externalId: match.externalId,
          source: match.source,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Source URL was not recognized');
    }
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Unified catalogue</p>
      <h1 className="page-title">Discover {categoryLabels[category].toLowerCase()}.</h1>
      <nav aria-label="Media categories" className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {catalogCategories.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `secondary-button whitespace-nowrap ${isActive ? 'border-ink text-ink' : ''}`
            }
            key={item}
            to={`/discover/${item}/recent`}
          >
            {categoryLabels[item]}
          </NavLink>
        ))}
      </nav>
      <nav aria-label="Discovery section" className="mt-5 flex gap-2 border-b border-line">
        {sections.map(({ id, label }) => (
          <NavLink
            className={({ isActive }) =>
              `border-b-2 px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                isActive
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`
            }
            key={id}
            to={`/discover/${category}/${id}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {section === 'search' && (
        <>
          <form
            className="mt-7 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
            key={`${category}:${searchParams.toString()}:${preferredSource}`}
            onSubmit={apply}
          >
            <label className="field-label sm:col-span-2">
              Title
              <input defaultValue={query} minLength={2} name="q" required />
            </label>
            <label className="field-label">
              Genre
              <input defaultValue={searchParams.get('genre') ?? ''} name="genre" placeholder="Any genre" />
            </label>
            <label className="field-label">
              Year
              <input defaultValue={searchParams.get('year') ?? ''} max="2200" min="1800" name="year" type="number" />
            </label>
            {availableStatuses.length > 0 && (
              <label className="field-label">
                Status
                <select defaultValue={searchParams.get('status') ?? ''} name="status">
                  <option value="">Any status</option>
                  {availableStatuses.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="field-label">
              Source
              <select defaultValue={searchParams.get('source') ?? preferredSource} name="source">
                <option value="">Default</option>
                {sources.filter((item) => item.enabled).map((item) => (
                  <option key={item.key} value={item.key}>{item.displayName}</option>
                ))}
              </select>
            </label>
            {availableSorts.length > 0 && (
              <label className="field-label">
                Sort
                <select defaultValue={searchParams.get('sort') ?? ''} name="sort">
                  <option value="">Default</option>
                  {availableSorts.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="primary-button self-end" disabled={busy} type="submit">
              {busy ? 'Loading…' : 'Apply'}
            </button>
          </form>
          <form className="mt-4 grid max-w-3xl gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]" onSubmit={openFromUrl}>
            <label className="field-label">
              Title URL
              <input name="url" placeholder="Paste a TMDB, MangaDex, IGDB, or RAWG URL" required type="url" />
            </label>
            <button className="secondary-button self-end" type="submit">Open from URL</button>
          </form>
        </>
      )}
      {busy && !result && <p className="mt-8 text-muted">Loading titles…</p>}
      {(error || library.error) && (
        <p className="error-message mt-5 max-w-3xl">{error || library.error}</p>
      )}
      {result?.stale && (
        <p className="mt-5 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
          The source is temporarily unavailable. Showing the most recent cached result.
        </p>
      )}
      {result && (
        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
            <h2 className="m-0 text-xl font-medium">
              {section === 'search' && !isRecentPreview
                ? `${result.totalResults.toLocaleString()} results`
                : section === 'recent' || isRecentPreview
                  ? 'Recently released'
                  : 'Popular now'}
            </h2>
            <span className="mono-sm text-faint">
              Data:{' '}
              {result.attributionUrl ? (
                <a className="rule-link" href={result.attributionUrl} rel="noreferrer" target="_blank">
                  {result.attribution}
                </a>
              ) : (
                result.attribution
              )}
            </span>
          </div>
          {result.results.length === 0 && (
            <div className="rounded-xl border border-dashed border-line p-8 text-center">
              <h3 className="m-0 text-xl font-medium">No titles found.</h3>
              <p className="mt-2 text-muted">
                {section === 'search' && !isRecentPreview
                  ? 'Try broader filters or another search.'
                  : 'No titles are available in this section yet.'}
              </p>
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {result.results.map((item) => {
              const itemKey = librarySourceKey(item.source, item.externalId);
              return (
                <CatalogCard
                  entry={library.bySource.get(itemKey) ?? null}
                  item={item}
                  key={itemKey}
                  libraryReady={library.ready}
                  onAdded={library.upsert}
                />
              );
            })}
          </div>
          {!isRecentPreview && (
            <Pagination page={result.page} pageHref={pageHref} totalPages={result.totalPages} />
          )}
        </section>
      )}
    </div>
  );
}
