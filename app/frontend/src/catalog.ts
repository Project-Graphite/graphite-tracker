import type { Page } from './api';

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

export const catalogSections = ['recent', 'popular', 'search'] as const;

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
  adult: boolean;
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

export interface Attribution {
  attribution: string;
  attributionUrl?: string;
  stale?: boolean;
}

export type CatalogDetails = CatalogCandidate & Attribution;

export type CatalogResponse = Omit<Page<CatalogCandidate>, 'totalResults'> &
  Attribution & { totalResults: number | null };

export interface ConnectorDescriptor {
  key: string;
  displayName: string;
  enabled: boolean;
}

export function countLabel(count: number, noun: string) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

export function catalogRef(item: Pick<CatalogCandidate, 'externalId' | 'source'>) {
  return `${item.source}:${item.externalId}`;
}

export function titleHref(item: Pick<CatalogCandidate, 'category' | 'externalId' | 'source'>) {
  return `/titles/${item.category}/${encodeURIComponent(item.externalId)}?source=${encodeURIComponent(item.source)}`;
}
