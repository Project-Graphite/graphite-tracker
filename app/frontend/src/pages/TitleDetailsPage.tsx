import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import {
  catalogCategories,
  categoryLabels,
  countLabel,
  titleHref,
  type CatalogDetails,
} from '../catalog';
import { AddToListButton } from '../components/CatalogCard';
import {
  libraryStateLabels,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';

export function TitleDetailsPage() {
  const auth = useAuth();
  const { category: categoryParam, externalId = '' } = useParams<{
    category: string;
    externalId: string;
  }>();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') ?? undefined;
  const category = catalogCategories.find((item) => item === categoryParam);
  const [item, setItem] = useState<CatalogDetails>();
  const [libraryEntry, setLibraryEntry] = useState<LibraryEntry | null>();
  const [error, setError] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);

  useEffect(() => {
    if (!category || !externalId) return;
    const controller = new AbortController();
    setItem(undefined);
    setError('');
    const parameters = source ? `?source=${encodeURIComponent(source)}` : '';
    void apiRequest<CatalogDetails>(
      `/catalog/${category}/${encodeURIComponent(externalId)}${parameters}`,
      { signal: controller.signal },
    )
      .then(setItem)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'Could not load title');
        }
      });
    return () => controller.abort();
  }, [category, externalId, source]);

  useEffect(() => {
    if (!auth.ready || !auth.accessToken || !item) {
      if (auth.ready && !auth.user) setLibraryEntry(null);
      return;
    }
    const controller = new AbortController();
    setLibraryEntry(undefined);
    void apiRequest<LibraryEntry | null>(
      `/library/source/${encodeURIComponent(item.source)}/${encodeURIComponent(item.externalId)}`,
      { signal: controller.signal },
      auth.accessToken,
    )
      .then(setLibraryEntry)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'Could not load library state');
        }
      });
    return () => controller.abort();
  }, [auth.accessToken, auth.ready, auth.user, item]);

  if (!category) {
    return <Navigate replace to="/discover/movie/recent" />;
  }
  const backHref = category === 'game'
    ? '/games'
    : `/discover/${category}/recent`;

  async function update(state: LibraryState) {
    if (!auth.accessToken || !libraryEntry) return;
    setLibraryBusy(true);
    try {
      setLibraryEntry(
        await apiRequest<LibraryEntry>(
          `/library/${libraryEntry.id}`,
          { method: 'PATCH', body: JSON.stringify({ state }) },
          auth.accessToken,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update library state');
    } finally {
      setLibraryBusy(false);
    }
  }

  if (error && !item) {
    return (
      <div className="page-enter">
        <Link className="rule-link mono-sm" to={backHref}>Back to {categoryLabels[category]}</Link>
        <p className="error-message mt-6 max-w-2xl">{error}</p>
      </div>
    );
  }

  if (!item) return <p className="text-muted">Loading title…</p>;

  return (
    <article className="page-enter">
      <Link className="rule-link mono-sm" to={backHref}>Back to {categoryLabels[category]}</Link>
      {item.stale && (
        <p className="mt-5 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
          This source is unavailable. Showing cached details.
        </p>
      )}
      {item.backdropUrl && (
        <div className="mt-6 aspect-[16/6] overflow-hidden rounded-2xl border border-line bg-line-soft">
          <img className="h-full w-full object-cover" src={item.backdropUrl} alt="" />
        </div>
      )}
      <div className="mt-8 grid gap-8 md:grid-cols-[14rem_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-xl border border-line bg-line-soft">
          {item.posterUrl ? (
            <img className="h-full w-full object-cover" src={item.posterUrl} alt={`Poster for ${item.title}`} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-faint">No poster</div>
          )}
        </div>
        <div>
          <p className="eyebrow">{categoryLabels[item.category]} · {item.releaseDate?.slice(0, 4) ?? 'Date unknown'}</p>
          <h1 className="page-title">{item.title}</h1>
          {item.originalTitle !== item.title && <p className="mt-3 text-muted">{item.originalTitle}</p>}
          {item.alternateTitles && item.alternateTitles.length > 0 && (
            <p className="mono-sm mt-2 text-faint">Also known as {item.alternateTitles.join(' · ')}</p>
          )}
          {item.tagline && <p className="mt-6 text-lg text-muted">{item.tagline}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4 border-y border-line py-4">
            <div className="flex items-baseline gap-2">
              <strong className="text-2xl font-medium">{item.rating ? item.rating.toFixed(1) : '—'}</strong>
              <span className="mono-sm text-faint">/ 10 · {countLabel(item.ratingCount, 'rating')}</span>
            </div>
            {auth.ready && auth.user && libraryEntry === undefined && <span className="mono-sm text-faint">Loading list state…</span>}
            {auth.ready && auth.user && libraryEntry && (
              <select
                aria-label="Library state"
                className="compact-control"
                disabled={libraryBusy}
                onChange={(event) => void update(event.target.value as LibraryState)}
                value={libraryEntry.state}
              >
                {(Object.keys(libraryStateLabels) as LibraryState[]).map((state) => (
                  <option key={state} value={state}>{stateLabel(item.category, state)}</option>
                ))}
              </select>
            )}
            {auth.ready && auth.user && libraryEntry === null && (
              <AddToListButton
                className="secondary-button compact-button inline-flex"
                entry={libraryEntry}
                item={item}
                libraryReady
                onAdded={setLibraryEntry}
              />
            )}
          </div>
          <div className="mono-sm mt-5 flex flex-wrap gap-x-5 gap-y-2 text-faint">
            {item.status && <span>{item.status}</span>}
            {item.runtimeMinutes ? <span>{item.runtimeMinutes} minutes</span> : null}
            {item.seasonCount !== undefined && <span>{item.seasonCount === null ? '? seasons' : countLabel(item.seasonCount, 'season')}</span>}
            {item.episodeCount !== undefined && <span>{item.episodeCount === null ? '? episodes' : countLabel(item.episodeCount, 'episode')}</span>}
            {item.chapterCount !== undefined && <span>{item.chapterCount === null ? '? chapters' : countLabel(item.chapterCount, 'chapter')}</span>}
            {item.volumeCount !== undefined && <span>{item.volumeCount === null ? '? volumes' : countLabel(item.volumeCount, 'volume')}</span>}
            <span>{item.language.toUpperCase()}</span>
          </div>
          {item.genres.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.genres.map((genre) => <span className="rounded-full border border-line px-3 py-1 text-sm text-muted" key={genre}>{genre}</span>)}
            </div>
          )}
          <section className="mt-8">
            <h2 className="m-0 text-xl font-medium">Overview</h2>
            <p className="mt-3 max-w-3xl text-muted">{item.synopsis || 'No synopsis available.'}</p>
          </section>
          {item.platforms && item.platforms.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Platforms</h2>
              <p className="mt-3 text-muted">{item.platforms.join(' · ')}</p>
            </section>
          )}
          {item.releaseDates && item.releaseDates.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Platform releases</h2>
              <ul className="mt-3 grid gap-2 text-sm text-muted">
                {item.releaseDates.map((release, index) => (
                  <li key={`${release.date}:${release.platform}:${index}`}>{release.date} · {release.platform ?? 'Platform unknown'}</li>
                ))}
              </ul>
            </section>
          )}
          {item.relationships && item.relationships.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Related games</h2>
              <ul className="mt-3 grid gap-2 text-sm text-muted">
                {item.relationships.map((relationship) => (
                  <li key={`${relationship.type}:${relationship.externalId}`}>
                    {relationship.type}:{' '}
                    {relationship.type === 'franchise' ? (
                      relationship.title
                    ) : (
                      <Link
                        className="rule-link"
                        to={titleHref({ category: 'game', externalId: relationship.externalId, source: item.source })}
                      >
                        {relationship.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {item.deepLinks && item.deepLinks.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {item.deepLinks.map((link) => (
                <a className="secondary-button" href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label}</a>
              ))}
            </div>
          )}
          {error && <p className="error-message mt-5 max-w-2xl">{error}</p>}
          <p className="mono-sm mt-8 text-faint">
            Data:{' '}
            {item.attributionUrl ? (
              <a className="rule-link" href={item.attributionUrl} rel="noreferrer" target="_blank">
                {item.attribution}
              </a>
            ) : (
              item.attribution
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
