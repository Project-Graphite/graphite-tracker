import { describe, expect, it } from 'vitest';
import { rankByRelevanceAndPopularity } from '../src/sources/game-ranking';

const game = (title: string, ratingCount: number, alternateTitles: string[] = []) => ({
  title,
  alternateTitles,
  ratingCount,
});

describe('rankByRelevanceAndPopularity', () => {
  it('puts popular titles that match the query ahead of obscure exact matches', () => {
    const ranked = rankByRelevanceAndPopularity(
      [
        game('Zelda', 2),
        game('Zelda Classic Remix', 1),
        game('The Legend of Zelda: Breath of the Wild', 3_000),
        game('The Legend of Zelda: Tears of the Kingdom', 2_400),
      ],
      'zelda',
    );

    expect(ranked.map(({ title }) => title)).toEqual([
      'The Legend of Zelda: Breath of the Wild',
      'The Legend of Zelda: Tears of the Kingdom',
      'Zelda',
      'Zelda Classic Remix',
    ]);
  });

  it('keeps an exact popular match first and matches alternate titles and word order', () => {
    const ranked = rankByRelevanceAndPopularity(
      [
        game('Hades II', 900),
        game('Hades', 1_000),
        game('Underworld Trials', 1_000, ['HADES: Underworld']),
        game('Wild of the Breath', 2_000),
      ],
      'Hades',
    );

    expect(ranked.map(({ title }) => title)).toEqual([
      'Hades',
      'Hades II',
      'Underworld Trials',
      'Wild of the Breath',
    ]);
    expect(
      rankByRelevanceAndPopularity(
        [game('Breath of the Wild', 10), game('Wild Breath of Fire', 10)],
        'wild breath',
      ).map(({ title }) => title),
    ).toEqual(['Wild Breath of Fire', 'Breath of the Wild']);
  });

  it('ignores accents, punctuation and case when matching titles', () => {
    const ranked = rankByRelevanceAndPopularity(
      [game('Pokémon Rouge', 50), game('Pokemon: Red', 50), game('Poke Bowl Tycoon', 5_000)],
      'pokémon',
    );

    expect(ranked.map(({ title }) => title)).toEqual([
      'Pokémon Rouge',
      'Pokemon: Red',
      'Poke Bowl Tycoon',
    ]);
  });
});
