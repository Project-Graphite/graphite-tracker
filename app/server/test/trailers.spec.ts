import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { IgdbService } from '../src/sources/igdb/igdb.service';
import { RawgService } from '../src/sources/rawg/rawg.service';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('Trailers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('links official YouTube trailers first, then teasers, from TMDB', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          id: 550,
          title: 'Fight Club',
          original_title: 'Fight Club',
          overview: '',
          poster_path: null,
          backdrop_path: null,
          release_date: '1999-10-15',
          original_language: 'en',
          videos: {
            results: [
              { key: 'teaser', name: 'Teaser', site: 'YouTube', type: 'Teaser', official: true },
              { key: 'fan', name: 'Fan trailer', site: 'YouTube', type: 'Trailer', official: false },
              { key: 'main', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true },
              { key: 'vimeo', name: 'Trailer', site: 'Vimeo', type: 'Trailer', official: true },
              { key: 'clip', name: 'Clip', site: 'YouTube', type: 'Clip', official: true },
            ],
          },
        }),
      ),
    );

    const result = await new TmdbService(
      new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'token' }),
      new ConnectorHttpService(),
    ).movieDetails('550');

    expect(result.trailers).toEqual([
      { name: 'Official Trailer', url: 'https://www.youtube.com/watch?v=main' },
      { name: 'Fan trailer', url: 'https://www.youtube.com/watch?v=fan' },
      { name: 'Teaser', url: 'https://www.youtube.com/watch?v=teaser' },
    ]);
  });

  it('links IGDB trailer videos and RAWG trailer files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: URL) =>
        Promise.resolve(
          input.hostname === 'api.igdb.com'
            ? json([
                {
                  id: 42,
                  name: 'Graphite Quest',
                  videos: [
                    { name: 'Gameplay', video_id: 'play' },
                    { name: 'Launch Trailer', video_id: 'launch' },
                  ],
                },
              ])
            : json(
                input.pathname.endsWith('/games/42')
                  ? { id: 42, slug: 'graphite-quest', name: 'Graphite Quest' }
                  : input.pathname.endsWith('/movies')
                    ? {
                        results: [
                          { name: 'Reveal', data: { max: 'https://steamcdn.example/reveal.mp4' } },
                          { name: 'Empty', data: {} },
                        ],
                      }
                    : { count: 0, next: null, previous: null, results: [] },
              ),
        ),
      ),
    );
    const cache = {
      getOrLoad: vi.fn().mockResolvedValue({ value: { access_token: 'token', expires_in: 3600 }, stale: false }),
    };

    await expect(
      new IgdbService(
        new ConfigService({ IGDB_CLIENT_ID: 'client', IGDB_CLIENT_SECRET: 'secret' }),
        cache as never,
        new ConnectorHttpService(),
      ).details('game', '42'),
    ).resolves.toMatchObject({
      trailers: [
        { name: 'Launch Trailer', url: 'https://www.youtube.com/watch?v=launch' },
        { name: 'Gameplay', url: 'https://www.youtube.com/watch?v=play' },
      ],
    });
    await expect(
      new RawgService(new ConfigService({ RAWG_API_KEY: 'key' }), new ConnectorHttpService()).details(
        'game',
        '42',
      ),
    ).resolves.toMatchObject({
      trailers: [{ name: 'Reveal', url: 'https://steamcdn.example/reveal.mp4' }],
    });
  });
});
