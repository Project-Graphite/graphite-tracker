export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  original_language: string;
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
  capabilities: {
    progressUnits: [];
    hasEpisodes: false;
    hasSeasons: false;
    hasPlatforms: false;
    supportsReleaseNotifications: true;
  };
}
