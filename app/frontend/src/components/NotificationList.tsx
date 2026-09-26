import { Link } from 'react-router';
import { useAdultBlur } from '../adultContent';
import { timeAgo, useInbox, type InboxNotification } from '../inbox';
import { itemHref } from '../reviews';
import { useSnackbar } from '../snackbar';
import { Poster } from './Poster';

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: InboxNotification;
  onOpen?: () => void;
}) {
  const inbox = useInbox();
  const show = useSnackbar();
  const blur = useAdultBlur();
  const href = itemHref(notification.item);
  const content = (
    <>
      <Poster
        blurred={blur(notification.item.adult)}
        className="w-10 shrink-0"
        posterUrl={notification.item.posterUrl}
        title={notification.item.title}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{notification.item.title}</span>
        <span className="block truncate text-sm text-muted">{notification.release}</span>
        <span className="mono-sm text-faint">{timeAgo(notification.createdAt)}</span>
      </span>
      {!notification.read && <span aria-label="Unread" className="unread-dot" role="img" />}
    </>
  );
  return href ? (
    <Link
      className="notification-row"
      onClick={() => {
        onOpen?.();
        void inbox
          .markRead(notification)
          .catch(() => show({ message: 'Could not mark the notification as read' }));
      }}
      to={href}
    >
      {content}
    </Link>
  ) : (
    <div className="notification-row">{content}</div>
  );
}

export function NotificationList({
  notifications,
  onOpen,
}: {
  notifications: InboxNotification[];
  onOpen?: () => void;
}) {
  return (
    <ul className="m-0 p-0">
      {notifications.map((notification) => (
        <li className="list-none" key={notification.id}>
          <NotificationRow notification={notification} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
