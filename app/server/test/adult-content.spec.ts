import { describe, expect, it } from 'vitest';
import { looksAdult, withoutAdult } from '../src/sources/adult-content';
import { CatalogPage } from '../src/sources/source.types';

const page = (adultFlags: boolean[]): CatalogPage => ({
  page: 1,
  totalPages: 3,
  totalResults: 55,
  attribution: 'Test',
  results: adultFlags.map((adult, index) => ({
    source: 'test',
    externalId: String(index),
    category: 'movie',
    title: `Title ${index}`,
    originalTitle: `Title ${index}`,
    synopsis: '',
    posterUrl: null,
    backdropUrl: null,
    releaseDate: null,
    language: 'en',
    genres: [],
    runtimeMinutes: null,
    status: null,
    tagline: null,
    rating: null,
    ratingCount: 0,
    adult,
    capabilities: {
      progressUnits: [],
      hasEpisodes: false,
      hasSeasons: false,
      hasPlatforms: false,
      supportsReleaseNotifications: false,
    },
  })),
});

describe('looksAdult', () => {
  it('flags explicit words in titles, synopses and tags', () => {
    expect(looksAdult(['Hentai Puzzle Quest'], '', [])).toBe(true);
    expect(looksAdult(['Summer Nights'], 'An eroge visual novel with adult scenes.', [])).toBe(true);
    expect(looksAdult(['Puzzle Nights'], '', ['Indie', 'NSFW'])).toBe(true);
    expect(looksAdult(['Puzzle Nights'], '', ['Sexual Content'])).toBe(true);
    expect(looksAdult(['Erotica'], '', [])).toBe(true);
    expect(looksAdult(['Quiet Streets (R18)'], '', [])).toBe(true);
  });

  it('leaves mainstream titles alone', () => {
    expect(looksAdult(['xXx', 'xXx: Return of Xander Cage'], 'An extreme sports athlete is recruited.', [])).toBe(false);
    expect(looksAdult(['Sex Education'], 'A socially awkward teenager sets up a clinic.', ['Comedy'])).toBe(false);
    expect(looksAdult(['Kevin Hart: Uncensored'], '', ['Stand-up'])).toBe(false);
    expect(looksAdult(['The Legend of Zelda: Breath of the Wild'], 'Link awakens after 100 years.', ['Adventure'])).toBe(false);
    expect(looksAdult(['Nerdsfwd'], 'Pornographers are not mentioned by name here.', [])).toBe(false);
  });
});

describe('withoutAdult', () => {
  it('drops flagged results and withdraws the count for readers who did not opt in', () => {
    const filtered = withoutAdult(page([false, true, false]), false);

    expect(filtered.results.map(({ externalId }) => externalId)).toEqual(['0', '2']);
    expect(filtered.totalResults).toBeNull();
    expect(filtered.totalPages).toBe(3);
  });

  it('keeps the count when nothing was dropped and passes pages through for opted-in readers', () => {
    expect(withoutAdult(page([false, false]), false).totalResults).toBe(55);
    const opted = withoutAdult(page([true, false]), true);
    expect(opted.results).toHaveLength(2);
    expect(opted.totalResults).toBe(55);
  });
});
