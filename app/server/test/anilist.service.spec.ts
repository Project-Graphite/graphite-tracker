import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AniListService } from '../src/sources/anilist/anilist.service';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { ConnectorRegistryService } from '../src/sources/connector-registry.service';
import { IgdbService } from '../src/sources/igdb/igdb.service';
import { MangaDexService } from '../src/sources/mangadex/mangadex.service';
import { MangaUpdatesService } from '../src/sources/mangaupdates/mangaupdates.service';
import { RawgService } from '../src/sources/rawg/rawg.service';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';

const media = {
  id: 154587,
  title: {
    romaji: 'Sousou no Frieren',
    english: 'Frieren: Beyond Journey’s End',
    native: '葬送のフリーレン',
  },
  synonyms: ['Frieren at the Funeral', 'Sousou no Frieren'],
  description:
    'The adventure is over.<br>\n<br>\nFrieren sets out again.<br><br>\r\n<i>(Source: Crunchyroll)</i>',
  coverImage: { extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/frieren.jpg' },
  bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/frieren.jpg',
  startDate: { year: 2023, month: 9, day: 29 },
  format: 'TV',
  status: 'FINISHED',
  episodes: 28,
  duration: 24,
  genres: ['Adventure', 'Drama', 'Fantasy'],
  averageScore: 91,
  isAdult: false,
  siteUrl: 'https://anilist.co/anime/154587',
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const genreCache = () => ({
  getOrLoad: vi.fn().mockResolvedValue({
    value: { GenreCollection: ['Action', 'Hentai', 'Slice of Life'] },
    stale: false,
  }),
});

const anilist = () => new AniListService(genreCache() as never, new ConnectorHttpService());

const pageOf = (items: unknown[]) =>
  json({ data: { Page: { pageInfo: { total: 5000, lastPage: 250 }, media: items } } });

const sent = (request: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(String((request.mock.calls[call] as [URL, RequestInit])[1].body)) as {
    query: string;
    variables: Record<string, unknown>;
  };

describe('AniListService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('browses popular Japanese anime without music videos or adult titles', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(pageOf([media])));
    vi.stubGlobal('fetch', request);

    const result = await anilist().browse('anime', 'popular', 1, {});

    const [url, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://graphql.anilist.co/');
    expect(init.method).toBe('POST');
    const { query, variables } = sent(request);
    expect(query).toContain('countryOfOrigin: "JP"');
    expect(query).toContain('format_not: MUSIC');
    expect(variables).toEqual({ page: 1, sort: ['POPULARITY_DESC'], isAdult: false });
    expect(result).toMatchObject({ page: 1, totalPages: 250, totalResults: 5000 });
    expect(result.results[0]).toMatchObject({
      source: 'anilist',
      externalId: '154587',
      category: 'anime',
      title: 'Frieren: Beyond Journey’s End',
      originalTitle: '葬送のフリーレン',
      alternateTitles: ['Sousou no Frieren', 'Frieren at the Funeral'],
      synopsis: 'The adventure is over.\n\nFrieren sets out again.\n\n(Source: Crunchyroll)',
      posterUrl: media.coverImage.extraLarge,
      backdropUrl: media.bannerImage,
      releaseDate: '2023-09-29',
      language: 'ja',
      runtimeMinutes: 24,
      status: 'Finished',
      rating: 9.1,
      adult: false,
      episodeCount: 28,
      deepLinks: [{ label: 'View on AniList', url: 'https://anilist.co/anime/154587' }],
      capabilities: { progressUnits: ['episode'], hasEpisodes: true, hasSeasons: false },
    });
  });

  it('shows the current season as recent unless a year is chosen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const request = vi.fn().mockImplementation(() => Promise.resolve(pageOf([])));
    vi.stubGlobal('fetch', request);

    vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    await anilist().browse('anime', 'recent', 1, {});
    vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
    await anilist().browse('anime', 'recent', 1, {});
    await anilist().browse('anime', 'recent', 2, { year: 2019, sort: 'SCORE_DESC' });

    expect(sent(request, 0).variables).toMatchObject({ season: 'SUMMER', seasonYear: 2026 });
    expect(sent(request, 1).variables).toMatchObject({ season: 'FALL', seasonYear: 2026 });
    expect(sent(request, 2).variables).toEqual({
      page: 2,
      sort: ['SCORE_DESC'],
      seasonYear: 2019,
      isAdult: false,
    });
  });

  it('searches with the chosen genre and status and lets adult viewers opt in', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(pageOf([])));
    vi.stubGlobal('fetch', request);
    const service = anilist();

    await service.search('anime', 'frieren', 1, {
      genre: 'slice of life',
      status: 'releasing',
      adult: true,
    });

    expect(sent(request).variables).toEqual({
      page: 1,
      sort: ['SEARCH_MATCH'],
      search: 'frieren',
      genre: 'Slice of Life',
      status: 'RELEASING',
    });
    await expect(service.genres()).resolves.toEqual(['Action', 'Slice of Life']);
  });

  it.each([
    [{ sort: 'popularity.desc' }],
    [{ status: 'returning' }],
    [{ genre: 'Hentai' }],
  ])('rejects filters it cannot apply: %o', async (filters) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(anilist().browse('anime', 'popular', 1, filters)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('loads details with staff, studios, voice cast, trailer and vote count', async () => {
    const request = vi.fn().mockImplementation(() =>
      Promise.resolve(
        json({
          data: {
            Media: {
              ...media,
              stats: { scoreDistribution: [{ amount: 1_000 }, { amount: 234 }] },
              studios: { nodes: [{ name: 'MADHOUSE' }] },
              staff: {
                edges: [
                  { role: 'Original Story', node: { name: { full: 'Kanehito Yamada' } } },
                  { role: 'Director (eps 1-28)', node: { name: { full: 'Keiichirou Saitou' } } },
                  { role: 'Episode Director (ep 3)', node: { name: { full: 'Someone Else' } } },
                ],
              },
              characters: {
                edges: [
                  {
                    node: { name: { full: 'Frieren' } },
                    voiceActors: [
                      { name: { full: 'Atsumi Tanezaki' }, image: { medium: 'https://s4.anilist.co/va.jpg' } },
                    ],
                  },
                  { node: { name: { full: 'Narrator' } }, voiceActors: [] },
                ],
              },
              trailer: { id: 'tR8YH0G67Rk', site: 'youtube' },
            },
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', request);

    const result = await anilist().details('anime', '154587');

    expect(sent(request).variables).toEqual({ id: 154587 });
    expect(result).toMatchObject({
      ratingCount: 1_234,
      credits: [
        { role: 'Directed by', names: ['Keiichirou Saitou'] },
        { role: 'Original story by', names: ['Kanehito Yamada'] },
        { role: 'Studios', names: ['MADHOUSE'] },
      ],
      cast: [
        { name: 'Atsumi Tanezaki', character: 'Frieren', imageUrl: 'https://s4.anilist.co/va.jpg' },
      ],
      trailers: [{ name: 'Trailer', url: 'https://www.youtube.com/watch?v=tR8YH0G67Rk' }],
      attribution: 'Anime data provided by AniList',
      attributionUrl: 'https://anilist.co/',
    });
  });

  it.each([
    [{ format: 'TV', status: 'RELEASING', episodes: null, nextAiringEpisode: { episode: 14 } }, 'episode:13'],
    [{ format: 'TV', status: 'FINISHED', episodes: 28, nextAiringEpisode: null }, 'episode:28'],
    [{ format: 'TV', status: 'NOT_YET_RELEASED', episodes: 12, nextAiringEpisode: { episode: 1 } }, null],
    [{ format: 'MOVIE', status: 'FINISHED', episodes: 1, nextAiringEpisode: null }, 'release'],
    [{ format: 'MOVIE', status: 'NOT_YET_RELEASED', episodes: 1, nextAiringEpisode: null }, null],
  ])('reports the latest aired episode or the film release: %o', async (state, key) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: { Media: state } })));

    const signals = await anilist().releases('anime', '154587');

    expect(signals.map((signal) => signal.key)).toEqual(key ? [key] : []);
  });

  it('recognizes anime links only', () => {
    const service = anilist();

    expect(service.recognize(new URL('https://anilist.co/anime/154587/Sousou-no-Frieren/'))).toEqual({
      category: 'anime',
      externalId: '154587',
    });
    expect(service.recognize(new URL('https://anilist.co/manga/118586'))).toBeNull();
    expect(service.recognize(new URL('https://www.themoviedb.org/tv/209867'))).toBeNull();
  });

  it('is the default anime source while TMDB stays selectable', () => {
    const config = new ConfigService();
    const cache = { getOrLoad: vi.fn() };
    const http = new ConnectorHttpService();
    const registry = new ConnectorRegistryService(
      config,
      new AniListService(cache as never, http),
      new TmdbService(config, http),
      new MangaUpdatesService(cache as never, http),
      new MangaDexService(cache as never, http),
      new IgdbService(config, cache as never, http),
      new RawgService(config, http),
      cache as never,
    );

    expect(registry.resolve('anime').descriptor.key).toBe('anilist');
    expect(registry.resolve('anime', 'tmdb').descriptor.key).toBe('tmdb');
    expect(registry.resolve('tv').descriptor.key).toBe('tmdb');
  });
});
