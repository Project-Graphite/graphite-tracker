import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const record = {
  series_id: 50369844984,
  title: 'Omniscient Reader',
  url: 'https://www.mangaupdates.com/series/n50wl4o/omniscient-reader',
  description: 'Dokja was an average office worker.',
  image: { url: { original: 'https://cdn.mangaupdates.com/image/i519012.jpg' } },
  type: 'Manhwa',
  year: '2020',
  bayesian_rating: 8.82,
  rating_votes: 940,
  genres: [{ genre: 'Action' }, { genre: 'Fantasy' }],
};

const series = {
  ...record,
  associated: [{ title: 'Jeonjijeok Dokja Sijeom' }, { title: 'Omniscient Reader' }],
  latest_chapter: 308,
  status: '311 Chapters + Prologue (Hiatus)\n20 Volumes (Ongoing)',
  authors: [
    { name: 'Redice', type: 'Author' },
    { name: 'Sleepy-C', type: 'Artist' },
  ],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const genreCache = () => ({
  getOrLoad: vi.fn().mockResolvedValue({
    value: [{ genre: 'Romance' }, { genre: 'Action' }, { genre: 'Smut' }, { genre: 'Hentai' }],
    stale: false,
  }),
});

const searchResponse = {
  total_hits: 51,
  page: 1,
  per_page: 25,
  results: [{ record, hit_title: "Omniscient Reader's Viewpoint" }],
};

const body = (request: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(String((request.mock.calls[call] as [URL, RequestInit])[1].body)) as Record<
    string,
    unknown
  >;

describe('MangaUpdatesService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('browses the most read and this year trending titles of one type without adult genres', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(json(searchResponse)));
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());

    const popular = await service.browse('manhwa', 'popular', 1, {});
    await service.browse('manga', 'recent', 2, {});

    const [url, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.mangaupdates.com/v1/series/search');
    expect(init.method).toBe('POST');
    expect(body(request)).toEqual({
      page: 1,
      perpage: 25,
      type: ['Manhwa'],
      orderby: 'list_reading',
      exclude_genre: ['Adult', 'Hentai', 'Lolicon', 'Shotacon', 'Smut'],
    });
    expect(body(request, 1)).toMatchObject({
      page: 2,
      type: ['Manga'],
      orderby: 'month1_pos',
      year: String(new Date().getUTCFullYear()),
    });
    expect(popular).toMatchObject({ page: 1, totalPages: 3, totalResults: 51 });
    expect(popular.results[0]).toMatchObject({
      source: 'mangaupdates',
      externalId: '50369844984',
      category: 'manhwa',
      title: 'Omniscient Reader',
      alternateTitles: ["Omniscient Reader's Viewpoint"],
      posterUrl: 'https://cdn.mangaupdates.com/image/i519012.jpg',
      releaseDate: '2020-01-01',
      language: 'ko',
      genres: ['Action', 'Fantasy'],
      rating: 8.82,
      ratingCount: 940,
      adult: false,
      deepLinks: [{ label: 'View on MangaUpdates', url: record.url }],
    });
  });

  it('searches by title with the selected genre and lets adult readers opt in', async () => {
    const request = vi.fn().mockImplementation(() =>
      Promise.resolve(
        json({
          ...searchResponse,
          results: [{ record: { ...record, genres: [{ genre: 'Smut' }] }, hit_title: record.title }],
        }),
      ),
    );
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());

    const result = await service.search('manhwa', 'omniscient', 1, {
      genre: 'romance',
      adult: true,
    });

    expect(body(request)).toEqual({
      page: 1,
      perpage: 25,
      type: ['Manhwa'],
      search: 'omniscient',
      genre: ['Romance'],
    });
    expect(result.results[0]).toMatchObject({ adult: true, alternateTitles: [] });
    await expect(service.genres()).resolves.toEqual(['Action', 'Romance']);
  });

  it.each([
    [{ genre: 'Smut' }],
    [{ sort: 'followedCount' }],
    [{ status: 'ongoing' }],
  ])('rejects filters it cannot apply: %o', async (filters) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());

    await expect(service.browse('manga', 'popular', 1, filters)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('loads details with alternate titles, credits, origin status and progress markers', async () => {
    const request = vi.fn().mockImplementation(() => Promise.resolve(json(series)));
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());

    const result = await service.details('manhwa', '50369844984');

    expect((request.mock.calls[0] as [URL])[0].toString()).toBe(
      'https://api.mangaupdates.com/v1/series/50369844984',
    );
    expect(result).toMatchObject({
      alternateTitles: ['Jeonjijeok Dokja Sijeom'],
      status: 'Hiatus',
      chapterCount: 308,
      volumeCount: 20,
      credits: [
        { role: 'Story by', names: ['Redice'] },
        { role: 'Art by', names: ['Sleepy-C'] },
      ],
      attribution: 'Manga data provided by MangaUpdates',
      attributionUrl: 'https://www.mangaupdates.com/',
    });
    await expect(service.details('manga', '50369844984')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports the latest chapter and nothing before the first one', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(json(series))
      .mockResolvedValueOnce(json({ ...series, latest_chapter: 0 }));
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());

    await expect(service.releases('manhwa', '50369844984')).resolves.toEqual([
      expect.objectContaining({
        key: 'chapter:308',
        kind: 'chapter',
        label: 'Chapter 308',
        ordinal: 308,
      }),
    ]);
    await expect(service.releases('manhwa', '50369844984')).resolves.toEqual([]);
  });

  it('recognizes series links by their base-36 ID and only for manga and manhwa', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(json(series))
      .mockResolvedValueOnce(json({ ...series, type: 'Manhua' }));
    vi.stubGlobal('fetch', request);
    const service = new MangaUpdatesService(genreCache() as never, new ConnectorHttpService());
    const link = new URL('https://www.mangaupdates.com/series/n50wl4o/omniscient-reader');

    await expect(service.recognize(link)).resolves.toEqual({
      category: 'manhwa',
      externalId: '50369844984',
    });
    await expect(service.recognize(link)).resolves.toBeNull();
    await expect(
      service.recognize(new URL('https://mangadex.org/title/n50wl4o')),
    ).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('is the default manga source while MangaDex stays selectable', () => {
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

    expect(registry.resolve('manga').descriptor.key).toBe('mangaupdates');
    expect(registry.resolve('manhwa').descriptor.key).toBe('mangaupdates');
    expect(registry.resolve('manhwa', 'mangadex').descriptor.key).toBe('mangadex');
  });
});
