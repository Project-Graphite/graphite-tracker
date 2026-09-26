import type { ReactNode } from 'react';
import { Link, NavLink, useParams, useSearchParams } from 'react-router';
import { useAdultBlur } from '../adultContent';
import type { Page } from '../api';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels, countLabel } from '../catalog';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { Poster, posterGridClass } from '../components/Poster';
import { ReviewCard } from '../components/ReviewCard';
import { ListSkeleton, PageSkeleton, PosterGridSkeleton } from '../components/Skeleton';
import {
  libraryStateLabels,
  libraryStates,
  progressSummary,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';
import { itemHref, type ItemSummary, type PublicReview } from '../reviews';
import { useResource } from '../useResource';

type Section = 'activity' | 'library' | 'ratings' | 'reviews';

interface Profile {
  handle: string;
  displayName: string;
  isPublic: boolean;
  bio?: string | null;
  sections?: Record<Section | 'statistics', boolean>;
  privateSections?: Array<Section | 'statistics'>;
  statistics?: {
    total: number;
    states: Partial<Record<LibraryState, number>>;
    categories: Record<string, number>;
    ratings: { count: number; average: number | null } | null;
  } | null;
}

interface Activity {
  id: string;
  kind: 'added' | 'state_changed' | 'rated' | 'reviewed';
  state: LibraryState | null;
  rating: number | null;
  createdAt: string;
  item: ItemSummary;
}

interface ProfileEntry {
  id: string;
  state: LibraryState;
  isPrivate: boolean;
  progress: Omit<LibraryEntry['progress'], 'platforms'>;
  rating: number | null;
  item: ItemSummary;
}

interface Rating {
  rating: number;
  updatedAt: string;
  item: ItemSummary;
}

export function OwnerTabs({ handle }: { handle: string }) {
  return (
    <nav aria-label="Your profile" className="mt-7 flex gap-2 border-b border-line">
      <NavLink className="tab-link -mb-px" end to={`/users/${handle}`}>
        Profile
      </NavLink>
      <NavLink className="tab-link -mb-px" to={`/users/${handle}/settings`}>
        Settings
      </NavLink>
    </nav>
  );
}

const sectionLabels: Record<Section, string> = {
  activity: 'Activity',
  library: 'Library',
  ratings: 'Ratings',
  reviews: 'Reviews',
};

function ItemLink({ item }: { item: ItemSummary }) {
  const href = itemHref(item);
  return href ? (
    <Link className="text-ink no-underline hover:underline" to={href}>
      {item.title}
    </Link>
  ) : (
    <span className="text-ink">{item.title}</span>
  );
}

function SectionPage<T>({
  children,
  filter = '',
  handle,
  section,
  skeleton = <ListSkeleton label="Loading" />,
}: {
  children: (results: T[]) => ReactNode;
  filter?: string;
  handle: string;
  section: Section;
  skeleton?: ReactNode;
}) {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const list = useResource<Page<T>>(
    auth.ready ? `/users/${handle}/${section}?page=${page}${filter}` : null,
    Boolean(auth.user),
  );

  if (list.error) return <p className="error-message mt-6">{list.error}</p>;
  if (!list.data) return <div className="mt-6">{skeleton}</div>;
  return (
    <div className="fade-in">
      {list.data.results.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        children(list.data.results)
      )}
      <Pagination
        page={list.data.page}
        pageHref={(next) => `/users/${handle}?tab=${section}&page=${next}${filter}`}
        totalPages={list.data.totalPages}
      />
    </div>
  );
}

function Row({ date, children }: { date: string; children: ReactNode }) {
  return (
    <li className="flex list-none items-baseline justify-between gap-4 border-b border-line-soft py-3">
      <span className="min-w-0 text-sm text-muted">{children}</span>
      <span className="mono-sm shrink-0 text-faint">{new Date(date).toLocaleDateString()}</span>
    </li>
  );
}

function ActivityList({ handle }: { handle: string }) {
  return (
    <SectionPage<Activity> handle={handle} section="activity">
      {(events) => (
        <ul className="m-0 p-0">
          {events.map((event) => {
            const state = event.state && stateLabel(event.item.category, event.state);
            return (
              <Row date={event.createdAt} key={event.id}>
                {event.kind === 'added'
                  ? `Added to ${state?.toLowerCase()}: `
                  : event.kind === 'state_changed'
                    ? `${state}: `
                    : event.kind === 'rated'
                      ? `Rated ${event.rating}/10: `
                      : 'Reviewed '}
                <ItemLink item={event.item} />
              </Row>
            );
          })}
        </ul>
      )}
    </SectionPage>
  );
}

function LibraryGrid({ handle }: { handle: string }) {
  const [searchParams] = useSearchParams();
  const blur = useAdultBlur();
  const state = libraryStates.find((value) => value === searchParams.get('state'));
  return (
    <>
      <nav aria-label="Library lists" className="mono-sm mb-6 flex flex-wrap gap-x-4 gap-y-2">
        {[undefined, ...libraryStates].map((value) => (
          <Link
            aria-current={value === state ? 'page' : undefined}
            className={value === state ? 'text-ink no-underline' : 'text-muted no-underline hover:text-ink'}
            key={value ?? 'all'}
            to={`/users/${handle}?tab=library${value ? `&state=${value}` : ''}`}
          >
            {value ? libraryStateLabels[value].toLowerCase() : 'all'}
          </Link>
        ))}
      </nav>
      <SectionPage<ProfileEntry>
        filter={state ? `&state=${state}` : ''}
        handle={handle}
        key={state}
        section="library"
        skeleton={<PosterGridSkeleton label="Loading library" />}
      >
        {(entries) => (
          <div className={posterGridClass}>
            {entries.map((entry) => (
              <article className="min-w-0" key={entry.id}>
                <Poster
                  blurred={blur(entry.item.adult)}
                  href={itemHref(entry.item)}
                  posterUrl={entry.item.posterUrl}
                  title={entry.item.title}
                />
                <h3 className="mt-3 mb-0 line-clamp-2 text-sm font-medium">
                  <ItemLink item={entry.item} />
                </h3>
                <p className="mt-1 mb-0 text-sm text-muted">
                  {[
                    stateLabel(entry.item.category, entry.state),
                    progressSummary(entry.progress),
                    entry.rating !== null && `${entry.rating}/10`,
                    entry.isPrivate && 'private',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </article>
            ))}
          </div>
        )}
      </SectionPage>
    </>
  );
}

function RatingsList({ handle }: { handle: string }) {
  return (
    <SectionPage<Rating> handle={handle} section="ratings">
      {(ratings) => (
        <ul className="m-0 p-0">
          {ratings.map((rating) => (
            <Row date={rating.updatedAt} key={rating.item.id}>
              {`${rating.rating}/10 · `}
              <ItemLink item={rating.item} />
            </Row>
          ))}
        </ul>
      )}
    </SectionPage>
  );
}

function ReviewsList({ handle }: { handle: string }) {
  return (
    <SectionPage<PublicReview & { item: ItemSummary }> handle={handle} section="reviews">
      {(reviews) => reviews.map((review) => <ReviewCard item={review.item} key={review.id} review={review} />)}
    </SectionPage>
  );
}

const sectionViews: Record<Section, (props: { handle: string }) => ReactNode> = {
  activity: ActivityList,
  library: LibraryGrid,
  ratings: RatingsList,
  reviews: ReviewsList,
};

function Statistics({
  hiddenFromPublic,
  statistics,
}: {
  hiddenFromPublic: boolean;
  statistics: NonNullable<Profile['statistics']>;
}) {
  const figure = (value: string, label: string) => (
    <p className="m-0" key={label}>
      <strong className="text-2xl font-medium">{value}</strong>{' '}
      <span className="mono-sm text-faint">{label}</span>
    </p>
  );
  return (
    <section aria-label="Statistics" className="mt-8 grid gap-4 border-y border-line py-5">
      {hiddenFromPublic && <p className="mono-sm m-0 text-faint">statistics · private</p>}
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {figure(statistics.total.toLocaleString(), 'titles')}
        {libraryStates.map((state) =>
          figure((statistics.states[state] ?? 0).toLocaleString(), libraryStateLabels[state].toLowerCase()),
        )}
        {statistics.ratings &&
          figure(
            statistics.ratings.average?.toFixed(1) ?? '—',
            `average of ${countLabel(statistics.ratings.count, 'rating')}`,
          )}
      </div>
      <p className="mono-sm m-0 text-faint">
        {catalogCategories
          .filter((category) => statistics.categories[category])
          .map((category) => `${categoryLabels[category]} ${statistics.categories[category]}`)
          .join(' · ')}
      </p>
    </section>
  );
}

export function ProfilePage() {
  const { handle = '' } = useParams();
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const profile = useResource<Profile>(
    auth.ready ? `/users/${encodeURIComponent(handle.toLowerCase())}` : null,
    Boolean(auth.user),
  );

  if (profile.error) {
    return profile.status === 404 ? (
      <EmptyState title="Profile not found">
        <p className="mt-2 mb-0 text-muted">No account uses @{handle}.</p>
      </EmptyState>
    ) : (
      <p className="error-message">{profile.error}</p>
    );
  }
  if (!profile.data) return <PageSkeleton label="Loading profile" />;
  const { data } = profile;
  const visible = (Object.keys(sectionLabels) as Section[]).filter(
    (section) => data.sections?.[section],
  );
  const tab = visible.find((section) => section === searchParams.get('tab')) ?? visible[0];
  const View = tab && sectionViews[tab];

  return (
    <div className="page-enter">
      <p className="eyebrow">@{data.handle}</p>
      <h1 className="page-title">{data.displayName}</h1>
      {auth.user?.handle === data.handle && (
        <>
          <OwnerTabs handle={data.handle} />
          <p className="notice mt-5 max-w-3xl">
            This is how other people see your profile.{' '}
            <Link className="rule-link" to={`/users/${data.handle}/settings`}>
              Change what is shown
            </Link>
          </p>
        </>
      )}
      {data.privateSections && (
        <p className="notice mt-5 max-w-3xl">
          {data.isPublic
            ? 'You see every section because you are an administrator. Sections marked private are hidden from everyone else.'
            : 'This profile is private. You see it because you are an administrator; everyone else sees only the display name.'}
        </p>
      )}
      {!data.isPublic && !data.privateSections ? (
        <p className="mt-6 text-muted">This profile is private.</p>
      ) : (
        <>
          {data.bio && <p className="mt-5 max-w-2xl whitespace-pre-line text-muted">{data.bio}</p>}
          {data.statistics && (
            <Statistics
              hiddenFromPublic={data.privateSections?.includes('statistics') ?? false}
              statistics={data.statistics}
            />
          )}
          {View ? (
            <>
              <nav aria-label="Profile sections" className="mt-10 mb-6 flex gap-2 overflow-x-auto border-b border-line">
                {visible.map((section) => (
                  <Link
                    aria-current={section === tab ? 'page' : undefined}
                    className="tab-link"
                    key={section}
                    to={`/users/${data.handle}?tab=${section}`}
                  >
                    {sectionLabels[section]}
                    {data.privateSections?.includes(section) && (
                      <span className="mono-sm font-normal text-faint"> · private</span>
                    )}
                  </Link>
                ))}
              </nav>
              <View handle={data.handle} />
            </>
          ) : (
            !data.statistics && (
              <p className="mt-8 text-muted">Nothing on this profile is public yet.</p>
            )
          )}
        </>
      )}
    </div>
  );
}
