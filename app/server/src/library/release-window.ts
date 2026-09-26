import { MediaCategory, Prisma } from '@prisma/client';

const endedSeries = ['ended', 'canceled', 'cancelled'];
const finishedComics = ['completed', 'canceled', 'cancelled'];
const unfinishedGames = ['alpha', 'beta', 'early access'];
const movieWindowMs = 90 * 24 * 60 * 60 * 1000;

interface ReleaseMetadata {
  status?: unknown;
  releaseDates?: unknown;
  capabilities?: { hasEpisodes?: unknown };
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function stillReleasing(
  category: MediaCategory,
  metadata: Prisma.JsonValue,
  releaseDate: Date | null,
  now = new Date(),
) {
  const details = (
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  ) as ReleaseMetadata;
  const status = typeof details.status === 'string' ? details.status.toLowerCase() : null;
  const released = releaseDate && isoDay(releaseDate);
  const today = isoDay(now);
  const series = () => !status || !endedSeries.includes(status);
  const movie = () =>
    status !== 'canceled' &&
    (!released || released >= isoDay(new Date(now.getTime() - movieWindowMs)));

  switch (category) {
    case MediaCategory.MANGA:
    case MediaCategory.MANHWA:
      return !status || !finishedComics.includes(status);
    case MediaCategory.GAME:
      return (
        !released ||
        released > today ||
        (Array.isArray(details.releaseDates) &&
          details.releaseDates.some(
            (release: { date?: unknown } | null) =>
              typeof release?.date === 'string' && release.date > today,
          )) ||
        (status !== null && unfinishedGames.includes(status))
      );
    case MediaCategory.TV:
      return series();
    case MediaCategory.ANIME:
      return details.capabilities?.hasEpisodes === true ? series() : movie();
    case MediaCategory.MOVIE:
      return movie();
  }
}
