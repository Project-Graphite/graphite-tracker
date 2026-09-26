interface TmdbNamed {
  id: number;
  name: string;
}

interface TmdbPerson extends TmdbNamed {
  profile_path: string | null;
}

export interface TmdbCredits {
  cast: Array<TmdbPerson & { character?: string }>;
  crew: Array<TmdbPerson & { job: string; department: string }>;
}

export interface TmdbAggregateCredits {
  cast: Array<TmdbPerson & { roles?: Array<{ character: string }> }>;
  crew: Array<TmdbPerson & { jobs?: Array<{ job: string }> }>;
}

export interface TmdbMovieResult {
  id: number;
  adult?: boolean;
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
  production_companies?: TmdbNamed[];
  credits?: TmdbCredits;
}

export interface TmdbTvResult {
  id: number;
  adult?: boolean;
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
  last_episode_to_air?: {
    season_number: number;
    episode_number: number;
    air_date: string | null;
    name?: string;
  } | null;
  status?: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
  created_by?: TmdbNamed[];
  networks?: TmdbNamed[];
  production_companies?: TmdbNamed[];
  aggregate_credits?: TmdbAggregateCredits;
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

export interface TmdbReleaseDates {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string }>;
  }>;
}
