import {
  BadRequestException,
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

  async searchMovies(query: string, page: number, filters: CatalogFilters = {}) {
    const response = await this.searchMovieRequest(query, page, filters);
    return this.filterPage(this.normalizeMovieList(response), filters);
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
      return this.searchMovies(query, page, filters);
    }
    if (category === 'tv') {
      return this.filterPage(
        this.normalizeTvList(await this.searchTvRequest(query, page, filters)),
        filters,
      );
    }
    if (category === 'anime') {
      const [movies, shows] = await Promise.all([
        this.searchMovieRequest(query, page, filters),
        this.searchTvRequest(query, page, filters),
      ]);
      return this.filterPage(this.normalizeAnimeList(movies, shows), filters);
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
    if (
      category === 'tv' &&
      section === 'popular' &&
      !this.hasFilters(filters)
    ) {
      return this.normalizeTvList(
        await this.request<TmdbTvSearchResponse>(
          '/tv/popular',
          { page: String(page) },
        ),
      );
    }
    if (category === 'movie') {
      return this.normalizeMovieList(
        await this.request<TmdbSearchResponse>(
          '/discover/movie',
          this.discoverFilters(
            category,
            section,
            page,
            filters,
            'primary_release_date',
          ),
        ),
      );
    }
    if (category === 'tv') {
      return this.normalizeTvList(
        await this.request<TmdbTvSearchResponse>(
          '/discover/tv',
          this.discoverFilters(
            category,
            section,
            page,
            filters,
            'first_air_date',
          ),
        ),
      );
    }
    if (category === 'anime') {
      const [movies, shows] = await Promise.all([
        this.request<TmdbSearchResponse>(
          '/discover/movie',
          this.discoverFilters(
            'anime',
            section,
            page,
            filters,
            'primary_release_date',
          ),
        ),
        this.request<TmdbTvSearchResponse>(
          '/discover/tv',
          this.discoverFilters(
            'anime',
            section,
            page,
            filters,
            'first_air_date',
          ),
        ),
      ]);
      return this.normalizeAnimeList(movies, shows, section === 'recent');
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
      const record =
        mediaType === 'movie'
          ? await this.request<TmdbMovieResult>(
              `/movie/${encodeURIComponent(id)}`,
              {},
            )
          : await this.request<TmdbTvResult>(
              `/tv/${encodeURIComponent(id)}`,
              {},
            );
      if (
        !this.isAnime(
          record.original_language,
          record.genre_ids ?? record.genres?.map((genre) => genre.id),
          'origin_country' in record ? record.origin_country : undefined,
        )
      ) {
        throw new NotFoundException('TMDB title is not classified as anime');
      }
      const item =
        mediaType === 'movie'
          ? this.normalizeAnimeMovie(record as TmdbMovieResult)
          : this.normalizeTv(record as TmdbTvResult, 'anime', true);
      return { ...item, attribution: this.descriptor.attribution };
    }
    throw new NotFoundException('TMDB does not support this category');
  }

  async recognize(
    url: URL,
  ): Promise<{ category: CatalogCategory; externalId: string } | null> {
    if (!/(^|\.)themoviedb\.org$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/(movie|tv)\/(\d+)/);
    if (!match?.[1] || !match[2]) {
      return null;
    }
    const mediaType = match[1] === 'movie' ? 'movie' : 'tv';
    const record =
      mediaType === 'movie'
        ? await this.request<TmdbMovieResult>(`/movie/${match[2]}`, {})
        : await this.request<TmdbTvResult>(`/tv/${match[2]}`, {});
    const anime = this.isAnime(
      record.original_language,
      record.genre_ids ?? record.genres?.map((genre) => genre.id),
      'origin_country' in record ? record.origin_country : undefined,
    );
    return anime
      ? { category: 'anime', externalId: `${mediaType}:${match[2]}` }
      : { category: mediaType, externalId: match[2] };
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
      deepLinks: [
        {
          label: 'View on TMDB',
          url: `https://www.themoviedb.org/movie/${movie.id}`,
        },
      ],
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
    newestFirst = false,
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
      .sort((left, right) =>
        newestFirst
          ? (right.releaseDate ?? '').localeCompare(left.releaseDate ?? '')
          : (right.rating ?? 0) - (left.rating ?? 0),
      )
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

  private discoverFilters(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
    dateField: 'primary_release_date' | 'first_air_date',
  ) {
    const validSorts =
      category === 'movie'
        ? ['popularity.desc', 'vote_average.desc', 'primary_release_date.desc']
        : ['popularity.desc', 'vote_average.desc', 'first_air_date.desc'];
    if (filters.sort && !validSorts.includes(filters.sort)) {
      throw new BadRequestException('Sort does not match this media category');
    }
    const parameters: Record<string, string> = {
      page: String(page),
      include_adult: 'false',
      sort_by:
        filters.sort === 'primary_release_date.desc' ||
        filters.sort === 'first_air_date.desc'
          ? `${dateField}.desc`
          : filters.sort ??
            (section === 'recent' ? `${dateField}.desc` : 'popularity.desc'),
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
      parameters[dateField === 'primary_release_date' ? 'primary_release_year' : 'first_air_date_year'] =
        String(filters.year);
    }
    if (section === 'recent') {
      parameters[`${dateField}.lte`] = new Date().toISOString().slice(0, 10);
    }
    if (filters.status && dateField === 'first_air_date') {
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

  private filterPage(page: CatalogPage, filters: CatalogFilters): CatalogPage {
    const results = page.results.filter(
      (item) =>
        !filters.genre ||
        item.genres.some(
          (genre) => genre.toLowerCase() === filters.genre?.toLowerCase(),
        ),
    );
    if (filters.sort === 'vote_average.desc') {
      results.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));
    } else if (
      filters.sort === 'primary_release_date.desc' ||
      filters.sort === 'first_air_date.desc'
    ) {
      results.sort((left, right) =>
        (right.releaseDate ?? '').localeCompare(left.releaseDate ?? ''),
      );
    }
    return { ...page, results };
  }

  private searchMovieRequest(query: string, page: number, filters: CatalogFilters) {
    return this.request<TmdbSearchResponse>('/search/movie', {
      query,
      page: String(page),
      include_adult: 'false',
      ...(filters.year ? { year: String(filters.year) } : {}),
    });
  }

  private searchTvRequest(query: string, page: number, filters: CatalogFilters) {
    return this.request<TmdbTvSearchResponse>('/search/tv', {
      query,
      page: String(page),
      include_adult: 'false',
      ...(filters.year ? { first_air_date_year: String(filters.year) } : {}),
    });
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
