import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
      new MangaDexService().recognize(
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

    const result = await new MangaDexService().details('manhwa', mangaId);

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

    const result = await new MangaDexService().browse('manhwa', 'recent', 1, {});

    expect(result.results).toHaveLength(1);
    const [url] = request.mock.calls[0] as [URL];
    expect(url.searchParams.get('year')).toBe(String(new Date().getUTCFullYear()));
    expect(url.searchParams.get('order[year]')).toBe('desc');
  });

  it('normalizes IGDB platforms, releases, and game relationships', async () => {
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
    expect(request).toHaveBeenCalledTimes(3);
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
      return new ConnectorRegistryService(
        config,
        new TmdbService(config),
        new MangaDexService(),
        new IgdbService(config, cache as never),
        new RawgService(config),
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
});
