import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConnectorCacheService } from '../connector-cache.service';
import { ConnectorHttpService } from '../connector-http.service';
import {
  CatalogCandidate,
  CatalogCategory,
  CatalogDetails,
  CatalogFilters,
  CatalogPage,
  CatalogSection,
  ConnectorDescriptor,
} from '../source.types';

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: { fileName?: string; name?: string };
}

interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Array<Record<string, string>>;
    description: Record<string, string>;
    originalLanguage: string;
    year: number | null;
    status: string;
    lastVolume: string | null;
    lastChapter: string | null;
    tags: Array<{ attributes: { name: Record<string, string> } }>;
  };
  relationships: MangaDexRelationship[];
}

interface MangaDexList {
  data: MangaDexManga[];
  total: number;
  limit: number;
  offset: number;
}

interface MangaDexSingle {
  data: MangaDexManga;
}

interface MangaDexAggregate {
  volumes: Record<string, { chapters: Record<string, unknown> }>;
}

interface MangaDexTags {
  data: Array<{
    id: string;
    attributes: { name: Record<string, string>; group: string };
  }>;
}

@Injectable()
export class MangaDexService {
  readonly descriptor: ConnectorDescriptor = {
    key: 'mangadex',
    displayName: 'MangaDex',
    categories: ['manga', 'manhwa'],
    languages: [],
    attribution: 'Manga data provided by MangaDex',
    attributionUrl: 'https://mangadex.org/',
    capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'CHAPTERS', 'DEEP_LINK'],
    outboundDomains: ['mangadex.org'],
    requestIntervalMs: 220,
    enabled: true,
  };

  constructor(
    private readonly cache: ConnectorCacheService,
    private readonly http: ConnectorHttpService,
  ) {}

  async search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    return this.list(category, page, filters, query, 'relevance');
  }

  async browse(
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
      section === 'recent' ? 'year' : 'followedCount',
    );
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    const [response, aggregate] = await Promise.all([
      this.request<MangaDexSingle>(`/manga/${encodeURIComponent(externalId)}`, {
        'includes[]': ['cover_art', 'author', 'artist'],
      }),
      this.request<MangaDexAggregate>(
        `/manga/${encodeURIComponent(externalId)}/aggregate`,
        { 'translatedLanguage[]': ['en'] },
      ).catch(() => null),
    ]);
    const item = this.normalize(response.data);
    if (item.category !== category) {
      throw new NotFoundException('MangaDex title does not match this category');
    }
    return {
      ...item,
      chapterCount: aggregate
        ? this.latestMarker(
            Object.values(aggregate.volumes).flatMap((volume) =>
              Object.keys(volume.chapters),
            ),
            item.chapterCount,
          )
        : item.chapterCount,
      volumeCount: aggregate
        ? this.latestMarker(Object.keys(aggregate.volumes), item.volumeCount)
        : item.volumeCount,
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async genres() {
    return [...(await this.tags()).values()]
      .map(({ name }) => name)
      .sort((left, right) => left.localeCompare(right));
  }

  async recognize(
    url: URL,
  ): Promise<{ category: CatalogCategory; externalId: string } | null> {
    if (!/(^|\.)mangadex\.org$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/title\/([0-9a-f-]{36})/i);
    if (!match?.[1]) {
      return null;
    }
    const externalId = match[1].toLowerCase();
    const response = await this.request<MangaDexSingle>(
      `/manga/${encodeURIComponent(externalId)}`,
      {},
    );
    return {
      category:
        response.data.attributes.originalLanguage === 'ko' ? 'manhwa' : 'manga',
      externalId,
    };
  }

  private async list(
    category: CatalogCategory,
    page: number,
    filters: CatalogFilters,
    query: string | undefined,
    order: string,
  ): Promise<CatalogPage> {
    const selectedOrder = filters.sort ?? order;
    if (
      !['relevance', 'followedCount', 'latestUploadedChapter', 'year'].includes(
        selectedOrder,
      )
    ) {
      throw new BadRequestException('Sort does not match this media category');
    }
    const tag = filters.genre
      ? (await this.tags()).get(filters.genre.toLowerCase())
      : undefined;
    if (filters.genre && !tag) {
      throw new BadRequestException('Genre does not match this media category');
    }
    const response = await this.request<MangaDexList>('/manga', {
      limit: '20',
      offset: String((page - 1) * 20),
      ...(query ? { title: query } : {}),
      ...(filters.year ? { year: String(filters.year) } : {}),
      ...(filters.status ? { 'status[]': [filters.status] } : {}),
      ...(tag ? { 'includedTags[]': [tag.id] } : {}),
      ...(category === 'manhwa'
        ? { 'originalLanguage[]': ['ko'] }
        : { 'excludedOriginalLanguage[]': ['ko'] }),
      'includes[]': ['cover_art'],
      'contentRating[]': ['safe', 'suggestive'],
      [`order[${selectedOrder}]`]: 'desc',
    });
    return {
      page,
      totalPages: Math.max(1, Math.ceil(response.total / response.limit)),
      totalResults: response.total,
      results: response.data.map((manga) => this.normalize(manga)),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  private async tags() {
    const { value } = await this.cache.getOrLoad(
      'connector:mangadex:tags',
      604_800,
      2_592_000,
      () => this.request<MangaDexTags>('/manga/tag', {}),
    );
    return new Map(
      value.data
        .filter(({ attributes }) => attributes.group === 'genre')
        .map(({ id, attributes }) => {
          const name = this.localized(attributes.name);
          return [name.toLowerCase(), { id, name }] as const;
        }),
    );
  }

  private normalize(manga: MangaDexManga): CatalogCandidate {
    const category = manga.attributes.originalLanguage === 'ko' ? 'manhwa' : 'manga';
    const cover = manga.relationships.find(
      (relationship) => relationship.type === 'cover_art',
    )?.attributes?.fileName;
    const title = this.localized(manga.attributes.title);
    return {
      source: 'mangadex',
      externalId: manga.id,
      category,
      title,
      originalTitle: title,
      alternateTitles: manga.attributes.altTitles
        .flatMap((alternate) => Object.values(alternate))
        .filter((alternate, index, alternates) =>
          Boolean(alternate && alternate !== title && alternates.indexOf(alternate) === index),
        ),
      synopsis: this.localized(manga.attributes.description),
      posterUrl: cover
        ? `https://uploads.mangadex.org/covers/${manga.id}/${cover}.256.jpg`
        : null,
      backdropUrl: null,
      releaseDate: manga.attributes.year ? `${manga.attributes.year}-01-01` : null,
      language: manga.attributes.originalLanguage,
      genres: manga.attributes.tags
        .map((tag) => this.localized(tag.attributes.name))
        .filter(Boolean),
      runtimeMinutes: null,
      status: manga.attributes.status,
      tagline: null,
      rating: null,
      ratingCount: 0,
      chapterCount: manga.attributes.lastChapter
        ? Number(manga.attributes.lastChapter) || null
        : null,
      volumeCount: manga.attributes.lastVolume
        ? Number(manga.attributes.lastVolume) || null
        : null,
      deepLinks: [
        { label: 'View on MangaDex', url: `https://mangadex.org/title/${manga.id}` },
      ],
      capabilities: {
        progressUnits: ['chapter', 'volume'],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    };
  }

  private localized(values: Record<string, string>) {
    return values.en ?? values.ja ?? values.ko ?? Object.values(values)[0] ?? '';
  }

  private latestMarker(values: string[], fallback: number | null | undefined) {
    const markers = values
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0);
    return markers.length > 0 ? Math.max(...markers) : fallback ?? null;
  }

  private request<T>(path: string, parameters: Record<string, string | string[]>) {
    const url = new URL(`https://api.mangadex.org${path}`);
    Object.entries(parameters).forEach(([key, value]) => {
      (Array.isArray(value) ? value : [value]).forEach((entry) =>
        url.searchParams.append(key, entry),
      );
    });
    return this.http.json<T>(this.descriptor, url);
  }
}
