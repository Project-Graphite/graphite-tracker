import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AniListService } from '../src/sources/anilist/anilist.service';
import { ConnectorHttpService } from '../src/sources/connector-http.service';
import { IgdbService } from '../src/sources/igdb/igdb.service';
import { MangaDexService } from '../src/sources/mangadex/mangadex.service';
import { MangaUpdatesService } from '../src/sources/mangaupdates/mangaupdates.service';
import { RawgService } from '../src/sources/rawg/rawg.service';
import { SourceConnector } from '../src/sources/source.types';
import { TmdbService } from '../src/sources/tmdb/tmdb.service';

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'test', 'fixtures', 'tmdb', name), 'utf8');

const respond = (body: string | object) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const config = new ConfigService({
  TMDB_READ_ACCESS_TOKEN: 'tmdb-token',
  IGDB_CLIENT_ID: 'client',
  IGDB_CLIENT_SECRET: 'secret',
  RAWG_API_KEY: 'rawg-key',
});
const cache = {
  getOrLoad: vi.fn().mockResolvedValue({ value: { access_token: 'token', expires_in: 3600 }, stale: false }),
};

describe('Release signals', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the latest aired TMDB episode for series and anime', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(respond(fixture('tv-details.json'))));
    vi.stubGlobal('fetch', request);
    const tmdb = new TmdbService(config, new ConnectorHttpService());
    const episode = {
      key: 'episode:2x8',
      kind: 'episode',
      label: 'Season 2, episode 8: The Ninth Floor',
      ordinal: 20_008,
      occurredAt: '2026-09-20',
    };

    await expect(tmdb.releases('tv', '1399')).resolves.toEqual([episode]);
    await expect(tmdb.releases('anime', 'tv:1399')).resolves.toEqual([episode]);
    expect((request.mock.calls[1] as [URL])[0].pathname).toBe('/3/tv/1399');
  });

  it('reports the earliest cinema and digital releases that have happened', async () => {
    const request = vi.fn().mockResolvedValue(respond(fixture('movie-release-dates.json')));
    vi.stubGlobal('fetch', request);

    await expect(
      new TmdbService(config, new ConnectorHttpService()).releases('movie', '550'),
    ).resolves.toEqual([
      { key: 'theatrical', kind: 'release', label: 'In cinemas', occurredAt: '2026-06-18' },
    ]);
    expect((request.mock.calls[0] as [URL])[0].pathname).toBe('/3/movie/550/release_dates');
  });

  it('reports the newest English MangaDex chapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond({ volumes: { '1': { chapters: { '1': {}, '12.5': {} } }, none: { chapters: { '4': {} } } } }),
      ),
    );

    await expect(
      new MangaDexService(cache as never, new ConnectorHttpService()).releases('manga', 'uuid'),
    ).resolves.toEqual([
      expect.objectContaining({ key: 'chapter:12.5', kind: 'chapter', label: 'Chapter 12.5', ordinal: 12.5 }),
    ]);
  });

  it('reports each game platform as released or dated by its earliest release', async () => {
    const releaseDates = [
      { date: 1_893_456_000, platform: { id: 6, name: 'PC' } },
      { date: 1_577_836_800, platform: { id: 6, name: 'PC' } },
      { date: 4_102_444_800, platform: { id: 167, name: 'PlayStation 5' } },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond([{ id: 42, name: 'Graphite Quest', release_dates: releaseDates }])),
    );

    await expect(
      new IgdbService(config, cache as never, new ConnectorHttpService()).releases('game', '42'),
    ).resolves.toEqual([
      { key: 'release:PC', kind: 'release', label: 'Out now on PC', platform: 'PC', occurredAt: '2020-01-01' },
      {
        key: 'date:PlayStation 5:2100-01-01',
        kind: 'release_date',
        label: 'PlayStation 5 release set for 2100-01-01',
        platform: 'PlayStation 5',
        occurredAt: '2100-01-01',
      },
    ]);
  });

  it('declares release updates exactly where a connector can check them', () => {
    const http = new ConnectorHttpService();
    const connectors: SourceConnector[] = [
      new AniListService(cache as never, http),
      new TmdbService(config, http),
      new MangaUpdatesService(cache as never, http),
      new MangaDexService(cache as never, http),
      new IgdbService(config, cache as never, http),
      new RawgService(config, http),
    ];
    for (const connector of connectors) {
      const { capabilities } = connector.descriptor;
      expect(capabilities.includes('RELEASES')).toBe(typeof connector.releases === 'function');
      expect(capabilities).toEqual(expect.arrayContaining(['SEARCH', 'DETAILS']));
    }
  });
});
