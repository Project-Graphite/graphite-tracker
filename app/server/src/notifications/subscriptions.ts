import { DigestCadence, LibraryState, MediaCategory, Prisma, ReleaseKind } from '@prisma/client';
import { effectiveSourceEntry, SourcePreferences } from '../library/effective-source';
import { ReleaseSignal } from '../sources/source.types';

export const followedEntryWhere = {
  notificationsEnabled: true,
  state: { in: [LibraryState.PLANNED, LibraryState.IN_PROGRESS] },
  user: { isActive: true },
} satisfies Prisma.LibraryEntryWhereInput;

export const subscribedEntryWhere = {
  ...followedEntryWhere,
  user: {
    isActive: true,
    notificationPreference: { is: { enabled: true, suspendedAt: null } },
  },
} satisfies Prisma.LibraryEntryWhereInput;

export const subscriptionInclude = Prisma.validator<Prisma.LibraryEntryInclude>()({
  user: { select: { notificationPreference: { select: { categories: true } } } },
  catalogItem: { include: { sourceEntries: { include: { source: true } } } },
});

type SubscribedEntry = Prisma.LibraryEntryGetPayload<{ include: typeof subscriptionInclude }>;

export const releaseKinds: Record<ReleaseSignal['kind'], ReleaseKind> = {
  episode: ReleaseKind.EPISODE,
  chapter: ReleaseKind.CHAPTER,
  release: ReleaseKind.RELEASE,
  release_date: ReleaseKind.RELEASE_DATE,
};

export function followsRelease(
  entry: Omit<SubscribedEntry, 'user'>,
  marker: { sourceEntryId: string; platform: string | null },
  preferences: SourcePreferences,
) {
  const { category, sourceEntries } = entry.catalogItem;
  return (
    entry.notificationsEnabled &&
    (entry.state === LibraryState.PLANNED || entry.state === LibraryState.IN_PROGRESS) &&
    effectiveSourceEntry(sourceEntries, entry.preferredSourceId, category, preferences)?.id ===
      marker.sourceEntryId &&
    (!marker.platform || entry.platforms.includes(marker.platform))
  );
}

export function wantsRelease(
  entry: SubscribedEntry,
  marker: { sourceEntryId: string; platform: string | null },
  preferences: SourcePreferences,
) {
  return (
    (entry.user.notificationPreference?.categories.includes(entry.catalogItem.category) ?? false) &&
    followsRelease(entry, marker, preferences)
  );
}

export function newSignals(
  signals: ReleaseSignal[],
  existing: Array<{ key: string; kind: ReleaseKind; ordinal: number | null }>,
) {
  const keys = new Set(existing.map(({ key }) => key));
  const highest = new Map<ReleaseKind, number>();
  for (const { kind, ordinal } of existing) {
    if (ordinal !== null) highest.set(kind, Math.max(highest.get(kind) ?? ordinal, ordinal));
  }
  return signals.filter(
    (signal) =>
      !keys.has(signal.key) &&
      (signal.ordinal === undefined ||
        signal.ordinal > (highest.get(releaseKinds[signal.kind]) ?? Number.NEGATIVE_INFINITY)),
  );
}

const digestHour = 8;

function localDay(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    monday: parts.weekday === 'Mon',
  };
}

export function digestDue(
  now: Date,
  timeZone: string,
  cadence: DigestCadence,
  lastDigestAt: Date | null,
) {
  const today = localDay(now, timeZone);
  return (
    today.hour >= digestHour &&
    (cadence === DigestCadence.DAILY || today.monday) &&
    (!lastDigestAt || localDay(lastDigestAt, timeZone).date !== today.date)
  );
}

export const categoryNames: Record<MediaCategory, string> = {
  MOVIE: 'movie',
  TV: 'TV',
  ANIME: 'anime',
  MANGA: 'manga',
  MANHWA: 'manhwa',
  GAME: 'game',
};
