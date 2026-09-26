import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { looksAdult } from '../adult-content';
import { ConnectorCacheService } from '../connector-cache.service';
import { ConnectorHttpService } from '../connector-http.service';
import { creditGroups } from '../credits';
import { today } from '../release-signals';
import {
  CatalogCandidate,
  CatalogCategory,
  CatalogDetails,
  CatalogFilters,
  CatalogPage,
  CatalogSection,
  ConnectorDescriptor,
  ReleaseSignal,
} from '../source.types';

interface MangaUpdatesSeries {
  series_id: number;
  title: string;
  url: string;
  description: string | null;
  image: { url: { original: string | null } };
  type: string;
  year: string;
  bayesian_rating: number | null;
  rating_votes: number;
  genres: Array<{ genre: string }>;
  associated?: Array<{ title: string }>;
  latest_chapter?: number;
  status?: string | null;
  authors?: Array<{ name: string; type: string }>;
}

interface MangaUpdatesSearch {
  total_hits: number;
  per_page: number;
  results: Array<{ record: MangaUpdatesSeries; hit_title: string }>;
}

const adultGenres = ['Adult', 'Hentai', 'Lolicon', 'Shotacon', 'Smut'];

@Injectable()
export class MangaUpdatesService {
  readonly descriptor: ConnectorDescriptor = {
    key: 'mangaupdates',
    displayName: 'MangaUpdates',
    categories: ['manga', 'manhwa'],
    languages: [],
    attribution: 'Manga data provided by MangaUpdates',
    attributionUrl: 'https://www.mangaupdates.com/',
    capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'CHAPTERS', 'DEEP_LINK'],
    outboundDomains: ['mangaupdates.com'],
    requestIntervalMs: 500,
    enabled: true,
  };

  constructor(
    private readonly cache: ConnectorCacheService,
    private readonly http: ConnectorHttpService,
  ) {}

  search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    return this.list(category, page, filters, query, undefined);
  }

  browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    return this.list(
      category,
      page,
      section === 'recent' && !filters.year
        ? { ...filters, year: new Date().getUTCFullYear() }
        : filters,
      undefined,
      section === 'recent' ? 'month1_pos' : 'list_reading',
    );
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    const series = await this.series(externalId);
    if (series.type !== (category === 'manhwa' ? 'Manhwa' : 'Manga')) {
      throw new NotFoundException('MangaUpdates title does not match this category');
    }
    const people = (type: string) =>
      (series.authors ?? []).filter((author) => author.type === type).map(({ name }) => name);
    return {
      ...this.normalize(series, series.associated?.map(({ title }) => title) ?? []),
      credits: creditGroups([
        ['Story by', people('Author')],
        ['Art by', people('Artist')],
      ]),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async releases(category: CatalogCategory, externalId: string): Promise<ReleaseSignal[]> {
    const chapter = (await this.series(externalId)).latest_chapter;
    return chapter
      ? [
          {
            key: `chapter:${chapter}`,
            kind: 'chapter',
            label: `Chapter ${chapter}`,
            ordinal: chapter,
            occurredAt: today(),
          },
        ]
      : [];
  }

  async genres() {
    const { value } = await this.cache.getOrLoad(
      'connector:mangaupdates:genres',
      604_800,
      2_592_000,
      () => this.request<Array<{ genre: string }>>('/genres'),
    );
    return value
      .map(({ genre }) => genre)
      .filter((genre) => !adultGenres.includes(genre))
      .sort((left, right) => left.localeCompare(right));
  }

  async recognize(
    url: URL,
  ): Promise<{ category: CatalogCategory; externalId: string } | null> {
    if (!/(^|\.)mangaupdates\.com$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/series\/([0-9a-z]+)/i);
    if (!match?.[1]) {
      return null;
    }
    const externalId = String(parseInt(match[1], 36));
    const { type } = await this.series(externalId);
    return type === 'Manhwa'
      ? { category: 'manhwa', externalId }
      : type === 'Manga'
        ? { category: 'manga', externalId }
        : null;
  }

  private async list(
    category: CatalogCategory,
    page: number,
    filters: CatalogFilters,
    query: string | undefined,
    order: string | undefined,
  ): Promise<CatalogPage> {
    const orderby = filters.sort ?? order;
    if (orderby && !['list_reading', 'month1_pos', 'rating'].includes(orderby)) {
      throw new BadRequestException('Sort does not match this media category');
    }
    if (filters.status) {
      throw new BadRequestException('MangaUpdates does not filter by status');
    }
    const genre = filters.genre
      ? (await this.genres()).find(
          (name) => name.toLowerCase() === filters.genre?.toLowerCase(),
        )
      : undefined;
    if (filters.genre && !genre) {
      throw new BadRequestException('Genre does not match this media category');
    }
    const response = await this.request<MangaUpdatesSearch>('/series/search', {
      page,
      perpage: 25,
      type: [category === 'manhwa' ? 'Manhwa' : 'Manga'],
      ...(query ? { search: query } : {}),
      ...(orderby ? { orderby } : {}),
      ...(filters.year ? { year: String(filters.year) } : {}),
      ...(genre ? { genre: [genre] } : {}),
      ...(filters.adult ? {} : { exclude_genre: adultGenres }),
    });
    return {
      page,
      totalPages: Math.max(1, Math.ceil(response.total_hits / response.per_page)),
      totalResults: response.total_hits,
      results: response.results.map(({ record, hit_title }) =>
        this.normalize(record, [hit_title]),
      ),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  private normalize(series: MangaUpdatesSeries, alternates: string[]): CatalogCandidate {
    const genres = series.genres.map(({ genre }) => genre);
    const alternateTitles = [...new Set(alternates)].filter(
      (alternate) => alternate && alternate !== series.title,
    );
    const synopsis = series.description ?? '';
    const year = series.year.match(/^\d{4}/)?.[0];
    return {
      source: 'mangaupdates',
      externalId: String(series.series_id),
      category: series.type === 'Manhwa' ? 'manhwa' : 'manga',
      title: series.title,
      originalTitle: series.title,
      alternateTitles,
      synopsis,
      posterUrl: series.image.url.original,
      backdropUrl: null,
      releaseDate: year ? `${year}-01-01` : null,
      language: series.type === 'Manhwa' ? 'ko' : 'ja',
      genres,
      runtimeMinutes: null,
      status: series.status?.match(/\(([^)]+)\)/)?.[1] ?? null,
      tagline: null,
      rating: series.bayesian_rating || null,
      ratingCount: series.rating_votes,
      adult:
        genres.some((genre) => adultGenres.includes(genre)) ||
        looksAdult([series.title, ...alternateTitles], synopsis, []),
      chapterCount: series.latest_chapter || null,
      volumeCount: Number(series.status?.match(/(\d+) Volumes?/)?.[1]) || null,
      deepLinks: [{ label: 'View on MangaUpdates', url: series.url }],
      capabilities: {
        progressUnits: ['chapter', 'volume'],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    };
  }

  private series(externalId: string) {
    return this.request<MangaUpdatesSeries>(`/series/${encodeURIComponent(externalId)}`);
  }

  private request<T>(path: string, body?: object) {
    return this.http.json<T>(
      this.descriptor,
      new URL(`https://api.mangaupdates.com/v1${path}`),
      body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {},
    );
  }
}
