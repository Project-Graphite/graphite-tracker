import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useAdultBlur } from '../adultContent';
import { useAuth } from '../auth';
import {
  catalogCategories,
  catalogRef,
  categoryLabels,
  countLabel,
  titleHref,
  type CatalogDetails,
} from '../catalog';
import { AddToListButton } from '../components/CatalogCard';
import { Credits } from '../components/Credits';
import { EmptyState } from '../components/EmptyState';
import { LibraryEntryEditor } from '../components/LibraryEntryEditor';
import { Poster } from '../components/Poster';
import { SmoothImage } from '../components/SmoothImage';
import { Placeholder, Skeleton, TitleSkeleton } from '../components/Skeleton';
import { TitleReviews } from '../components/TitleReviews';
import { useFooterSource } from '../footerSource';
import { useSiteSettings } from '../site';
import type { LibraryEntry } from '../library';
import { useResource, type Resource } from '../useResource';

function LibraryPanel({
  item,
  lookup,
}: {
  item: CatalogDetails;
  lookup: Resource<LibraryEntry[]>;
}) {
  const auth = useAuth();
  const entry = lookup.data?.[0] ?? null;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="m-0 text-lg font-medium">Your library</h2>
      <div className="mt-4">
        {!auth.ready || lookup.loading ? (
          <Placeholder label="Loading your library entry">
            <Skeleton className="h-12 rounded-lg" />
          </Placeholder>
        ) : !auth.user ? (
          <p className="m-0 text-sm text-muted">
            <Link className="rule-link" to="/login">Sign in</Link> to track this title.
          </p>
        ) : lookup.error ? (
          <p className="error-message m-0">{lookup.error}</p>
        ) : entry ? (
          <LibraryEntryEditor
            entry={entry}
            onChange={(next) => lookup.mutate(() => [next])}
            onRemove={() => lookup.mutate(() => [])}
          />
        ) : (
          <AddToListButton
            className="primary-button w-full"
            entry={null}
            item={item}
            libraryReady
            onAdded={(added) => lookup.mutate(() => [added])}
          />
        )}
      </div>
    </section>
  );
}

function Facts({ item }: { item: CatalogDetails }) {
  const counts = [
    ['seasonCount', 'season'],
    ['episodeCount', 'episode'],
    ['volumeCount', 'volume'],
  ] as const;
  return (
    <div className="mono-sm mt-5 flex flex-wrap gap-x-5 gap-y-2 text-faint">
      {item.status && <span>{item.status}</span>}
      {item.runtimeMinutes ? <span>{item.runtimeMinutes} minutes</span> : null}
      {counts.map(([key, noun]) => {
        const value = item[key];
        return value === undefined ? null : (
          <span key={key}>{value === null ? `? ${noun}s` : countLabel(value, noun)}</span>
        );
      })}
      {item.chapterCount !== undefined && (
        <span>
          {item.chapterCount === null ? 'latest chapter unknown' : `latest chapter ${item.chapterCount}`}
        </span>
      )}
      <span>{item.language.toUpperCase()}</span>
    </div>
  );
}

export function TitleDetailsPage() {
  const auth = useAuth();
  const blur = useAdultBlur();
  const site = useSiteSettings();
  const [revealed, setRevealed] = useState(false);
  const { category: categoryParam, externalId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const category = catalogCategories.find((item) => item === categoryParam);
  const details = useResource<CatalogDetails>(
    category
      ? `/catalog/${category}/${encodeURIComponent(externalId)}${source ? `?source=${encodeURIComponent(source)}` : ''}`
      : null,
  );
  const lookup = useResource<LibraryEntry[]>(
    auth.user && details.data
      ? `/library/lookup?refs=${encodeURIComponent(catalogRef(details.data))}`
      : null,
    true,
  );
  const entry = !auth.user ? null : lookup.data ? (lookup.data[0] ?? null) : undefined;
  useFooterSource(
    details.data && {
      attribution: details.data.attribution,
      attributionUrl: details.data.attributionUrl,
      links: [
        ...(details.data.deepLinks ?? []),
        ...(entry?.item.sources ?? []).flatMap((attached) =>
          attached.key !== details.data?.source && attached.url
            ? [{ label: `View on ${attached.name}`, url: attached.url }]
            : [],
        ),
      ],
    },
  );

  if (!category) {
    return <Navigate replace to="/discover/movie/recent" />;
  }
  const backHref = category === 'game' ? '/games' : `/discover/${category}/recent`;
  const back = (
    <Link className="rule-link mono-sm" to={backHref}>
      Back to {categoryLabels[category]}
    </Link>
  );
  const item = details.data;
  const hidden = blur(item?.adult) && !revealed;

  if (details.error) {
    return (
      <div className="page-enter">
        {back}
        {details.status === 404 ? (
          <div className="mt-6">
            <EmptyState title="Title not found">
              <p className="mt-2 mb-0 text-muted">
                {site.data?.adultContentEnabled === false ? (
                  'This title is not available from its source, or it is adult content, which Graphite Tracker does not show.'
                ) : (
                  <>
                    This title is not available from its source, or it is adult content hidden by your{' '}
                    <Link className="rule-link" to="/settings">content settings</Link>.
                  </>
                )}
              </p>
            </EmptyState>
          </div>
        ) : (
          <p className="error-message mt-6 max-w-2xl">{details.error}</p>
        )}
      </div>
    );
  }
  if (!item) return <TitleSkeleton backdrop={category !== 'manga' && category !== 'manhwa'} />;

  return (
    <article className="page-enter">
      {back}
      {item.stale && (
        <p className="notice mt-5">This source is unavailable. Showing cached details.</p>
      )}
      {item.backdropUrl && (
        <div
          className={`relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-line-soft sm:mt-6 md:aspect-[16/6] ${hidden ? 'poster-blurred' : ''}`}
        >
          <SmoothImage alt="" key={item.backdropUrl} src={item.backdropUrl} />
        </div>
      )}
      <div className="mt-6 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-6 sm:mt-8 md:grid-cols-[14rem_1fr] md:gap-x-8">
        <Poster
          blurred={hidden}
          className="col-start-1 row-start-1 md:row-span-2"
          posterUrl={item.posterUrl}
          title={item.title}
        />
        <header className="col-start-2 row-start-1 min-w-0 self-end md:self-start">
          <p className="eyebrow">
            {categoryLabels[item.category]} · {item.releaseDate?.slice(0, 4) ?? 'date unknown'}
            {item.adult && ' · 18+'}
            {blur(item.adult) && (
              <>
                {' · '}
                <button
                  className="text-button mono-sm"
                  onClick={() => setRevealed((current) => !current)}
                  type="button"
                >
                  {revealed ? 'hide artwork' : 'show artwork'}
                </button>
              </>
            )}
          </p>
          <h1 className="page-title break-words max-md:text-[1.55rem]">{item.title}</h1>
          {item.originalTitle !== item.title && (
            <p className="mt-2 mb-0 text-muted md:mt-3">{item.originalTitle}</p>
          )}
        </header>
        <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2">
          {item.alternateTitles && item.alternateTitles.length > 0 && (
            <p className="mono-sm mt-0 mb-0 text-faint">
              Also known as {item.alternateTitles.slice(0, 6).join(' · ')}
            </p>
          )}
          {item.tagline && <p className="mt-6 mb-0 text-lg text-muted">{item.tagline}</p>}
          <div className="mt-5 flex flex-wrap items-baseline gap-2 border-y border-line py-4 md:mt-6">
            {item.rating ? (
              <>
                <strong className="text-2xl font-medium">{item.rating.toFixed(1)}</strong>
                <span className="mono-sm text-faint">
                  / 10 from {countLabel(item.ratingCount, 'source rating')}
                </span>
              </>
            ) : (
              <span className="mono-sm text-faint">No source rating</span>
            )}
          </div>
          <Facts item={item} />
          {item.genres.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.genres.map((genre) => (
                <span className="rounded-full border border-line px-3 py-1 text-sm text-muted" key={genre}>
                  {genre}
                </span>
              ))}
            </div>
          )}
          {item.trailers && item.trailers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {item.trailers.map((trailer, index) => (
                <a
                  className={`${index === 0 ? 'primary-button' : 'secondary-button'} inline-flex gap-2`}
                  href={trailer.url}
                  key={trailer.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
                    <path d="M7 4.5v15l12.5-7.5z" />
                  </svg>
                  {index === 0 ? 'Watch trailer' : trailer.name}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2 row-start-3 md:col-span-1 md:col-start-1">
          <LibraryPanel item={item} lookup={lookup} />
        </div>
        <div className="col-span-2 row-start-4 min-w-0 md:col-span-1 md:col-start-2 md:row-start-3">
          <section>
            <h2 className="m-0 text-xl font-medium">Overview</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-muted">
              {item.synopsis || 'No synopsis available.'}
            </p>
          </section>
          <Credits item={item} />
          {item.platforms && item.platforms.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Platforms</h2>
              <p className="mt-3 text-muted">{item.platforms.join(' · ')}</p>
            </section>
          )}
          {item.releaseDates && item.releaseDates.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Platform releases</h2>
              <ul className="mt-3 grid gap-2 pl-0 text-sm text-muted">
                {item.releaseDates.map((release, index) => (
                  <li className="list-none" key={`${release.date}:${release.platform}:${index}`}>
                    <span className="mono-sm text-faint">{release.date}</span> ·{' '}
                    {release.platform ?? 'Platform unknown'}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {item.relationships && item.relationships.length > 0 && (
            <section className="mt-8">
              <h2 className="m-0 text-xl font-medium">Related games</h2>
              <ul className="mt-3 grid gap-2 pl-0 text-sm text-muted">
                {item.relationships.map((relationship) => (
                  <li className="list-none" key={`${relationship.type}:${relationship.externalId}`}>
                    <span className="mono-sm text-faint">{relationship.type}</span> ·{' '}
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
          <TitleReviews entry={entry} item={item} />
        </div>
      </div>
    </article>
  );
}
