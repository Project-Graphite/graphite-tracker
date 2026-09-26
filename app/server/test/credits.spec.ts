import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { IgdbService } from '../src/sources/igdb/igdb.service';
import { MangaDexService } from '../src/sources/mangadex/mangadex.service';
import { RawgService } from '../src/sources/rawg/rawg.service';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const tmdb = () =>
  new TmdbService(new ConfigService({ TMDB_READ_ACCESS_TOKEN: 'token' }), new ConnectorHttpService());

const movie = {
  id: 550,
  title: 'Fight Club',
  original_title: 'Fight Club',
  overview: 'An insomniac encounters a soap maker.',
  poster_path: null,
  backdrop_path: null,
  release_date: '1999-10-15',
  original_language: 'en',
  genres: [{ id: 18, name: 'Drama' }],
};

const mangaId = '11111111-2222-3333-4444-555555555555';

const manga = {
  id: mangaId,
  attributes: {
    title: { en: 'Tower Story' },
    altTitles: [],
    description: { en: '' },
    originalLanguage: 'ja',
    contentRating: 'safe',
    year: 2020,
    status: 'ongoing',
    lastVolume: null,
    lastChapter: null,
    tags: [],
  },
  relationships: [
    { id: 'a', type: 'author', attributes: { name: 'Kei Mori' } },
    { id: 'b', type: 'artist', attributes: { name: 'Kei Mori' } },
    { id: 'c', type: 'artist', attributes: { name: 'Rin Aoi' } },
  ],
};

function catalogueResponse(input: URL) {
  if (input.hostname === 'api.mangadex.org') {
    return json(input.pathname.endsWith('/aggregate') ? { volumes: {} } : { data: manga });
  }
  if (input.hostname === 'api.igdb.com') {
    return json([
      {
        id: 42,
        name: 'Graphite Quest',
        involved_companies: [
          { company: { id: 1, name: 'Slate Works' }, developer: true, publisher: false },
          { company: { id: 2, name: 'Carbon Games' }, developer: false, publisher: true },
        ],
      },
    ]);
  }
  return json(
    input.pathname.endsWith('/games/42')
      ? {
          id: 42,
          slug: 'graphite-quest',
          name: 'Graphite Quest',
          developers: [{ id: 1, name: 'Slate Works', slug: 'slate-works' }],
          publishers: [{ id: 2, name: 'Carbon Games', slug: 'carbon-games' }],
        }
      : { count: 0, next: null, previous: null, results: [] },
  );
}

describe('Catalogue credits', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('groups a film crew by job and keeps the billed cast with their photos', async () => {
    const request = vi.fn().mockResolvedValue(
      json({
        ...movie,
        production_companies: [{ id: 1, name: 'Fox 2000 Pictures' }],
        credits: {
          cast: [
            { id: 1, name: 'Edward Norton', character: 'Narrator', profile_path: '/norton.jpg' },
            { id: 2, name: 'Brad Pitt', character: 'Tyler Durden', profile_path: null },
          ],
          crew: [
            { id: 3, name: 'David Fincher', job: 'Director', department: 'Directing', profile_path: null },
            { id: 4, name: 'Jim Uhls', job: 'Screenplay', department: 'Writing', profile_path: null },
            { id: 5, name: 'Chuck Palahniuk', job: 'Novel', department: 'Writing', profile_path: null },
            { id: 6, name: 'The Dust Brothers', job: 'Original Music Composer', department: 'Sound', profile_path: null },
            { id: 7, name: 'Jeff Cronenweth', job: 'Director of Photography', department: 'Camera', profile_path: null },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', request);

    const result = await tmdb().movieDetails('550');

    expect((request.mock.calls[0] as [URL])[0].searchParams.get('append_to_response')).toBe('credits,videos');
    expect(result.credits).toEqual([
      { role: 'Directed by', names: ['David Fincher'] },
      { role: 'Written by', names: ['Jim Uhls', 'Chuck Palahniuk'] },
      { role: 'Music by', names: ['The Dust Brothers'] },
      { role: 'Studios', names: ['Fox 2000 Pictures'] },
    ]);
    expect(result.cast).toEqual([
      { name: 'Edward Norton', character: 'Narrator', imageUrl: 'https://image.tmdb.org/t/p/w185/norton.jpg' },
      { name: 'Brad Pitt', character: 'Tyler Durden', imageUrl: null },
    ]);
  });

  it('credits a series with its creators, network, studios and whole-run cast', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          id: 1399,
          name: 'Tower Chronicles',
          original_name: 'Tower Chronicles',
          overview: '',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2024-04-01',
          original_language: 'en',
          created_by: [{ id: 1, name: 'Ada Stone' }],
          networks: [{ id: 2, name: 'HBO' }],
          production_companies: [{ id: 3, name: 'Tower Films' }],
          aggregate_credits: {
            cast: [{ id: 4, name: 'Mia Reed', profile_path: null, roles: [{ character: 'Climber' }] }],
            crew: [],
          },
        }),
      ),
    );

    const result = await tmdb().details('tv', '1399');

    expect(result.credits).toEqual([
      { role: 'Created by', names: ['Ada Stone'] },
      { role: 'Network', names: ['HBO'] },
      { role: 'Studios', names: ['Tower Films'] },
    ]);
    expect(result.cast).toEqual([{ name: 'Mia Reed', character: 'Climber', imageUrl: null }]);
  });

  it('credits manga authors and artists, and game developers and publishers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: URL) => Promise.resolve(catalogueResponse(input))));
    const cache = {
      getOrLoad: vi.fn().mockResolvedValue({ value: { access_token: 'token', expires_in: 3600 }, stale: false }),
    };
    const games = [
      { role: 'Developed by', names: ['Slate Works'] },
      { role: 'Published by', names: ['Carbon Games'] },
    ];

    await expect(
      new MangaDexService({} as never, new ConnectorHttpService()).details('manga', mangaId),
    ).resolves.toMatchObject({
      credits: [
        { role: 'Story by', names: ['Kei Mori'] },
        { role: 'Art by', names: ['Kei Mori', 'Rin Aoi'] },
      ],
    });
    await expect(
      new IgdbService(
        new ConfigService({ IGDB_CLIENT_ID: 'client', IGDB_CLIENT_SECRET: 'secret' }),
        cache as never,
        new ConnectorHttpService(),
      ).details('game', '42'),
    ).resolves.toMatchObject({ credits: games });
    await expect(
      new RawgService(new ConfigService({ RAWG_API_KEY: 'key' }), new ConnectorHttpService()).details(
        'game',
        '42',
      ),
    ).resolves.toMatchObject({ credits: games });
  });
});
