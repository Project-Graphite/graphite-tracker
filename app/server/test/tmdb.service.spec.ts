import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';
import { TmdbSearchResponse } from '../src/sources/tmdb/tmdb.types';

const fixture = JSON.parse(
  readFileSync(
    join(process.cwd(), 'test', 'fixtures', 'tmdb', 'movie-search.json'),
    'utf8',
  ),
) as TmdbSearchResponse;

describe('TmdbService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes the movie contract from a committed fixture', () => {
    const service = new TmdbService(new ConfigService(), new ConnectorHttpService());

    expect(service.normalizeMovie(fixture.results[0]!)).toEqual({
      source: 'tmdb',
      externalId: '550',
      category: 'movie',
      title: 'Fight Club',
      originalTitle: 'Fight Club',
      synopsis: 'An insomniac encounters a soap maker.',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      releaseDate: '1999-10-15',
      language: 'en',
      genres: ['Drama', 'Thriller'],
      runtimeMinutes: null,
      status: null,
      tagline: null,
      rating: null,
      ratingCount: 0,
      adult: false,
      deepLinks: [
        {
          label: 'View on TMDB',
          url: 'https://www.themoviedb.org/movie/550',
        },
      ],
      capabilities: {
        progressUnits: [],
        hasEpisodes: false,
        hasSeasons: false,
        hasPlatforms: false,
        supportsReleaseNotifications: true,
      },
    });
  });

  it('excludes adult results and authenticates server-side searches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    const result = await service.searchMovies('fight club', 1);

    expect(result.results).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get('include_adult')).toBe('false');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer server-token' });
  });

  it.each([
    ['recentMovies', '/movie/now_playing'],
    ['popularMovies', '/movie/popular'],
  ] as const)('loads %s from the matching TMDB collection', async (method, path) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    const result = await service[method](1);

    expect(result.results[0]?.title).toBe('Fight Club');
    expect((fetchMock.mock.calls[0] as [URL])[0].pathname).toBe(`/3${path}`);
  });

  it('orders recent TV and anime by their release fields', async () => {
    const fetchMock = vi.fn().mockImplementation((input: URL) => {
      const isMovie = input.pathname.endsWith('/discover/movie');
      return Promise.resolve(
        new Response(
          JSON.stringify({
            page: 1,
            total_pages: 1,
            total_results: 1,
            results: isMovie
              ? [
                  {
                    id: 1,
                    title: 'New anime movie',
                    original_title: 'New anime movie',
                    overview: '',
                    original_language: 'ja',
                    genre_ids: [16],
                    release_date: '2026-09-01',
                    vote_average: 5,
                    vote_count: 1,
                  },
                ]
              : [
                  {
                    id: 2,
                    name: 'New anime show',
                    original_name: 'New anime show',
                    overview: '',
                    original_language: 'ja',
                    origin_country: ['JP'],
                    genre_ids: [16],
                    first_air_date: '2026-08-01',
                    vote_average: 9,
                    vote_count: 1,
                  },
                ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    const tv = await service.browse('tv', 'recent', 1, {});
    const anime = await service.browse('anime', 'recent', 1, {});

    expect(tv.results[0]?.releaseDate).toBe('2026-08-01');
    expect(anime.results.map(({ releaseDate }) => releaseDate)).toEqual([
      '2026-09-01',
      '2026-08-01',
    ]);
    const urls = fetchMock.mock.calls.map(([url]) => url as URL);
    const tvUrl = urls[0]!;
    const movieUrl = urls[1]!;
    const animeTvUrl = urls[2]!;
    expect(tvUrl.pathname).toBe('/3/discover/tv');
    expect(tvUrl.searchParams.get('sort_by')).toBe('first_air_date.desc');
    expect(tvUrl.searchParams.get('first_air_date.lte')).toBeTruthy();
    expect(movieUrl.searchParams.get('sort_by')).toBe('primary_release_date.desc');
    expect(movieUrl.searchParams.get('primary_release_date.lte')).toBeTruthy();
    expect(animeTvUrl.searchParams.get('sort_by')).toBe('first_air_date.desc');
    expect(animeTvUrl.searchParams.get('first_air_date.lte')).toBeTruthy();
  });

  it('loads a normalized movie detail by external ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...fixture.results[0],
          genres: [{ id: 18, name: 'Drama' }],
          runtime: 139,
          status: 'Released',
          tagline: 'Mischief. Mayhem. Soap.',
          vote_average: 8.4,
          vote_count: 31_000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    const result = await service.movieDetails('550');

    expect(result).toMatchObject({
      externalId: '550',
      genres: ['Drama'],
      runtimeMinutes: 139,
      status: 'Released',
      rating: 8.4,
      ratingCount: 31_000,
      attribution: 'The Movie Database (TMDB)',
    });
    expect((fetchMock.mock.calls[0] as [URL])[0].pathname).toBe('/3/movie/550');
  });

  it('maps a missing TMDB movie to a not-found response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    await expect(service.movieDetails('999999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a TMDB title that does not satisfy the anime policy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...fixture.results[0],
            original_language: 'en',
            genres: [{ id: 18, name: 'Drama' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    await expect(service.details('anime', 'movie:550')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a genre the category does not have', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    await expect(
      service.browse('movie', 'popular', 1, { genre: 'Soap' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters anime by a TV-only genre without mixing in unfiltered films', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ page: 1, total_pages: 1, total_results: 0, results: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'server-token' }),
      new ConnectorHttpService(),
    );

    await service.browse('anime', 'popular', 1, { genre: 'Action & Adventure' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe('/3/discover/tv');
    expect(url.searchParams.get('with_genres')).toBe('16,10759');
    await expect(service.genres('anime')).resolves.not.toContain('Animation');
  });
});
