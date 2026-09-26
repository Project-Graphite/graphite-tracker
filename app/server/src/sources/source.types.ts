export const catalogCategories = ['movie', 'tv', 'anime', 'manga', 'manhwa', 'game'] as const;
export type CatalogCategory = (typeof catalogCategories)[number];
export type CatalogSection = 'recent' | 'popular';
export type ProgressUnit = 'season' | 'episode' | 'chapter' | 'volume' | 'hours' | 'percentage';

export interface CatalogFilters {
  genre?: string;
  year?: number;
  status?: string;
  sort?: string;
  adult?: boolean;
}

export interface CatalogCapabilities {
  progressUnits: ProgressUnit[];
  hasEpisodes: boolean;
  hasSeasons: boolean;
  hasPlatforms: boolean;
  supportsReleaseNotifications: boolean;
}

export interface CatalogCredit {
  role: string;
  names: string[];
}

export interface CatalogCastMember {
  name: string;
  character: string | null;
  imageUrl: string | null;
}

export interface CatalogTrailer {
  name: string;
  url: string;
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
  credits?: CatalogCredit[];
  cast?: CatalogCastMember[];
  trailers?: CatalogTrailer[];
}

export interface CatalogPage {
  page: number;
  totalPages: number;
  totalResults: number | null;
  results: CatalogCandidate[];
  attribution: string;
  attributionUrl?: string;
  stale?: boolean;
}

export interface CatalogDetails extends CatalogCandidate {
  attribution: string;
  attributionUrl?: string;
  stale?: boolean;
}

export interface ConnectorDescriptor {
  key: string;
  displayName: string;
  categories: CatalogCategory[];
  languages: string[];
  attribution: string;
  attributionUrl?: string;
  capabilities: Array<
    'SEARCH' | 'DETAILS' | 'RELEASES' | 'CHAPTERS' | 'EPISODES' | 'PLATFORMS' | 'DEEP_LINK'
  >;
  outboundDomains: string[];
  requestIntervalMs: number;
  enabled: boolean;
}

export interface ReleaseSignal {
  key: string;
  kind: 'episode' | 'chapter' | 'release' | 'release_date';
  label: string;
  occurredAt: string;
  platform?: string;
  ordinal?: number;
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
  genres?(category: CatalogCategory): Promise<string[]>;
  releases?(category: CatalogCategory, externalId: string): Promise<ReleaseSignal[]>;
  recognize(
    url: URL,
  ):
    | { category: CatalogCategory; externalId: string }
    | null
    | Promise<{ category: CatalogCategory; externalId: string } | null>;
}
