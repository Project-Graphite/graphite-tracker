import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectorCacheService } from '../connector-cache.service';
import {
  CatalogCandidate,
  CatalogCategory,
  CatalogDetails,
  CatalogFilters,
  CatalogPage,
  CatalogSection,
  ConnectorDescriptor,
} from '../source.types';

interface IgdbNamed {
  id: number;
  name: string;
}

interface IgdbImage {
  image_id: string;
}

interface IgdbReleaseDate {
  date: number;
  platform?: IgdbNamed;
}

interface IgdbGame {
  id: number;
  name: string;
  alternative_names?: IgdbNamed[];
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  total_rating?: number;
  total_rating_count?: number;
  status?: number;
  franchises?: IgdbNamed[];
  dlcs?: IgdbNamed[];
  expansions?: IgdbNamed[];
  standalone_expansions?: IgdbNamed[];
  release_dates?: IgdbReleaseDate[];
  url?: string;
}

interface TwitchToken {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class IgdbService {
  private readonly baseUrl = 'https://api.igdb.com/v4';
  readonly descriptor: ConnectorDescriptor;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: ConnectorCacheService,
  ) {
    this.descriptor = {
      key: 'igdb',
      displayName: 'IGDB',
      categories: ['game'],
      languages: [],
      attribution: 'Game data provided by IGDB',
      capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'PLATFORMS', 'DEEP_LINK'],
      outboundDomains: ['igdb.com', 'images.igdb.com'],
      enabled: Boolean(
        this.config.get<string>('IGDB_CLIENT_ID') &&
          this.config.get<string>('IGDB_CLIENT_SECRET'),
      ),
    };
  }

  async search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    this.assertCategory(category);
    return this.list(`search "${this.escape(query)}";`, page, filters);
  }

  async browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    this.assertCategory(category);
    const now = Math.floor(Date.now() / 1000);
    return this.list(
      section === 'recent'
        ? `where first_release_date <= ${now}; sort first_release_date desc;`
        : 'where total_rating_count > 25; sort total_rating_count desc;',
      page,
      filters,
    );
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    this.assertCategory(category);
    const selector = /^\d+$/.test(externalId)
      ? `id = ${externalId}`
      : `slug = "${this.escape(externalId.replace(/^slug:/, ''))}"`;
    const games = await this.request<IgdbGame[]>(
      'games',
      `${this.fields()} where ${selector}; limit 1;`,
    );
    const game = games[0];
    if (!game) {
      throw new NotFoundException('IGDB game not found');
    }
    return { ...this.normalize(game), attribution: this.descriptor.attribution };
  }

  recognize(url: URL): { category: CatalogCategory; externalId: string } | null {
    if (!/(^|\.)igdb\.com$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/games\/([^/]+)/);
    return match?.[1]
      ? { category: 'game', externalId: `slug:${match[1]}` }
      : null;
  }

  private async list(fragment: string, page: number, filters: CatalogFilters) {
    let query = fragment;
    if (filters.year) {
      const start = Math.floor(Date.UTC(filters.year, 0, 1) / 1000);
      const end = Math.floor(Date.UTC(filters.year + 1, 0, 1) / 1000);
      const condition = `first_release_date >= ${start} & first_release_date < ${end}`;
      query = query.includes('where ')
        ? query.replace('where ', `where ${condition} & `)
        : `${query} where ${condition};`;
    }
    const offset = (page - 1) * 20;
    const games = await this.request<IgdbGame[]>(
      'games',
      `${this.fields()} ${query} limit 20; offset ${offset};`,
    );
    const filtered = games
      .map((game) => this.normalize(game))
      .filter(
        (game) =>
          !filters.genre ||
          game.genres.some(
            (genre) => genre.toLowerCase() === filters.genre?.toLowerCase(),
          ),
      )
      .filter(
        (game) =>
          !filters.status || game.status?.toLowerCase() === filters.status.toLowerCase(),
      );
    return {
      page,
      totalPages: filtered.length === 20 ? page + 1 : page,
      totalResults: offset + filtered.length,
      results: filtered,
      attribution: this.descriptor.attribution,
    };
  }

  private normalize(game: IgdbGame): CatalogCandidate {
    const relationships = [
      ...(game.franchises ?? []).map((item) => ({ type: 'franchise' as const, item })),
      ...(game.dlcs ?? []).map((item) => ({ type: 'dlc' as const, item })),
      ...(game.expansions ?? []).map((item) => ({ type: 'expansion' as const, item })),
      ...(game.standalone_expansions ?? []).map((item) => ({
        type: 'expansion' as const,
        item,
      })),
    ].map(({ type, item }) => ({
      type,
      externalId: String(item.id),
      title: item.name,
    }));
    return {
      source: 'igdb',
      externalId: String(game.id),
      category: 'game',
      title: game.name,
      originalTitle: game.name,
      alternateTitles:
        game.alternative_names
          ?.map((alternate) => alternate.name)
          .filter(
            (alternate, index, alternates) =>
              alternate !== game.name && alternates.indexOf(alternate) === index,
          ) ?? [],
      synopsis: game.summary ?? game.storyline ?? '',
      posterUrl: game.cover
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      backdropUrl: game.artworks?.[0]
        ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg`
        : null,
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      language: 'en',
      genres: game.genres?.map((genre) => genre.name) ?? [],
      runtimeMinutes: null,
      status: game.status === undefined ? null : String(game.status),
      tagline: null,
      rating: game.total_rating ? game.total_rating / 10 : null,
      ratingCount: game.total_rating_count ?? 0,
      platforms: game.platforms?.map((platform) => platform.name) ?? [],
      releaseDates:
        game.release_dates?.map((release) => ({
          date: new Date(release.date * 1000).toISOString().slice(0, 10),
          platform: release.platform?.name ?? null,
        })) ?? [],
      relationships,
      deepLinks: game.url
        ? [{ label: 'View on IGDB', url: game.url }]
        : [{ label: 'View on IGDB', url: `https://www.igdb.com/games/${game.id}` }],
      capabilities: {
        progressUnits: ['hours', 'percentage'],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: true,
        supportsReleaseNotifications: true,
      },
    };
  }

  private fields() {
    return 'fields name,alternative_names.name,summary,storyline,first_release_date,cover.image_id,artworks.image_id,genres.name,platforms.name,total_rating,total_rating_count,status,franchises.name,dlcs.name,expansions.name,standalone_expansions.name,release_dates.date,release_dates.platform.name,url;';
  }

  private assertCategory(category: CatalogCategory) {
    if (category !== 'game') {
      throw new NotFoundException('IGDB does not support this category');
    }
  }

  private escape(value: string) {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  }

  private async request<T>(endpoint: string, body: string) {
    const clientId = this.config.get<string>('IGDB_CLIENT_ID');
    const clientSecret = this.config.get<string>('IGDB_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('IGDB is not configured');
    }
    const { value: token } = await this.cache.getOrLoad(
      'connector:igdb:token',
      3_000,
      3_300,
      () => this.fetchToken(clientId, clientSecret),
    );
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Client-ID': clientId,
          Authorization: `Bearer ${token.access_token}`,
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException('IGDB request failed');
    }
    if (!response.ok) {
      throw new BadGatewayException(`IGDB returned ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async fetchToken(clientId: string, clientSecret: string) {
    const url = new URL('https://id.twitch.tv/oauth2/token');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new BadGatewayException('Twitch authentication failed');
    }
    return (await response.json()) as TwitchToken;
  }
}
