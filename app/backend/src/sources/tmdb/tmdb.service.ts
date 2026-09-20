import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MovieCandidate,
  TmdbMovieResult,
  TmdbSearchResponse,
  TmdbTvResult,
  TmdbTvSearchResponse,
} from './tmdb.types';
import {
  CatalogCandidate,
  CatalogCategory,
  CatalogDetails,
  CatalogFilters,
  CatalogPage,
  CatalogSection,
  ConnectorDescriptor,
} from '../source.types';

const movieGenres: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  36: 'History',
  37: 'Western',
  53: 'Thriller',
  80: 'Crime',
  99: 'Documentary',
  878: 'Science Fiction',
  9648: 'Mystery',
  10402: 'Music',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10770: 'TV Movie',
};

@Injectable()
export class TmdbService {
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  readonly descriptor: ConnectorDescriptor = {
    key: 'tmdb',
    displayName: 'The Movie Database',
    categories: ['movie', 'tv', 'anime'],
    languages: [],
    attribution: 'The Movie Database (TMDB)',
    capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'EPISODES', 'DEEP_LINK'],
    outboundDomains: ['themoviedb.org', 'image.tmdb.org'],
    enabled: true,
  };

  constructor(private readonly config: ConfigService) {}

  async searchMovies(query: string, page: number) {
    const response = await this.request<TmdbSearchResponse>('/search/movie', {
      query,
      page: String(page),
      include_adult: 'false',
    });
    return this.normalizeMovieList(response);
  }

  async recentMovies(page: number) {
    return this.normalizeMovieList(
      await this.request<TmdbSearchResponse>('/movie/now_playing', {
        page: String(page),
      }),
    );
  }

  async popularMovies(page: number) {
    return this.normalizeMovieList(
      await this.request<TmdbSearchResponse>('/movie/popular', {
        page: String(page),
      }),
    );
  }

  async movieDetails(externalId: string) {
    const movie = await this.request<TmdbMovieResult>(
      `/movie/${encodeURIComponent(externalId)}`,
      {},
    );
    return {
      ...this.normalizeMovie(movie),
      attribution: 'The Movie Database (TMDB)',
    };
  }

  async search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    if (category === 'movie') {
      return this.searchMovies(query, page);
    }
    if (category === 'tv') {
      return this.normalizeTvList(
        await this.request<TmdbTvSearchResponse>('/search/tv', {
          query,
          page: String(page),
          include_adult: 'false',
          ...this.searchFilters(filters),
        }),
      );
    }
    if (category === 'anime') {
      const [movies, shows] = await Promise.all([
        this.request<TmdbSearchResponse>('/search/movie', {
          query,
          page: String(page),
          include_adult: 'false',
          ...this.searchFilters(filters),
        }),
        this.request<TmdbTvSearchResponse>('/search/tv', {
          query,
          page: String(page),
          include_adult: 'false',
          ...this.searchFilters(filters),
        }),
      ]);
      return this.normalizeAnimeList(movies, shows);
    }
    throw new NotFoundException('TMDB does not support this category');
  }

  async browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    if (category === 'movie' && !this.hasFilters(filters)) {
      return section === 'recent' ? this.recentMovies(page) : this.popularMovies(page);
    }
    if (category === 'tv' && !this.hasFilters(filters)) {
      return this.normalizeTvList(
        await this.request<TmdbTvSearchResponse>(
          section === 'recent' ? '/tv/on_the_air' : '/tv/popular',
          { page: String(page) },
        ),
      );
    }
    if (category === 'movie') {
      return this.normalizeMovieList(
        await this.request<TmdbSearchResponse>(
          '/discover/movie',
          this.discoverFilters(category, section, page, filters),
        ),
      );
    }
    if (category === 'tv') {
      return this.normalizeTvList(
        await this.request<TmdbTvSearchResponse>(
          '/discover/tv',
          this.discoverFilters(category, section, page, filters),
        ),
      );
    }
    if (category === 'anime') {
      const [movies, shows] = await Promise.all([
        this.request<TmdbSearchResponse>(
          '/discover/movie',
          this.discoverFilters('anime', section, page, filters),
        ),
        this.request<TmdbTvSearchResponse>(
          '/discover/tv',
          this.discoverFilters('anime', section, page, filters),
        ),
      ]);
      return this.normalizeAnimeList(movies, shows);
    }
    throw new NotFoundException('TMDB does not support this category');
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    if (category === 'movie') {
      return this.movieDetails(externalId);
    }
    if (category === 'tv') {
      return {
        ...this.normalizeTv(
          await this.request<TmdbTvResult>(`/tv/${encodeURIComponent(externalId)}`, {}),
          'tv',
          false,
        ),
        attribution: this.descriptor.attribution,
      };
    }
    if (category === 'anime') {
      const [mediaType, id] = externalId.split(':');
      if (!id || (mediaType !== 'movie' && mediaType !== 'tv')) {
        throw new NotFoundException('Anime source ID is invalid');
      }
      const item =
        mediaType === 'movie'
          ? this.normalizeAnimeMovie(
              await this.request<TmdbMovieResult>(`/movie/${encodeURIComponent(id)}`, {}),
            )
          : this.normalizeTv(
              await this.request<TmdbTvResult>(`/tv/${encodeURIComponent(id)}`, {}),
              'anime',
              true,
            );
      return { ...item, attribution: this.descriptor.attribution };
    }
    throw new NotFoundException('TMDB does not support this category');
  }

  recognize(url: URL): { category: CatalogCategory; externalId: string } | null {
    if (!/(^|\.)themoviedb\.org$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/(movie|tv)\/(\d+)/);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    return {
      category: match[1] === 'movie' ? 'movie' : 'tv',
      externalId: match[2],
    };
  }

  normalizeMovie(movie: TmdbMovieResult): MovieCandidate {
    return {
      source: 'tmdb',
      externalId: String(movie.id),
      category: 'movie',
      title: movie.title,
      originalTitle: movie.original_title,
      synopsis: movie.overview,
      posterUrl: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      backdropUrl: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
        : null,
      releaseDate: movie.release_date || null,
      language: movie.original_language,
      genres:
        movie.genres?.map((genre) => genre.name) ??
        movie.genre_ids?.flatMap((genreId) =>
          movieGenres[genreId] ? [movieGenres[genreId]] : [],
        ) ??
        [],
      runtimeMinutes: movie.runtime ?? null,
      status: movie.status ?? null,
      tagline: movie.tagline || null,
      rating:
        typeof movie.vote_average === 'number' && movie.vote_average > 0
          ? movie.vote_average
          : null,
      ratingCount: movie.vote_count ?? 0,
      capabilities: {
        progressUnits: [],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    };
  }

  normalizeTv(
    show: TmdbTvResult,
    category: 'tv' | 'anime' = 'tv',
    prefixExternalId = false,
  ): CatalogCandidate {
    return {
      source: 'tmdb',
      externalId: prefixExternalId ? `tv:${show.id}` : String(show.id),
      category,
      title: show.name,
      originalTitle: show.original_name,
      synopsis: show.overview,
      posterUrl: show.poster_path
        ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
        : null,
      backdropUrl: show.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
        : null,
      releaseDate: show.first_air_date || null,
      language: show.original_language,
      genres:
        show.genres?.map((genre) => genre.name) ??
        show.genre_ids?.flatMap((genreId) =>
          movieGenres[genreId] ? [movieGenres[genreId]] : [],
        ) ??
        [],
      runtimeMinutes: show.episode_run_time?.[0] ?? null,
      status: show.status ?? null,
      tagline: show.tagline || null,
      rating:
        typeof show.vote_average === 'number' && show.vote_average > 0
          ? show.vote_average
          : null,
      ratingCount: show.vote_count ?? 0,
      seasonCount: show.number_of_seasons ?? null,
      episodeCount: show.number_of_episodes ?? null,
      deepLinks: [
        {
          label: 'View on TMDB',
          url: `https://www.themoviedb.org/tv/${show.id}`,
        },
      ],
      capabilities: {
        progressUnits: ['season', 'episode'],
        hasEpisodes: true,
        hasSeasons: true,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    };
  }

  private normalizeMovieList(response: TmdbSearchResponse) {
    return {
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
      results: response.results.map((movie) => this.normalizeMovie(movie)),
      attribution: 'The Movie Database (TMDB)',
    };
  }

  private normalizeTvList(response: TmdbTvSearchResponse): CatalogPage {
    return {
      page: response.page,
      totalPages: response.total_pages,
      totalResults: response.total_results,
      results: response.results.map((show) => this.normalizeTv(show)),
      attribution: this.descriptor.attribution,
    };
  }

  private normalizeAnimeList(
    movies: TmdbSearchResponse,
    shows: TmdbTvSearchResponse,
  ): CatalogPage {
    const movieResults = movies.results
      .filter((movie) => this.isAnime(movie.original_language, movie.genre_ids))
      .map((movie) => this.normalizeAnimeMovie(movie));
    const showResults = shows.results
      .filter((show) =>
        this.isAnime(show.original_language, show.genre_ids, show.origin_country),
      )
      .map((show) => this.normalizeTv(show, 'anime', true));
    const results = [...movieResults, ...showResults]
      .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
      .slice(0, 20);
    return {
      page: Math.max(movies.page, shows.page),
      totalPages: Math.max(movies.total_pages, shows.total_pages),
      totalResults: movies.total_results + shows.total_results,
      results,
      attribution: this.descriptor.attribution,
    };
  }

  private normalizeAnimeMovie(movie: TmdbMovieResult): CatalogCandidate {
    return {
      ...this.normalizeMovie(movie),
      externalId: `movie:${movie.id}`,
      category: 'anime',
      deepLinks: [
        {
          label: 'View on TMDB',
          url: `https://www.themoviedb.org/movie/${movie.id}`,
        },
      ],
    };
  }

  private isAnime(language: string, genreIds?: number[], countries?: string[]) {
    return (
      genreIds?.includes(16) === true &&
      (language === 'ja' || countries?.includes('JP') === true)
    );
  }

  private hasFilters(filters: CatalogFilters) {
    return Object.values(filters).some((value) => value !== undefined && value !== '');
  }

  private searchFilters(filters: CatalogFilters): Record<string, string> {
    const parameters: Record<string, string> = {};
    if (filters.year) {
      parameters.year = String(filters.year);
    }
    return parameters;
  }

  private discoverFilters(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ) {
    const parameters: Record<string, string> = {
      page: String(page),
      include_adult: 'false',
      sort_by:
        filters.sort ??
        (section === 'recent'
          ? category === 'movie'
            ? 'primary_release_date.desc'
            : 'first_air_date.desc'
          : 'popularity.desc'),
    };
    const genreId = Object.entries(movieGenres).find(
      ([, name]) => name.toLowerCase() === filters.genre?.toLowerCase(),
    )?.[0];
    if (genreId) {
      parameters.with_genres = genreId;
    }
    if (category === 'anime') {
      parameters.with_genres = genreId ? `16,${genreId}` : '16';
      parameters.with_original_language = 'ja';
    }
    if (filters.year) {
      parameters[category === 'movie' ? 'primary_release_year' : 'first_air_date_year'] =
        String(filters.year);
    }
    if (filters.status && category !== 'movie') {
      parameters.with_status =
        {
          returning: '0',
          planned: '1',
          production: '2',
          ended: '3',
          canceled: '4',
          pilot: '5',
        }[filters.status.toLowerCase()] ?? filters.status;
    }
    return parameters;
  }

  private async request<T>(path: string, parameters: Record<string, string>) {
    const token = this.config.get<string>('TMDB_READ_ACCESS_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException('TMDB is not configured');
    }
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(parameters).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException('TMDB request failed');
    }
    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundException('Movie not found');
      }
      throw new BadGatewayException(`TMDB returned ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
