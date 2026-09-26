import { BadRequestException, Injectable } from '@nestjs/common';
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

interface AniListMedia {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  synonyms: string[];
  description: string | null;
  coverImage: { extraLarge: string | null };
  bannerImage: string | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  genres: string[];
  averageScore: number | null;
  isAdult: boolean;
  siteUrl: string;
  stats?: { scoreDistribution: Array<{ amount: number }> };
  studios?: { nodes: Array<{ name: string }> };
  staff?: { edges: Array<{ role: string; node: { name: { full: string } } }> };
  characters?: {
    edges: Array<{
      node: { name: { full: string } };
      voiceActors: Array<{ name: { full: string }; image: { medium: string | null } }>;
    }>;
  };
  trailer?: { id: string; site: string } | null;
}

const mediaFields = `
  id
  title { romaji english native }
  synonyms
  description(asHtml: false)
  coverImage { extraLarge }
  bannerImage
  startDate { year month day }
  format
  status
  episodes
  duration
  genres
  averageScore
  isAdult
  siteUrl
`;

const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

@Injectable()
export class AniListService {
  readonly descriptor: ConnectorDescriptor = {
    key: 'anilist',
    displayName: 'AniList',
    categories: ['anime'],
    languages: [],
    attribution: 'Anime data provided by AniList',
    attributionUrl: 'https://anilist.co/',
    capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'EPISODES', 'DEEP_LINK'],
    outboundDomains: ['anilist.co'],
    requestIntervalMs: 2_000,
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
    return this.list(page, filters, 'SEARCH_MATCH', { search: query });
  }

  browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
  ): Promise<CatalogPage> {
    const now = new Date();
    return this.list(
      page,
      filters,
      'POPULARITY_DESC',
      section === 'recent' && !filters.year
        ? {
            season: seasons[Math.floor(now.getUTCMonth() / 3)],
            seasonYear: now.getUTCFullYear(),
          }
        : {},
    );
  }

  async details(category: CatalogCategory, externalId: string): Promise<CatalogDetails> {
    const { Media: media } = await this.request<{ Media: AniListMedia }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ${mediaFields}
          stats { scoreDistribution { amount } }
          studios(isMain: true) { nodes { name } }
          staff(sort: RELEVANCE, perPage: 25) { edges { role node { name { full } } } }
          characters(sort: [ROLE, RELEVANCE], perPage: 15) {
            edges {
              node { name { full } }
              voiceActors(language: JAPANESE, sort: RELEVANCE) { name { full } image { medium } }
            }
          }
          trailer { id site }
        }
      }`,
      { id: Number(externalId) },
    );
    const staff = (...roles: string[]) =>
      (media.staff?.edges ?? [])
        .filter(({ role }) => roles.includes(role.replace(/ \(.*\)$/, '')))
        .map(({ node }) => node.name.full);
    return {
      ...this.normalize(media),
      ratingCount:
        media.stats?.scoreDistribution.reduce((total, { amount }) => total + amount, 0) ?? 0,
      credits: creditGroups([
        ['Directed by', staff('Director')],
        ['Original story by', staff('Original Creator', 'Original Story')],
        ['Studios', media.studios?.nodes.map(({ name }) => name) ?? []],
      ]),
      cast: (media.characters?.edges ?? []).flatMap(({ node, voiceActors }) =>
        voiceActors.slice(0, 1).map((actor) => ({
          name: actor.name.full,
          character: node.name.full,
          imageUrl: actor.image.medium,
        })),
      ),
      trailers:
        media.trailer?.site === 'youtube'
          ? [
              {
                name: 'Trailer',
                url: `https://www.youtube.com/watch?v=${encodeURIComponent(media.trailer.id)}`,
              },
            ]
          : [],
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  async releases(category: CatalogCategory, externalId: string): Promise<ReleaseSignal[]> {
    const { Media: media } = await this.request<{
      Media: Pick<AniListMedia, 'format' | 'status' | 'episodes'> & {
        nextAiringEpisode: { episode: number } | null;
      };
    }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) { format status episodes nextAiringEpisode { episode } }
      }`,
      { id: Number(externalId) },
    );
    if (media.format === 'MOVIE') {
      return media.status === 'FINISHED'
        ? [{ key: 'release', kind: 'release', label: 'Released', occurredAt: today() }]
        : [];
    }
    const episode = media.nextAiringEpisode
      ? media.nextAiringEpisode.episode - 1
      : media.status === 'FINISHED'
        ? media.episodes
        : null;
    return episode
      ? [
          {
            key: `episode:${episode}`,
            kind: 'episode',
            label: `Episode ${episode}`,
            ordinal: episode,
            occurredAt: today(),
          },
        ]
      : [];
  }

  async genres() {
    const { value } = await this.cache.getOrLoad(
      'connector:anilist:genres',
      604_800,
      2_592_000,
      () => this.request<{ GenreCollection: string[] }>('{ GenreCollection }', {}),
    );
    return value.GenreCollection.filter((genre) => genre !== 'Hentai').sort((left, right) =>
      left.localeCompare(right),
    );
  }

  recognize(url: URL): { category: CatalogCategory; externalId: string } | null {
    if (!/(^|\.)anilist\.co$/.test(url.hostname)) {
      return null;
    }
    const match = url.pathname.match(/^\/anime\/(\d+)/);
    return match?.[1] ? { category: 'anime', externalId: match[1] } : null;
  }

  private async list(
    page: number,
    filters: CatalogFilters,
    order: string,
    variables: Record<string, unknown>,
  ): Promise<CatalogPage> {
    if (
      filters.sort &&
      !['TRENDING_DESC', 'POPULARITY_DESC', 'SCORE_DESC', 'START_DATE_DESC'].includes(filters.sort)
    ) {
      throw new BadRequestException('Sort does not match this media category');
    }
    const status = filters.status?.toUpperCase();
    if (
      status &&
      !['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'].includes(status)
    ) {
      throw new BadRequestException('Status does not match this media category');
    }
    const genre = filters.genre
      ? (await this.genres()).find((name) => name.toLowerCase() === filters.genre?.toLowerCase())
      : undefined;
    if (filters.genre && !genre) {
      throw new BadRequestException('Genre does not match this media category');
    }
    const { Page: result } = await this.request<{
      Page: { pageInfo: { total: number; lastPage: number }; media: AniListMedia[] };
    }>(
      `query (
        $page: Int, $search: String, $sort: [MediaSort], $season: MediaSeason, $seasonYear: Int,
        $genre: String, $status: MediaStatus, $isAdult: Boolean
      ) {
        Page(page: $page, perPage: 20) {
          pageInfo { total lastPage }
          media(
            type: ANIME, countryOfOrigin: "JP", format_not: MUSIC, search: $search, sort: $sort,
            season: $season, seasonYear: $seasonYear, genre: $genre, status: $status,
            isAdult: $isAdult
          ) { ${mediaFields} }
        }
      }`,
      {
        page,
        sort: [filters.sort ?? order],
        ...variables,
        ...(filters.year ? { seasonYear: filters.year } : {}),
        ...(genre ? { genre } : {}),
        ...(status ? { status } : {}),
        ...(filters.adult ? {} : { isAdult: false }),
      },
    );
    return {
      page,
      totalPages: Math.max(1, result.pageInfo.lastPage),
      totalResults: result.pageInfo.total,
      results: result.media.map((media) => this.normalize(media)),
      attribution: this.descriptor.attribution,
      attributionUrl: this.descriptor.attributionUrl,
    };
  }

  private normalize(media: AniListMedia): CatalogCandidate {
    const title = media.title.english ?? media.title.romaji;
    const alternateTitles = [
      ...new Set([media.title.romaji, media.title.english, ...media.synonyms]),
    ].filter((alternate): alternate is string => Boolean(alternate) && alternate !== title);
    const synopsis = (media.description ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const { year, month, day } = media.startDate;
    const movie = media.format === 'MOVIE';
    return {
      source: 'anilist',
      externalId: String(media.id),
      category: 'anime',
      title,
      originalTitle: media.title.native ?? media.title.romaji,
      alternateTitles,
      synopsis,
      posterUrl: media.coverImage.extraLarge,
      backdropUrl: media.bannerImage,
      releaseDate: year
        ? [year, month ?? 1, day ?? 1].map((part) => String(part).padStart(2, '0')).join('-')
        : null,
      language: 'ja',
      genres: media.genres,
      runtimeMinutes: media.duration,
      status: media.status
        ? media.status.charAt(0) + media.status.slice(1).toLowerCase().replace(/_/g, ' ')
        : null,
      tagline: null,
      rating: media.averageScore ? media.averageScore / 10 : null,
      ratingCount: 0,
      adult: media.isAdult || looksAdult([title, ...alternateTitles], synopsis, media.genres),
      episodeCount: media.episodes,
      seasonCount: null,
      deepLinks: [{ label: 'View on AniList', url: media.siteUrl }],
      capabilities: {
        progressUnits: movie ? [] : ['episode'],
        hasEpisodes: !movie,
        hasSeasons: false,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    };
  }

  private async request<T>(query: string, variables: Record<string, unknown>) {
    const { data } = await this.http.json<{ data: T }>(
      this.descriptor,
      new URL('https://graphql.anilist.co'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      },
    );
    return data;
  }
}
