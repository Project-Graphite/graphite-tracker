import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectorHttpService } from '../connector-http.service';
import { rankByRelevanceAndPopularity } from '../game-ranking';
import { platformReleaseSignals } from '../release-signals';
import {
  CatalogCandidate,
  CatalogCategory,
  CatalogDetails,
  CatalogFilters,
  CatalogPage,
  CatalogSection,
  ConnectorDescriptor,
} from '../source.types';

interface RawgNamed {
  id: number;
  name: string;
  slug: string;
}

interface RawgPlatform {
  platform: RawgNamed;
  released_at?: string | null;
}

interface RawgGame {
  id: number;
  slug: string;
  name: string;
  name_original?: string;
  description_raw?: string;
  released?: string | null;
  background_image?: string | null;
  background_image_additional?: string | null;
  rating?: number;
  ratings_count?: number;
  playtime?: number;
  genres?: RawgNamed[];
  platforms?: RawgPlatform[];
  esrb_rating?: RawgNamed | null;
  tags?: RawgNamed[];
}

const adultTags = new Set(['nsfw', 'sexual-content', 'hentai']);

interface RawgPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: RawgGame[];
}

@Injectable()
export class RawgService {
  readonly descriptor: ConnectorDescriptor;

  constructor(
    private readonly config: ConfigService,
    private readonly http: ConnectorHttpService,
  ) {
    this.descriptor = {
      key: 'rawg',
      displayName: 'RAWG',
      categories: ['game'],
      languages: [],
      attribution: 'Game data provided by RAWG',
      attributionUrl: 'https://rawg.io/',
      capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'PLATFORMS', 'DEEP_LINK'],
      outboundDomains: ['rawg.io'],
      requestIntervalMs: 200,
      enabled: Boolean(this.config.get<string>('RAWG_API_KEY')),
    };
  }

  search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    return this.list(page, filters, {
      search: query,
      search_precise: 'true',
    });
  }

  browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    return this.list(page, filters, {
      ordering: section === 'recent' ? '-released' : '-added',
      ...(section === 'recent'
        ? { dates: `1970-01-01,${new Date().toISOString().slice(0, 10)}` }
        : {}),
    });
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    const identifier = externalId.replace(/^slug:/, '');
    const game = await this.request<RawgGame>(
      `/games/${encodeURIComponent(identifier)}`,
      {},
    );
    const [additions, series] = await Promise.all([
      this.request<RawgPage>(
        `/games/${encodeURIComponent(String(game.id))}/additions`,
        { page_size: '20' },
      ).catch(() => null),
      this.request<RawgPage>(
        `/games/${encodeURIComponent(String(game.id))}/game-series`,
        { page_size: '20' },
      ).catch(() => null),
    ]);
    return {
      ...this.normalize(game, [
        ...(series?.results ?? []).map((related) => ({
          type: 'series' as const,
          externalId: String(related.id),
          title: related.name,
        })),
        ...(additions?.results ?? []).map((related) => ({
          type: 'dlc' as const,
          externalId: String(related.id),
          title: related.name,
        })),
      ]),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async releases(category: CatalogCategory, externalId: string) {
    const game = await this.request<RawgGame>(
      `/games/${encodeURIComponent(externalId.replace(/^slug:/, ''))}`,
      {},
    );
    return platformReleaseSignals(this.normalize(game).releaseDates ?? []);
  }

  recognize(url: URL): { category: CatalogCategory; externalId: string } | null {
    if (!/(^|\.)rawg\.io$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/games\/([^/]+)/);
    return match?.[1]
      ? { category: 'game', externalId: `slug:${match[1]}` }
      : null;
  }

  private async list(
    page: number,
    filters: CatalogFilters,
    parameters: Record<string, string>,
  ): Promise<CatalogPage> {
    const window = parameters.search ? 40 : 20;
    const response = await this.request<RawgPage>('/games', {
      ...parameters,
      page: String(Math.ceil((page * 20) / window)),
      page_size: String(window),
      ...(filters.year
        ? { dates: `${filters.year}-01-01,${filters.year}-12-31` }
        : {}),
      ...(filters.genre
        ? { genres: filters.genre.trim().toLowerCase().replaceAll(' ', '-') }
        : {}),
      ...(filters.sort ? { ordering: this.ordering(filters.sort) } : {}),
    });
    const results = response.results
      .map((game) => this.normalize(game))
      .filter((game) => filters.adult || !game.adult);
    const offset = ((page - 1) * 20) % window;
    return {
      page,
      totalPages: Math.max(1, Math.ceil(response.count / 20)),
      totalResults: results.length === response.results.length ? response.count : null,
      results: (parameters.search
        ? rankByRelevanceAndPopularity(results, parameters.search)
        : results
      ).slice(offset, offset + 20),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  private normalize(
    game: RawgGame,
    relationships: CatalogCandidate['relationships'] = [],
  ): CatalogCandidate {
    const originalTitle = game.name_original || game.name;
    return {
      source: 'rawg',
      externalId: String(game.id),
      category: 'game',
      title: game.name,
      originalTitle,
      alternateTitles: originalTitle === game.name ? [] : [originalTitle],
      synopsis: game.description_raw ?? '',
      posterUrl: game.background_image ?? null,
      backdropUrl: game.background_image_additional ?? game.background_image ?? null,
      releaseDate: game.released ?? null,
      language: 'en',
      genres: game.genres?.map((genre) => genre.name) ?? [],
      runtimeMinutes: null,
      status: null,
      tagline: null,
      rating:
        typeof game.rating === 'number'
          ? Math.min(10, Math.max(0, game.rating * 2))
          : null,
      ratingCount: game.ratings_count ?? 0,
      adult: this.adult(game),
      platforms: game.platforms?.map(({ platform }) => platform.name) ?? [],
      releaseDates:
        game.platforms
          ?.filter(
            (platform): platform is RawgPlatform & { released_at: string } =>
              Boolean(platform.released_at),
          )
          .map((platform) => ({
            date: platform.released_at,
            platform: platform.platform.name,
          })) ?? [],
      relationships,
      deepLinks: [
        { label: 'View on RAWG', url: `https://rawg.io/games/${game.slug}` },
      ],
      capabilities: {
        progressUnits: ['hours', 'percentage'],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: true,
        supportsReleaseNotifications: true,
      },
    };
  }

  private adult(game: RawgGame) {
    return (
      game.esrb_rating?.slug === 'adults-only' ||
      (game.tags ?? []).some((tag) => adultTags.has(tag.slug))
    );
  }

  private ordering(value: string) {
    const ordering = (
      {
        'popularity.desc': '-added',
        'vote_average.desc': '-rating',
        'primary_release_date.desc': '-released',
      } as Record<string, string>
    )[value];
    if (!ordering) {
      throw new BadRequestException('Sort does not match this media category');
    }
    return ordering;
  }

  private request<T>(path: string, parameters: Record<string, string>) {
    const key = this.config.get<string>('RAWG_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException('RAWG is not configured');
    }
    const url = new URL(`https://api.rawg.io/api${path}`);
    url.searchParams.set('key', key);
    Object.entries(parameters).forEach(([name, value]) =>
      url.searchParams.set(name, value),
    );
    return this.http.json<T>(this.descriptor, url);
  }
}
