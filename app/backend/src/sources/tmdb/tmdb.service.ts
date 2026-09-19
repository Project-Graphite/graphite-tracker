import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MovieCandidate,
  TmdbMovieResult,
  TmdbSearchResponse,
} from './tmdb.types';

@Injectable()
export class TmdbService {
  private readonly baseUrl = 'https://api.themoviedb.org/3';

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
    return this.normalizeMovie(movie);
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
      capabilities: {
        progressUnits: [],
        hasEpisodes: false,
        hasSeasons: false,
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
      throw new BadGatewayException(`TMDB returned ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
