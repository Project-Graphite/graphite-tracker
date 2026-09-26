import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { errorMessage, type Page } from '../api';
import { useAuth } from '../auth';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { itemHref, reportReasons, type ItemSummary } from '../reviews';
import { useResource, type Resource } from '../useResource';

interface ModeratedReview {
  id: string;
  author: { handle: string; displayName: string };
  rating: number | null;
  title: string | null;
  body: string | null;
  containsSpoilers: boolean;
  visibility: 'public' | 'private';
  hidden: boolean;
  openReports: number;
  updatedAt: string;
  item: ItemSummary;
}

interface Report {
  id: string;
  reason: keyof typeof reportReasons;
  createdAt: string;
  resolution: 'dismissed' | 'hidden' | null;
  resolvedAt: string | null;
  reporter: { handle: string; displayName: string };
  moderator: string | null;
  review: ModeratedReview;
}

interface Account {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  verifiedAt: string | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface FailedNotification {
  id: string;
  user: { handle: string; displayName: string };
  release: string;
  error: string | null;
  createdAt: string;
  item: ItemSummary;
}

const tabs = {
  reports: 'Reports',
  reviews: 'Reviews',
  users: 'Users',
  notifications: 'Notifications',
} as const;
type Tab = keyof typeof tabs;

function ReviewBlock({ review }: { review: ModeratedReview }) {
  const href = itemHref(review.item);
  return (
    <div className="grid gap-2">
      <p className="mono-sm m-0 text-faint">
        <Link className="rule-link" to={`/users/${review.author.handle}`}>
          {review.author.displayName}
        </Link>{' '}
        on {href ? <Link className="rule-link" to={href}>{review.item.title}</Link> : review.item.title}
        {review.rating !== null && ` · ${review.rating}/10`}
        {review.visibility === 'private' && ' · private'}
        {review.containsSpoilers && ' · marked as spoilers'}
        {review.hidden && ' · hidden'}
      </p>
      {review.title && <h3 className="m-0 text-base font-medium">{review.title}</h3>}
      <p className="m-0 max-w-3xl whitespace-pre-line text-sm text-muted">{review.body}</p>
    </div>
  );
}

function Listing<T>({
  children,
  resource,
  pageHref,
}: {
  children: (results: T[]) => ReactNode;
  resource: Resource<Page<T>>;
  pageHref: (page: number) => string;
}) {
  if (resource.error) return <p className="error-message">{resource.error}</p>;
  if (!resource.data) return <p className="text-muted">Loading…</p>;
  return resource.data.results.length === 0 ? (
    <EmptyState title="Nothing to show" />
  ) : (
    <>
      <ul className="m-0 p-0">{children(resource.data.results)}</ul>
      <Pagination page={resource.data.page} pageHref={pageHref} totalPages={resource.data.totalPages} />
    </>
  );
}

function Filter({ options, value, tab }: { options: string[]; value: string; tab: Tab }) {
  return (
    <nav aria-label="Filter" className="mono-sm mb-5 flex gap-4">
      {options.map((option) => (
        <Link
          aria-current={option === value ? 'page' : undefined}
          className={option === value ? 'text-ink no-underline' : 'text-muted no-underline hover:text-ink'}
          key={option}
          to={`/admin?tab=${tab}&status=${option}`}
        >
          {option}
        </Link>
      ))}
    </nav>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const tab = (Object.keys(tabs) as Tab[]).find((key) => key === searchParams.get('tab')) ?? 'reports';
  const page = Number(searchParams.get('page')) || 1;
  const query = searchParams.get('query') ?? '';
  const status =
    searchParams.get('status') ?? (tab === 'reports' ? 'open' : tab === 'reviews' ? 'public' : '');
  const path =
    tab === 'users'
      ? `/admin/users?page=${page}${query ? `&query=${encodeURIComponent(query)}` : ''}`
      : tab === 'notifications'
        ? `/admin/notifications?page=${page}`
        : `/admin/${tab}?status=${status}&page=${page}`;
  const reports = useResource<Page<Report>>(tab === 'reports' ? path : null, true);
  const reviews = useResource<Page<ModeratedReview>>(tab === 'reviews' ? path : null, true);
  const users = useResource<Page<Account>>(tab === 'users' ? path : null, true);
  const notifications = useResource<Page<FailedNotification>>(tab === 'notifications' ? path : null, true);
  const pageHref = (next: number) => {
    const parameters = new URLSearchParams(searchParams);
    parameters.set('page', String(next));
    return `/admin?${parameters.toString()}`;
  };

  async function act(target: string, body: object, reload: () => void) {
    setError('');
    try {
      await auth.request(target, { method: 'PATCH', body: JSON.stringify(body) });
      reload();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save this change'));
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('query')).trim();
    navigate(`/admin?tab=users${value ? `&query=${encodeURIComponent(value)}` : ''}`);
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">Moderation</p>
      <h1 className="page-title">Admin</h1>
      <nav aria-label="Admin sections" className="mt-7 mb-6 flex gap-2 overflow-x-auto border-b border-line">
        {(Object.entries(tabs) as Array<[Tab, string]>).map(([key, label]) => (
          <Link
            aria-current={key === tab ? 'page' : undefined}
            className={`border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap no-underline ${
              key === tab ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
            key={key}
            to={`/admin?tab=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && <p className="error-message mb-5">{error}</p>}
      {tab === 'reports' && (
        <>
          <Filter options={['open', 'resolved']} tab={tab} value={status} />
          <Listing pageHref={pageHref} resource={reports}>
            {(results) =>
              results.map((report) => (
                <li className="grid list-none gap-3 border-b border-line-soft py-5" key={report.id}>
                  <p className="mono-sm m-0 text-faint">
                    {reportReasons[report.reason]} · reported by @{report.reporter.handle} on{' '}
                    {new Date(report.createdAt).toLocaleDateString()}
                    {report.resolution &&
                      ` · ${report.resolution === 'hidden' ? 'review hidden' : 'dismissed'}${report.moderator ? ` by @${report.moderator}` : ''}`}
                  </p>
                  <ReviewBlock review={report.review} />
                  {!report.resolution && (
                    <div className="flex gap-3">
                      <button
                        className="primary-button px-3 py-2 text-sm"
                        onClick={() => void act(`/admin/reports/${report.id}`, { resolution: 'hidden' }, reports.reload)}
                        type="button"
                      >
                        Hide review
                      </button>
                      <button
                        className="secondary-button px-3 py-2 text-sm"
                        onClick={() => void act(`/admin/reports/${report.id}`, { resolution: 'dismissed' }, reports.reload)}
                        type="button"
                      >
                        Dismiss report
                      </button>
                    </div>
                  )}
                </li>
              ))
            }
          </Listing>
        </>
      )}
      {tab === 'reviews' && (
        <>
          <Filter options={['public', 'private', 'hidden']} tab={tab} value={status} />
          <Listing pageHref={pageHref} resource={reviews}>
            {(results) =>
              results.map((review) => (
                <li className="grid list-none gap-3 border-b border-line-soft py-5" key={review.id}>
                  <ReviewBlock review={review} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="secondary-button px-3 py-2 text-sm"
                      onClick={() => void act(`/admin/reviews/${review.id}`, { hidden: !review.hidden }, reviews.reload)}
                      type="button"
                    >
                      {review.hidden ? 'Restore review' : 'Hide review'}
                    </button>
                    {review.openReports > 0 && (
                      <span className="mono-sm text-faint">{review.openReports} open reports</span>
                    )}
                  </div>
                </li>
              ))
            }
          </Listing>
        </>
      )}
      {tab === 'users' && (
        <>
          <form className="mb-6 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto]" key={query} onSubmit={search} role="search">
            <input aria-label="Find accounts" defaultValue={query} name="query" placeholder="Email, handle or name" type="search" />
            <button className="secondary-button" type="submit">
              Find
            </button>
          </form>
          <Listing pageHref={pageHref} resource={users}>
            {(results) =>
              results.map((account) => (
                <li className="flex list-none flex-wrap items-center justify-between gap-3 border-b border-line-soft py-4" key={account.id}>
                  <span className="min-w-0">
                    <Link className="rule-link" to={`/users/${account.handle}`}>
                      {account.displayName}
                    </Link>{' '}
                    <span className="mono-sm text-faint">
                      @{account.handle} · {account.email} ·{' '}
                      {[
                        account.isAdmin && 'administrator',
                        !account.verifiedAt && 'unverified',
                        !account.isActive && 'deactivated',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'active'}
                    </span>
                  </span>
                  {!account.isAdmin && (
                    <button
                      className="secondary-button px-3 py-2 text-sm"
                      onClick={() => void act(`/admin/users/${account.id}`, { active: !account.isActive }, users.reload)}
                      type="button"
                    >
                      {account.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </li>
              ))
            }
          </Listing>
        </>
      )}
      {tab === 'notifications' && (
        <>
          <p className="mt-0 mb-5 max-w-3xl text-sm text-muted">
            Digests the mail server rejected three times in a row. Email notifications for those readers
            stay suspended until they turn them back on.
          </p>
          <Listing pageHref={pageHref} resource={notifications}>
            {(results) =>
              results.map((event) => {
                const href = itemHref(event.item);
                return (
                  <li className="grid list-none gap-1 border-b border-line-soft py-4" key={event.id}>
                    <p className="m-0 text-sm">
                      {href ? <Link className="rule-link" to={href}>{event.item.title}</Link> : event.item.title} ·{' '}
                      {event.release}
                    </p>
                    <p className="mono-sm m-0 text-faint">
                      @{event.user.handle} · {event.error ?? 'delivery failed'} ·{' '}
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </li>
                );
              })
            }
          </Listing>
        </>
      )}
    </div>
  );
}
