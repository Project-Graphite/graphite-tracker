import type { CatalogCapabilities, CatalogCategory } from './catalog';

export type LibraryState = 'planned' | 'in_progress' | 'completed' | 'dropped';

export interface CatalogMetadata {
  language?: string;
  genres?: string[];
  runtimeMinutes?: number | null;
  status?: string | null;
  tagline?: string | null;
  rating?: number | null;
  ratingCount?: number;
  capabilities?: CatalogCapabilities;
  episodeCount?: number | null;
  seasonCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
  platforms?: string[];
  releaseDates?: Array<{ date: string; platform: string | null }>;
  relationships?: Array<{
    type: 'franchise' | 'dlc' | 'expansion';
    externalId: string;
    title: string;
  }>;
}

export interface LibraryEntry {
  id: string;
  state: LibraryState;
  startedAt: string | null;
  completedAt: string | null;
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
    id: string;
    category: CatalogCategory;
    title: string;
    synopsis: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    releaseDate: string | null;
    metadata: CatalogMetadata;
    sources: Array<{
      key: string;
      name: string;
      externalId: string;
      url: string | null;
      active: boolean;
      capabilities: string[];
    }>;
  };
}

export const libraryStateLabels: Record<LibraryState, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

export function stateLabel(category: CatalogCategory, state: LibraryState) {
  const verbs = {
    movie: ['Plan to watch', 'Watching', 'Watched'],
    tv: ['Plan to watch', 'Watching', 'Watched'],
    anime: ['Plan to watch', 'Watching', 'Watched'],
    manga: ['Plan to read', 'Reading', 'Read'],
    manhwa: ['Plan to read', 'Reading', 'Read'],
    game: ['Plan to play', 'Playing', 'Completed'],
  }[category];
  return state === 'planned'
    ? verbs[0]
    : state === 'in_progress'
      ? verbs[1]
      : state === 'completed'
        ? verbs[2]
        : 'Dropped';
}
