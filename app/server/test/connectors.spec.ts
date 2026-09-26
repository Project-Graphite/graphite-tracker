import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { ConnectorRegistryService } from '../src/sources/connector-registry.service';
import { IgdbService } from '../src/sources/igdb/igdb.service';
import { MangaDexService } from '../src/sources/mangadex/mangadex.service';
import { RawgService } from '../src/sources/rawg/rawg.service';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';

const mangaId = '11111111-2222-3333-4444-555555555555';
const manhwa = {
  id: mangaId,
  attributes: {
    title: { en: 'Tower Story' },
    altTitles: [{ ko: '탑 이야기' }],
    description: { en: 'A climber enters a mysterious tower.' },
    originalLanguage: 'ko',
    contentRating: 'safe',
    year: 2020,
    status: 'ongoing',
    lastVolume: '3',
    lastChapter: '12.5',
    tags: [{ attributes: { name: { en: 'Adventure' } } }],
  },
  relationships: [
    {
      id: 'cover-id',
      type: 'cover_art',
      attributes: { fileName: 'cover.jpg' },
    },
  ],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const igdbCache = () => ({
  getOrLoad: vi.fn((key: string, _fresh: number, _stale: number, load: () => Promise<unknown>) =>
    key === 'connector:igdb:token'
      ? Promise.resolve({ value: { access_token: 'token', expires_in: 3600 }, stale: false })
      : load().then((value) => ({ value, stale: false })),
  ),
});

describe('Source connectors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognizes a Korean MangaDex URL as manhwa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: manhwa }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      new MangaDexService({} as never, new ConnectorHttpService()).recognize(
        new URL(`https://mangadex.org/title/${mangaId}/tower-story`),
      ),
    ).resolves.toEqual({ category: 'manhwa', externalId: mangaId });
  });

  it('uses the latest MangaDex chapter marker instead of a chapter count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: URL) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              input.pathname.endsWith('/aggregate')
                ? {
                    volumes: {
                      '1': { chapters: { '1': {}, '2.5': {}, '12.5': {} } },
                      none: { chapters: { '4': {} } },
                    },
                  }
                : { data: manhwa },
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );

    const result = await new MangaDexService({} as never, new ConnectorHttpService()).details(
      'manhwa',
      mangaId,
    );

    expect(result).toMatchObject({
      category: 'manhwa',
      chapterCount: 12.5,
      volumeCount: 1,
      alternateTitles: ['탑 이야기'],
    });
  });

  it('loads recent MangaDex titles from the current release year', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              ...manhwa,
              attributes: {
                ...manhwa.attributes,
                year: new Date().getUTCFullYear(),
              },
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', request);

    const result = await new MangaDexService({} as never, new ConnectorHttpService()).browse(
      'manhwa',
      'recent',
      1,
      {},
    );

    expect(result.results).toHaveLength(1);
    const [url] = request.mock.calls[0] as [URL];
    expect(url.searchParams.get('year')).toBe(String(new Date().getUTCFullYear()));
    expect(url.searchParams.get('order[year]')).toBe('desc');
  });

  it('normalizes IGDB platforms, releases listed once per region, and game relationships', async () => {
    const cache = {
      getOrLoad: vi.fn().mockResolvedValue({
        value: { access_token: 'token', expires_in: 3600 },
        stale: false,
      }),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: 42,
              name: 'Graphite Quest',
              alternative_names: [{ id: 1, name: 'GQ' }],
              summary: 'A game about careful tracking.',
              first_release_date: 1_893_456_000,
              platforms: [{ id: 6, name: 'PC' }],
              release_dates: [
                { date: 1_893_456_000, platform: { id: 6, name: 'PC' } },
                { date: 1_893_456_000, platform: { id: 6, name: 'PC' } },
              ],
              franchises: [{ id: 8, name: 'Graphite' }],
              dlcs: [{ id: 43, name: 'Graphite Quest: More' }],
              expansions: [{ id: 44, name: 'Graphite Quest: Beyond' }],
              url: 'https://www.igdb.com/games/graphite-quest',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const service = new IgdbService(
      new ConfigService({
        IGDB_CLIENT_ID: 'client',
        IGDB_CLIENT_SECRET: 'secret',
      }),
      cache as never,
      new ConnectorHttpService(),
    );

    const result = await service.details('game', '42');

    expect(result).toMatchObject({
      externalId: '42',
      alternateTitles: ['GQ'],
      platforms: ['PC'],
      releaseDates: [{ date: '2030-01-01', platform: 'PC' }],
      relationships: [
        { type: 'franchise', externalId: '8', title: 'Graphite' },
        { type: 'dlc', externalId: '43', title: 'Graphite Quest: More' },
        { type: 'expansion', externalId: '44', title: 'Graphite Quest: Beyond' },
      ],
    });
  });

  it('normalizes RAWG details and authenticates every request', async () => {
    const request = vi.fn().mockImplementation((input: URL) => {
      const body = input.pathname.endsWith('/additions')
        ? {
            count: 1,
            next: null,
            previous: null,
            results: [{ id: 43, slug: 'graphite-quest-more', name: 'Graphite Quest: More' }],
          }
        : input.pathname.endsWith('/game-series')
          ? {
              count: 1,
              next: null,
              previous: null,
              results: [{ id: 44, slug: 'graphite-origins', name: 'Graphite Origins' }],
            }
          : {
              id: 42,
              slug: 'graphite-quest',
              name: 'Graphite Quest',
              name_original: 'Graphite Quest Original',
              description_raw: 'A game about careful tracking.',
              released: '2030-01-01',
              background_image: 'https://media.rawg.io/media/games/graphite.jpg',
              rating: 4.2,
              ratings_count: 125,
              genres: [{ id: 4, name: 'Action', slug: 'action' }],
              platforms: [
                {
                  platform: { id: 6, name: 'PC', slug: 'pc' },
                  released_at: '2030-01-01',
                },
              ],
            };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', request);
    const service = new RawgService(
      new ConfigService({ RAWG_API_KEY: 'rawg-key' }),
      new ConnectorHttpService(),
    );

    const result = await service.details('game', '42');

    expect(result).toMatchObject({
      source: 'rawg',
      externalId: '42',
      originalTitle: 'Graphite Quest Original',
      alternateTitles: ['Graphite Quest Original'],
      rating: 8.4,
      ratingCount: 125,
      platforms: ['PC'],
      releaseDates: [{ date: '2030-01-01', platform: 'PC' }],
      relationships: [
        { type: 'series', externalId: '44', title: 'Graphite Origins' },
        { type: 'dlc', externalId: '43', title: 'Graphite Quest: More' },
      ],
      attributionUrl: 'https://rawg.io/',
    });
    expect(request).toHaveBeenCalledTimes(4);
    request.mock.calls.forEach(([url]) => {
      expect((url as URL).searchParams.get('key')).toBe('rawg-key');
    });
    expect(
      service.recognize(new URL('https://rawg.io/games/graphite-quest')),
    ).toEqual({ category: 'game', externalId: 'slug:graphite-quest' });
  });

  it('activates only the game source selected by GAME_SOURCE', () => {
    const registryFor = (gameSource?: string) => {
      const config = new ConfigService({
        ...(gameSource ? { GAME_SOURCE: gameSource } : {}),
        IGDB_CLIENT_ID: 'client',
        IGDB_CLIENT_SECRET: 'secret',
        RAWG_API_KEY: 'rawg-key',
      });
      const cache = { getOrLoad: vi.fn() };
      const http = new ConnectorHttpService();
      return new ConnectorRegistryService(
        config,
        new TmdbService(config, http),
        new MangaDexService(cache as never, http),
        new IgdbService(config, cache as never, http),
        new RawgService(config, http),
        cache as never,
      );
    };
    const rawgRegistry = registryFor('rawg');

    expect(
      rawgRegistry
        .list('game')
        .map(({ key, enabled }) => ({ key, enabled })),
    ).toEqual([
      { key: 'igdb', enabled: false },
      { key: 'rawg', enabled: true },
    ]);
    expect(rawgRegistry.resolve('game').descriptor.key).toBe('rawg');
    expect(registryFor().resolve('game').descriptor.key).toBe('igdb');
  });

  it('filters MangaDex by the tag ID of the selected genre', async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], total: 0, limit: 20, offset: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', request);
    const cache = {
      getOrLoad: vi.fn().mockResolvedValue({
        value: {
          data: [
            { id: 'tag-romance', attributes: { name: { en: 'Romance' }, group: 'genre' } },
            { id: 'tag-long-strip', attributes: { name: { en: 'Long Strip' }, group: 'format' } },
          ],
        },
        stale: false,
      }),
    };
    const service = new MangaDexService(cache as never, new ConnectorHttpService());

    await service.search('manga', 'tower', 1, { genre: 'romance' });

    const [url] = request.mock.calls[0] as [URL];
    expect(url.searchParams.getAll('includedTags[]')).toEqual(['tag-romance']);
    await expect(service.genres()).resolves.toEqual(['Romance']);
    await expect(
      service.search('manga', 'tower', 1, { genre: 'Long Strip' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps adult titles out of lists unless the reader opted in, and asks the sources to do it', async () => {
    const config = new ConfigService({
      TMDB_READ_ACCESS_TOKEN: 'tmdb-token',
      IGDB_CLIENT_ID: 'client',
      IGDB_CLIENT_SECRET: 'secret',
      RAWG_API_KEY: 'rawg-key',
    });
    const http = new ConnectorHttpService();
    const igdbGames = [
      { id: 1, name: 'Safe Quest', themes: [1] },
      { id: 2, name: 'Adult Quest', themes: [1, 42] },
    ];
    const request = vi.fn().mockImplementation((input: URL) =>
      Promise.resolve(
        json(
          input.hostname === 'api.themoviedb.org'
            ? { page: 1, total_pages: 1, total_results: 1, results: [{ id: 7, title: 'Adult Film', original_title: 'Adult Film', overview: '', adult: true }] }
            : input.hostname === 'api.mangadex.org'
              ? { data: [{ ...manhwa, attributes: { ...manhwa.attributes, contentRating: 'erotica' } }], total: 1, limit: 20, offset: 0 }
              : input.hostname === 'api.igdb.com'
                ? igdbGames
                : {
                    count: 2,
                    next: null,
                    previous: null,
                    results: [
                      { id: 1, slug: 'safe', name: 'Safe Game' },
                      { id: 2, slug: 'adult', name: 'Adult Game', esrb_rating: { id: 5, name: 'Adults Only', slug: 'adults-only' } },
                    ],
                  },
        ),
      ),
    );
    vi.stubGlobal('fetch', request);
    const igdb = new IgdbService(config, igdbCache() as never, http);
    const rawg = new RawgService(config, http);
    const tmdb = new TmdbService(config, http);
    const mangadex = new MangaDexService(igdbCache() as never, http);

    const safeGames = await igdb.search('game', 'quest', 1, {});
    expect(safeGames.results.map(({ title }) => title)).toEqual(['Safe Quest']);
    expect(safeGames.totalResults).toBe(1);
    expect(String((request.mock.calls.at(-1) as [URL, RequestInit])[1].body)).toContain(
      'where themes != (42); limit 100;',
    );
    const allGames = await igdb.search('game', 'quest', 1, { adult: true });
    expect(allGames.results.map(({ title, adult }) => `${title}:${adult}`)).toEqual([
      'Safe Quest:false',
      'Adult Quest:true',
    ]);
    expect(String((request.mock.calls.at(-1) as [URL, RequestInit])[1].body)).not.toContain(
      'themes !=',
    );

    const rawgPage = await rawg.search('game', 'game', 1, {});
    expect(rawgPage.results.map(({ title, adult }) => `${title}:${adult}`)).toEqual([
      'Safe Game:false',
      'Adult Game:true',
    ]);
    expect(rawgPage.totalResults).toBe(2);
    expect((request.mock.calls.at(-1) as [URL])[0].searchParams.get('page_size')).toBe('40');

    await tmdb.search('movie', 'film', 1, {});
    expect((request.mock.calls.at(-1) as [URL])[0].searchParams.get('include_adult')).toBe('false');
    const adultFilms = await tmdb.search('movie', 'film', 1, { adult: true });
    expect((request.mock.calls.at(-1) as [URL])[0].searchParams.get('include_adult')).toBe('true');
    expect(adultFilms.results[0]).toMatchObject({ adult: true });

    await mangadex.search('manhwa', 'tower', 1, {});
    expect((request.mock.calls.at(-1) as [URL])[0].searchParams.getAll('contentRating[]')).toEqual([
      'safe',
      'suggestive',
    ]);
    const adultManhwa = await mangadex.search('manhwa', 'tower', 1, { adult: true });
    expect((request.mock.calls.at(-1) as [URL])[0].searchParams.getAll('contentRating[]')).toEqual([
      'safe',
      'suggestive',
      'erotica',
      'pornographic',
    ]);
    expect(adultManhwa.results[0]).toMatchObject({ adult: true });
  });

  it('hides adult titles from readers who did not opt in, after the cache', async () => {
    const config = new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'tmdb-token' });
    const http = new ConnectorHttpService();
    const film = { id: 7, title: 'Adult Film', original_title: 'Adult Film', overview: '', adult: true };
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL) =>
        Promise.resolve(
          json(
            input.pathname.includes('/search/')
              ? { page: 1, total_pages: 1, total_results: 1, results: [film] }
              : film,
          ),
        ),
      ),
    );
    const registry = new ConnectorRegistryService(
      config,
      new TmdbService(config, http),
      new MangaDexService(igdbCache() as never, http),
      new IgdbService(config, igdbCache() as never, http),
      new RawgService(config, http),
      igdbCache() as never,
    );

    await expect(registry.details('movie', '7')).rejects.toBeInstanceOf(NotFoundException);
    await expect(registry.details('movie', '7', undefined, true)).resolves.toMatchObject({
      title: 'Adult Film',
      adult: true,
    });
    await expect(registry.search('movie', 'film', 1, {})).resolves.toMatchObject({
      results: [],
      totalResults: null,
    });
    await expect(registry.search('movie', 'film', 1, { adult: true })).resolves.toMatchObject({
      results: [{ title: 'Adult Film', adult: true }],
      totalResults: 1,
    });
  });

  it('shares one cached search between spellings that differ only in case', async () => {
    const config = new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'tmdb-token' });
    const http = new ConnectorHttpService();
    const request = vi.fn(() =>
      Promise.resolve(json({ page: 1, total_pages: 1, total_results: 0, results: [] })),
    );
    vi.stubGlobal('fetch', request);
    const cache = igdbCache();
    const registry = new ConnectorRegistryService(
      config,
      new TmdbService(config, http),
      new MangaDexService(igdbCache() as never, http),
      new IgdbService(config, igdbCache() as never, http),
      new RawgService(config, http),
      cache as never,
    );

    await registry.search('movie', 'Fight Club', 1, {});
    await registry.search('movie', 'fight club', 1, {});

    const [first, second] = cache.getOrLoad.mock.calls;
    expect(first?.[0]).toBe(second?.[0]);
    expect((request.mock.calls[0] as unknown as [URL])[0].searchParams.get('query')).toBe(
      'fight club',
    );
  });

  it('ranks game searches by relevance and popularity across a 100-result window', async () => {
    const config = new ConfigService({ IGDB_CLIENT_ID: 'client', IGDB_CLIENT_SECRET: 'secret' });
    const games = [
      { id: 1, name: 'Portal Knights', total_rating_count: 40 },
      { id: 2, name: 'Portal 2', total_rating_count: 3_000 },
      { id: 3, name: 'Portal', total_rating_count: 2_500 },
      ...Array.from({ length: 22 }, (_, index) => ({
        id: 10 + index,
        name: `Portal Fan Game ${index}`,
        total_rating_count: 1,
      })),
    ];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(games))));
    const igdb = new IgdbService(config, igdbCache() as never, new ConnectorHttpService());

    const first = await igdb.search('game', 'portal', 1, {});
    const second = await igdb.search('game', 'portal', 2, {});

    expect(first.results.slice(0, 3).map(({ title }) => title)).toEqual([
      'Portal',
      'Portal 2',
      'Portal Knights',
    ]);
    expect(first).toMatchObject({ page: 1, totalPages: 2, totalResults: 25 });
    expect(first.results).toHaveLength(20);
    expect(second.results).toHaveLength(5);
  });

  it('disables connectors named in DISABLED_SOURCES without removing them', () => {
    const config = new ConfigService({ DISABLED_SOURCES: ' MangaDex ,unknown' });
    const cache = { getOrLoad: vi.fn() };
    const http = new ConnectorHttpService();
    const registry = new ConnectorRegistryService(
      config,
      new TmdbService(config, http),
      new MangaDexService(cache as never, http),
      new IgdbService(config, cache as never, http),
      new RawgService(config, http),
      cache as never,
    );

    expect(registry.list('manga')).toMatchObject([{ key: 'mangadex', enabled: false }]);
    expect(() => registry.resolve('manga')).toThrow(NotFoundException);
    expect(registry.resolve('movie').descriptor.key).toBe('tmdb');
  });
});
