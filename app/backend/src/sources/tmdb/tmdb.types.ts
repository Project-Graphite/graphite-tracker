export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  original_language: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  runtime?: number | null;
  status?: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  original_language: string;
  origin_country?: string[];
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbTvSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbTvResult[];
}

export interface TmdbSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieResult[];
}

export interface MovieCandidate {
  source: 'tmdb';
  externalId: string;
  category: 'movie';
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
  capabilities: {
    progressUnits: [];
    hasEpisodes: false;
    hasSeasons: false;
    hasPlatforms: false;
    supportsReleaseNotifications: true;
  };
}
