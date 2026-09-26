import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth';
import { itemHref, type ItemSummary } from './reviews';
import { useSnackbar } from './snackbar';

export interface InboxNotification {
  id: string;
  release: string;
  read: boolean;
  createdAt: string;
  item: ItemSummary;
}

interface InboxSummary {
  unread: number;
  latestAt: string | null;
  fresh: InboxNotification[];
}

interface InboxState {
  unread: number;
  checkFailed: boolean;
  markRead: (notification?: InboxNotification) => Promise<void>;
}

const pollMs = 60_000;

const InboxContext = createContext<InboxState>({
  unread: 0,
  checkFailed: false,
  markRead: async () => {},
});

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const [unit, size] = (
    [
      ['year', 31_536_000],
      ['month', 2_592_000],
      ['week', 604_800],
      ['day', 86_400],
      ['hour', 3_600],
      ['minute', 60],
    ] as const
  ).find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1];
  return relativeTime.format(Math.round(seconds / size), unit);
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { request, user } = useAuth();
  const show = useSnackbar();
  const [unread, setUnread] = useState(0);
  const [checkFailed, setCheckFailed] = useState(false);
  const latest = useRef<string | null>(null);
  const userId = user?.id;

  const check = useCallback(async () => {
    const since = latest.current;
    try {
      const summary = await request<InboxSummary>(
        `/me/inbox/summary${since ? `?since=${encodeURIComponent(since)}` : ''}`,
      );
      setCheckFailed(false);
      setUnread(summary.unread);
      latest.current = summary.latestAt ?? since;
      for (const notification of [...summary.fresh].reverse()) {
        const href = itemHref(notification.item);
        show({
          message: notification.item.title,
          detail: notification.release,
          action: href ? { label: 'Open', to: href } : undefined,
        });
      }
    } catch {
      setCheckFailed(true);
    }
  }, [request, show]);

  useEffect(() => {
    latest.current = null;
    setUnread(0);
    if (!userId) return;
    void check();
    const poll = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const timer = window.setInterval(poll, pollMs);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [check, userId]);

  const markRead = useCallback(
    async (notification?: InboxNotification) => {
      if (notification?.read) return;
      await request(notification ? `/me/inbox/${notification.id}` : '/me/inbox/read', {
        method: notification ? 'PATCH' : 'POST',
        ...(notification ? { body: JSON.stringify({ read: true }) } : {}),
      });
      setUnread((current) => (notification ? Math.max(0, current - 1) : 0));
    },
    [request],
  );

  return (
    <InboxContext.Provider value={{ unread, checkFailed, markRead }}>{children}</InboxContext.Provider>
  );
}

export function useInbox() {
  return useContext(InboxContext);
}
