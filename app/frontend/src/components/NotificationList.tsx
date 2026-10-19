import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import { Link } from 'react-router';
import { timeAgo, useSnackbar } from '@project-graphite/ui';
import { useAdultBlur } from '../adultContent';
import { useInbox, type InboxNotification } from '../inbox';
import { itemHref } from '../reviews';
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
    <ListItemButton
      className="gap-3.5 px-4 py-3"
      component={Link}
      onClick={() => {
        onOpen?.();
        void inbox
          .markRead(notification)
          .catch(() => show({ message: 'Could not mark the notification as read' }));
      }}
      to={href}
    >
      {content}
    </ListItemButton>
  ) : (
    <div className="flex w-full items-center gap-3.5 px-4 py-3">{content}</div>
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
    <List disablePadding>
      {notifications.map((notification) => (
        <ListItem className="last:border-b-0" disablePadding divider key={notification.id}>
          <NotificationRow notification={notification} onOpen={onOpen} />
        </ListItem>
      ))}
    </List>
  );
}
