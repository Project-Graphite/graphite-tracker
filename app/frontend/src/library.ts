import {
  titleHref,
  type CatalogCapabilities,
  type CatalogCategory,
} from './catalog';

export const libraryStates = ['planned', 'in_progress', 'completed', 'dropped'] as const;

export type LibraryState = (typeof libraryStates)[number];

export interface CatalogMetadata {
  capabilities?: CatalogCapabilities;
  episodeCount?: number | null;
  seasonCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
  platforms?: string[];
}

export interface LibraryEntry {
  id: string;
  state: LibraryState;
  notificationsEnabled: boolean;
  progress: {
    season: number | null;
    episode: number | null;
    chapter: number | null;
    volume: number | null;
    hours: number | null;
    percentage: number | null;
    platforms: string[];
  };
  preferredSource: string | null;
  item: {
    category: CatalogCategory;
    title: string;
    posterUrl: string | null;
    releaseDate: string | null;
    metadata: CatalogMetadata;
    sources: Array<{
      key: string;
      name: string;
      externalId: string;
      url: string | null;
      active: boolean;
    }>;
  };
}

export const libraryStateLabels: Record<LibraryState, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

export function entryHref(entry: LibraryEntry) {
  const source =
    entry.item.sources.find(
      (item) => item.active && item.key === entry.preferredSource,
    ) ?? entry.item.sources.find((item) => item.active);
  return (
    source &&
    titleHref({
      category: entry.item.category,
      externalId: source.externalId,
      source: source.key,
    })
  );
}

export function stateLabel(category: CatalogCategory, state: LibraryState) {
  if (state === 'dropped') return libraryStateLabels.dropped;
  const [planned, inProgress, completed] = {
    movie: ['Plan to watch', 'Watching', 'Watched'],
    tv: ['Plan to watch', 'Watching', 'Watched'],
    anime: ['Plan to watch', 'Watching', 'Watched'],
    manga: ['Plan to read', 'Reading', 'Read'],
    manhwa: ['Plan to read', 'Reading', 'Read'],
    game: ['Plan to play', 'Playing', 'Completed'],
  }[category];
  return { planned, in_progress: inProgress, completed }[state];
}
