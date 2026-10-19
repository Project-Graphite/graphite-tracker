import Alert from '@mui/material/Alert';
import MuiLink from '@mui/material/Link';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, EmptyState, errorMessage, ListSkeleton, Pagination } from '@project-graphite/ui';
import type { Page } from '../api';
import { NotificationList } from '../components/NotificationList';
import { useInbox, type InboxNotification } from '../inbox';
import { useResource } from '../useResource';

export function NotificationsPage() {
  const inbox = useInbox();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const page = Number(searchParams.get('page')) || 1;
  const notifications = useResource<Page<InboxNotification>>(`/me/inbox?page=${page}`, true);

  async function markAllRead() {
    setError('');
    try {
      await inbox.markRead();
      notifications.reload();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not mark your notifications as read'));
    }
  }

  return (
    <div className="page-enter max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your library</p>
          <h1 className="page-title">Notifications</h1>
        </div>
        {inbox.unread > 0 && (
          <Button onClick={() => void markAllRead()} size="small">
            Mark all as read
          </Button>
        )}
      </div>
      <p className="mt-4 text-muted">
        New episodes, chapters and releases for the titles you follow. Turn release notifications on
        or off in each title’s library entry.
      </p>
      {(error || notifications.error) && <Alert className="mt-6" severity="error">{error || notifications.error}</Alert>}
      {!notifications.data ? (
        !notifications.error && (
          <div className="mt-6">
            <ListSkeleton label="Loading notifications" rows={6} />
          </div>
        )
      ) : notifications.data.results.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No notifications yet">
            <p className="mt-2 mb-0 text-muted">
              Open a title in your <MuiLink component={Link} to="/library" underline="always">library</MuiLink> and turn on
              release notifications to hear about what comes out next.
            </p>
          </EmptyState>
        </div>
      ) : (
        <section className="fade-in mt-6 rounded-xl border border-line">
          <NotificationList notifications={notifications.data.results} />
        </section>
      )}
      {notifications.data && (
        <Pagination
          maxPages={500}
          page={notifications.data.page}
          pageHref={(next) => `/notifications?page=${next}`}
          totalPages={notifications.data.totalPages}
        />
      )}
    </div>
  );
}
