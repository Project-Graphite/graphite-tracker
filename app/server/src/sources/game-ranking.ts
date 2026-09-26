import { normalizeTitle } from './normalize-title';

export interface RankedGame {
  title: string;
  alternateTitles?: string[];
  ratingCount: number;
}

function titleMatch(query: string, titles: string[]) {
  const words = query.split(' ');
  return Math.max(
    ...titles.map((title) =>
      title === query
        ? 1
        : title.startsWith(query)
          ? 0.6
          : title.includes(query)
            ? 0.5
            : words.every((word) => title.includes(word))
              ? 0.4
              : 0,
    ),
  );
}

export function rankByRelevanceAndPopularity<T extends RankedGame>(games: T[], query: string) {
  const term = normalizeTitle(query);
  const mostRated = Math.max(0, ...games.map((game) => game.ratingCount));
  return games
    .map((game, position) => ({
      game,
      score:
        titleMatch(term, [game.title, ...(game.alternateTitles ?? [])].map(normalizeTitle)) +
        (mostRated > 0 ? (1.2 * Math.log1p(game.ratingCount)) / Math.log1p(mostRated) : 0) +
        0.25 * (1 - position / games.length),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ game }) => game);
}
