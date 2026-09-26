import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { looksAdult } from '../adult-content';
import { ConnectorCacheService } from '../connector-cache.service';
import { ConnectorHttpService } from '../connector-http.service';
import { creditGroups } from '../credits';
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

interface IgdbNamed {
  id: number;
  name: string;
}

interface IgdbImage {
  image_id: string;
}

interface IgdbReleaseDate {
  date?: number;
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
  game_status?: { status: string };
  franchises?: IgdbNamed[];
  dlcs?: IgdbNamed[];
  expansions?: IgdbNamed[];
  standalone_expansions?: IgdbNamed[];
  release_dates?: IgdbReleaseDate[];
  themes?: number[];
  url?: string;
  involved_companies?: Array<{ company?: IgdbNamed; developer?: boolean; publisher?: boolean }>;
}

const eroticTheme = 42;
const detailFields = [
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
];

interface TwitchToken {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class IgdbService {
  readonly descriptor: ConnectorDescriptor;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: ConnectorCacheService,
    private readonly http: ConnectorHttpService,
  ) {
    this.descriptor = {
      key: 'igdb',
      displayName: 'IGDB',
      categories: ['game'],
      languages: [],
      attribution: 'Game data provided by IGDB',
      attributionUrl: 'https://www.igdb.com/',
      capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'PLATFORMS', 'DEEP_LINK'],
      outboundDomains: ['igdb.com', 'twitch.tv'],
      requestIntervalMs: 260,
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
    const { value: games } = await this.cache.getOrLoad(
      `connector:igdb:search:${Buffer.from(JSON.stringify([query, filters])).toString('base64url')}`,
      300,
      86_400,
      () =>
        this.request<IgdbGame[]>(
          'games',
          `${this.fields()} search "${this.escape(query)}"; ${this.where([], filters)} limit 100;`,
        ),
    );
    const ranked = rankByRelevanceAndPopularity(this.filtered(games, filters), query);
    return {
      page,
      totalPages: Math.max(1, Math.ceil(ranked.length / 20)),
      totalResults: ranked.length,
      results: ranked.slice((page - 1) * 20, page * 20),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    const now = Math.floor(Date.now() / 1000);
    return this.list(
      section === 'recent' ? 'sort first_release_date desc;' : 'sort total_rating_count desc;',
      [section === 'recent' ? `first_release_date <= ${now}` : 'total_rating_count > 25'],
      page,
      filters,
    );
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    const selector = /^\d+$/.test(externalId)
      ? `id = ${externalId}`
      : `slug = "${this.escape(externalId.replace(/^slug:/, ''))}"`;
    const games = await this.request<IgdbGame[]>(
      'games',
      `${this.fields(detailFields)} where ${selector}; limit 1;`,
    );
    const game = games[0];
    if (!game) {
      throw new NotFoundException('IGDB game not found');
    }
    const companies = (role: 'developer' | 'publisher') =>
      (game.involved_companies ?? [])
        .filter((involved) => involved[role])
        .map((involved) => involved.company?.name);
    return {
      ...this.normalize(game),
      credits: creditGroups([
        ['Developed by', companies('developer')],
        ['Published by', companies('publisher')],
      ]),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async releases(category: CatalogCategory, externalId: string) {
    return platformReleaseSignals((await this.details(category, externalId)).releaseDates ?? []);
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

  private async list(
    fragment: string,
    conditions: string[],
    page: number,
    filters: CatalogFilters,
  ) {
    const offset = (page - 1) * 20;
    const games = await this.request<IgdbGame[]>(
      'games',
      `${this.fields()} ${fragment} ${this.where(conditions, filters)} limit 20; offset ${offset};`,
    );
    return {
      page,
      totalPages: games.length === 20 ? page + 1 : page,
      totalResults: null,
      results: this.filtered(games, filters),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  private where(conditions: string[], filters: CatalogFilters) {
    const where = [...conditions];
    if (!filters.adult) {
      where.push(`themes != (${eroticTheme})`);
    }
    if (filters.year) {
      const start = Math.floor(Date.UTC(filters.year, 0, 1) / 1000);
      const end = Math.floor(Date.UTC(filters.year + 1, 0, 1) / 1000);
      where.push(`first_release_date >= ${start} & first_release_date < ${end}`);
    }
    return where.length ? `where ${where.join(' & ')};` : '';
  }

  private filtered(games: IgdbGame[], filters: CatalogFilters) {
    return games
      .map((game) => this.normalize(game))
      .filter((game) => filters.adult || !game.adult)
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
      status: game.game_status?.status ?? null,
      tagline: null,
      rating: game.total_rating ? game.total_rating / 10 : null,
      ratingCount: game.total_rating_count ?? 0,
      adult:
        game.themes?.includes(eroticTheme) === true ||
        looksAdult(
          [game.name, ...(game.alternative_names?.map((alternate) => alternate.name) ?? [])],
          game.summary ?? game.storyline ?? '',
          [],
        ),
      platforms: game.platforms?.map((platform) => platform.name) ?? [],
      releaseDates:
        game.release_dates?.flatMap((release) =>
          release.date
            ? [
                {
                  date: new Date(release.date * 1000).toISOString().slice(0, 10),
                  platform: release.platform?.name ?? null,
                },
              ]
            : [],
        ) ?? [],
      relationships,
      deepLinks: game.url ? [{ label: 'View on IGDB', url: game.url }] : [],
      capabilities: {
        progressUnits: ['hours', 'percentage'],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: true,
        supportsReleaseNotifications: true,
      },
    };
  }

  private fields(extra: string[] = []) {
    return `fields ${extra.map((field) => `${field},`).join('')}name,alternative_names.name,summary,storyline,first_release_date,cover.image_id,artworks.image_id,genres.name,platforms.name,total_rating,total_rating_count,game_status.status,franchises.name,dlcs.name,expansions.name,standalone_expansions.name,release_dates.date,release_dates.platform.name,themes,url;`;
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
    return this.http.json<T>(
      this.descriptor,
      new URL(`https://api.igdb.com/v4/${endpoint}`),
      {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token.access_token}`,
        },
        body,
      },
    );
  }

  private fetchToken(clientId: string, clientSecret: string) {
    const url = new URL('https://id.twitch.tv/oauth2/token');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');
    return this.http.json<TwitchToken>(this.descriptor, url, { method: 'POST' });
  }
}
