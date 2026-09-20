export type CatalogCategory = 'movie' | 'tv' | 'anime' | 'manga' | 'manhwa' | 'game';
export type CatalogSection = 'recent' | 'popular';
export type ProgressUnit = 'season' | 'episode' | 'chapter' | 'volume' | 'hours' | 'percentage';

export interface CatalogFilters {
  genre?: string;
  year?: number;
  status?: string;
  sort?: string;
}

export interface CatalogCapabilities {
  progressUnits: ProgressUnit[];
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
    type: 'franchise' | 'dlc' | 'expansion';
    externalId: string;
    title: string;
  }>;
  deepLinks?: Array<{ label: string; url: string }>;
}

export interface CatalogPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: CatalogCandidate[];
  attribution: string;
  stale?: boolean;
}

export interface CatalogDetails extends CatalogCandidate {
  attribution: string;
  stale?: boolean;
}

export interface ConnectorDescriptor {
  key: string;
  displayName: string;
  categories: CatalogCategory[];
  languages: string[];
  attribution: string;
  capabilities: Array<
    'SEARCH' | 'DETAILS' | 'RELEASES' | 'CHAPTERS' | 'EPISODES' | 'PLATFORMS' | 'DEEP_LINK'
  >;
  outboundDomains: string[];
  enabled: boolean;
}

export interface SourceConnector {
  descriptor: ConnectorDescriptor;
  search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage>;
  browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage>;
  details(category: CatalogCategory, externalId: string): Promise<CatalogDetails>;
  recognize(url: URL): { category: CatalogCategory; externalId: string } | null;
}
