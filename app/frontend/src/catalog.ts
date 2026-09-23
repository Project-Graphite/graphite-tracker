export const discoverCategories = [
  'movie',
  'tv',
  'anime',
  'manga',
  'manhwa',
] as const;

export const catalogCategories = [...discoverCategories, 'game'] as const;

export type CatalogCategory = (typeof catalogCategories)[number];
export type DiscoverCategory = (typeof discoverCategories)[number];

export const catalogSections = ['search', 'recent', 'popular'] as const;

export type CatalogSection = (typeof catalogSections)[number];

export const categoryLabels: Record<CatalogCategory, string> = {
  movie: 'Movies',
  tv: 'TV',
  anime: 'Anime',
  manga: 'Manga',
  manhwa: 'Manhwa',
  game: 'Games',
};

export interface CatalogCapabilities {
  progressUnits: Array<
    'season' | 'episode' | 'chapter' | 'volume' | 'hours' | 'percentage'
  >;
  hasEpisodes: boolean;
  hasSeasons: boolean;
  hasPlatforms: boolean;
  supportsReleaseNotifications: boolean;
}

export interface CatalogCandidate {
  source: string;
  externalId: string;
  category: CatalogCategory;
  title: string;
  originalTitle: string;
  alternateTitles?: string[];
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  language: string;
  genres: string[];
  runtimeMinutes: number | null;
  status: string | null;
  tagline: string | null;
  rating: number | null;
  ratingCount: number;
  capabilities: CatalogCapabilities;
  episodeCount?: number | null;
  seasonCount?: number | null;
  chapterCount?: number | null;
  volumeCount?: number | null;
  platforms?: string[];
  releaseDates?: Array<{ date: string; platform: string | null }>;
  relationships?: Array<{
    type: 'franchise' | 'series' | 'dlc' | 'expansion';
    externalId: string;
    title: string;
  }>;
  deepLinks?: Array<{ label: string; url: string }>;
}

export interface CatalogDetails extends CatalogCandidate {
  attribution: string;
  attributionUrl?: string;
  stale?: boolean;
}

export interface CatalogResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: CatalogCandidate[];
  attribution: string;
  attributionUrl?: string;
  stale?: boolean;
}

export interface ConnectorDescriptor {
  key: string;
  displayName: string;
  enabled: boolean;
}

export function countLabel(count: number, noun: string) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

export function titleHref(item: Pick<CatalogCandidate, 'category' | 'externalId' | 'source'>) {
  return `/titles/${item.category}/${encodeURIComponent(item.externalId)}?source=${encodeURIComponent(item.source)}`;
}
