import { describe, expect, it } from 'vitest';
import { isLgbtq, looksLgbtq } from '../src/sources/lgbtq-content';
import { CatalogCandidate } from '../src/sources/source.types';

const titled = (title: string, lgbtq?: boolean) =>
  ({ title, originalTitle: title, alternateTitles: [], lgbtq }) as unknown as CatalogCandidate;

describe('isLgbtq', () => {
  it('hides flagged titles and titles that name the theme outright', () => {
    expect(isLgbtq(titled('Given', true))).toBe(true);
    for (const title of [
      'Queer Eye for the Straight Guy',
      'Yaoi Fetch-Quest',
      "Boys' Love",
      'LGBTQ+ Pride',
      'Shoujo Ai Anthology',
    ]) {
      expect(isLgbtq(titled(title)), title).toBe(true);
    }
  });

  it('leaves titles alone when the words are ambiguous', () => {
    for (const title of ['The Gay Divorcee', 'Berusaiyu no Bara', 'Yuri Gagarin', 'Enola Gay']) {
      expect(isLgbtq(titled(title)), title).toBe(false);
    }
  });
});

describe('looksLgbtq', () => {
  it('recognizes LGBTQ keywords and tags from every source', () => {
    for (const tag of [
      'lgbt',
      'LGBTQ+ Themes',
      'gay romance',
      'lesbian relationship',
      'queer',
      'transgender',
      'trans woman',
      'bisexual',
      'male homosexuality',
      'same sex relationship',
      'sapphic',
      'non-binary',
      'drag queen',
      "boys' love (bl)",
      "Boys' Love",
      "girls' love (gl)",
      'taiwan bl',
      'Yaoi',
      'Yuri',
      'Shounen Ai',
      'shoujo-ai',
      'bxb',
      'bara',
    ]) {
      expect(looksLgbtq([tag]), tag).toBe(true);
    }
  });

  it('leaves look-alike keywords alone', () => {
    for (const tag of [
      'enola gay',
      'rich boy loves poor girl',
      'school girl love',
      'yuri cabral',
      'trans-am',
      'blackout',
      'glasses',
      'Girls',
      'Teens\' Love',
      'Otome',
    ]) {
      expect(looksLgbtq([tag]), tag).toBe(false);
    }
  });
});
