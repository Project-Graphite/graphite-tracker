import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage, Icon, ListSkeleton, Popover } from '@project-graphite/ui';
import type { Page } from '../api';
import { useInbox, type InboxNotification } from '../inbox';
import { useResource } from '../useResource';
import { NotificationList } from './NotificationList';

function NotificationPanel({ close }: { close: () => void }) {
  const inbox = useInbox();
  const [error, setError] = useState('');
  const recent = useResource<Page<InboxNotification>>('/me/inbox?page=1', true);

  async function markAllRead() {
    setError('');
    try {
      await inbox.markRead();
      recent.reload();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not mark your notifications as read'));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="m-0 text-base font-medium">Notifications</h2>
        {inbox.unread > 0 && (
          <button className="text-button mono-sm" onClick={() => void markAllRead()} type="button">
            mark all read
          </button>
        )}
      </div>
      <div className="popover-list-body">
        {(error || inbox.checkFailed) && (
          <p className="error-message m-3">
            {error || 'Could not check for new notifications. Trying again in a minute.'}
          </p>
        )}
        {recent.error ? (
          <p className="error-message m-3">{recent.error}</p>
        ) : !recent.data ? (
          <div className="px-4">
            <ListSkeleton label="Loading notifications" rows={3} />
          </div>
        ) : recent.data.results.length === 0 ? (
          <p className="m-0 px-4 py-6 text-sm text-muted">
            Nothing yet. Turn on release notifications for a title in your library to hear about
            new episodes, chapters and releases here.
          </p>
        ) : (
          <NotificationList notifications={recent.data.results.slice(0, 8)} onOpen={close} />
        )}
      </div>
      <Link
        className="mono-sm block border-t border-line px-4 py-3 text-center text-muted no-underline hover:text-ink"
        onClick={close}
        to="/notifications"
      >
        See all notifications
      </Link>
    </>
  );
}

export function NotificationBell() {
  const inbox = useInbox();
  return (
    <Popover
      label="Notifications"
      trigger={
        <>
          <Icon name="bell" />
          {inbox.unread > 0 && <span className="count-badge">{inbox.unread > 9 ? '9+' : inbox.unread}</span>}
        </>
      }
      triggerLabel={inbox.unread ? `Notifications, ${inbox.unread} unread` : 'Notifications'}
    >
      {(close) => <NotificationPanel close={close} />}
    </Popover>
  );
}
