import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    const service = new TmdbService(new ConfigService());

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
    );

    const result = await service[method](1);

    expect(result.results[0]?.title).toBe('Fight Club');
    expect((fetchMock.mock.calls[0] as [URL])[0].pathname).toBe(`/3${path}`);
  });
});
