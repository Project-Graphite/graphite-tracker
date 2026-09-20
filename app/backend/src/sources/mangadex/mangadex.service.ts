import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class MangaDexService {
  private readonly baseUrl = 'https://api.mangadex.org';
  readonly descriptor: ConnectorDescriptor = {
    key: 'mangadex',
    displayName: 'MangaDex',
    categories: ['manga', 'manhwa'],
    languages: [],
    attribution: 'Manga data provided by MangaDex',
    capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'CHAPTERS', 'DEEP_LINK'],
    outboundDomains: ['mangadex.org', 'api.mangadex.org', 'uploads.mangadex.org'],
    enabled: true,
  };

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
      filters,
      undefined,
      section === 'recent' ? 'latestUploadedChapter' : 'followedCount',
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
      ).catch(() => ({ volumes: {} })),
    ]);
    const item = this.normalize(response.data);
    return {
      ...item,
      chapterCount: Object.values(aggregate.volumes).reduce(
        (total, volume) => total + Object.keys(volume.chapters).length,
        0,
      ),
      volumeCount: Object.keys(aggregate.volumes).filter((volume) => volume !== 'none').length,
      attribution: this.descriptor.attribution,
    };
  }

  recognize(url: URL): { category: CatalogCategory; externalId: string } | null {
    if (!/(^|\.)mangadex\.org$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/title\/([0-9a-f-]{36})/i);
    return match?.[1]
      ? { category: 'manga', externalId: match[1].toLowerCase() }
      : null;
  }

  private async list(
    category: CatalogCategory,
    page: number,
    filters: CatalogFilters,
    query?: string,
    order = 'relevance',
  ): Promise<CatalogPage> {
    if (category !== 'manga' && category !== 'manhwa') {
      throw new NotFoundException('MangaDex does not support this category');
    }
    const response = await this.request<MangaDexList>('/manga', {
      limit: '20',
      offset: String((page - 1) * 20),
      ...(query ? { title: query } : {}),
      ...(filters.year ? { year: String(filters.year) } : {}),
      ...(filters.status ? { 'status[]': [filters.status] } : {}),
      ...(category === 'manhwa' ? { 'originalLanguage[]': ['ko'] } : {}),
      'includes[]': ['cover_art'],
      'contentRating[]': ['safe', 'suggestive'],
      [`order[${filters.sort ?? order}]`]: 'desc',
    });
    const results = response.data
      .map((manga) => this.normalize(manga))
      .filter((manga) => manga.category === category)
      .filter(
        (manga) =>
          !filters.genre ||
          manga.genres.some(
            (genre) => genre.toLowerCase() === filters.genre?.toLowerCase(),
          ),
      );
    return {
      page,
      totalPages: Math.max(1, Math.ceil(response.total / response.limit)),
      totalResults: response.total,
      results,
      attribution: this.descriptor.attribution,
    };
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

  private async request<T>(
    path: string,
    parameters: Record<string, string | string[]>,
  ) {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(parameters).forEach(([key, value]) => {
      (Array.isArray(value) ? value : [value]).forEach((entry) =>
        url.searchParams.append(key, entry),
      );
    });
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new BadGatewayException('MangaDex request failed');
    }
    if (response.status === 404) {
      throw new NotFoundException('MangaDex title not found');
    }
    if (!response.ok) {
      throw new BadGatewayException(`MangaDex returned ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
