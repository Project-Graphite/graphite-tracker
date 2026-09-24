import { Injectable, NotFoundException } from '@nestjs/common';
import { ImportMatch } from '@prisma/client';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCandidate, CatalogCategory } from '../sources/source.types';

export interface ImportOption {
  score: number;
  item: CatalogCandidate;
}

interface MatchInput {
  kind: string;
  title: string;
  trackerTitles: string[];
  mangadexId: string | null;
}

const searchCategories: Record<string, CatalogCategory[]> = {
  manga: ['manga', 'manhwa'],
  anime: ['anime', 'tv', 'movie'],
};

export function normalizeTitle(title: string) {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigrams(value: string) {
  const compact = value.replace(/ /g, '');
  return Array.from({ length: Math.max(0, compact.length - 1) }, (_, index) =>
    compact.slice(index, index + 2),
  );
}

export function titleSimilarity(left: string, right: string) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftPairs = bigrams(a);
  const rightPairs = bigrams(b);
  const remaining = [...rightPairs];
  let shared = 0;
  for (const pair of leftPairs) {
    const index = remaining.indexOf(pair);
    if (index >= 0) {
      shared += 1;
      remaining.splice(index, 1);
    }
  }
  return leftPairs.length + rightPairs.length === 0
    ? 0
    : (2 * shared) / (leftPairs.length + rightPairs.length);
}

@Injectable()
export class ImportMatcherService {
  constructor(private readonly connectors: ConnectorRegistryService) {}

  async match(input: MatchInput): Promise<{ match: ImportMatch; options: ImportOption[] }> {
    if (input.mangadexId) {
      try {
        const recognized = await this.connectors.recognize(
          `https://mangadex.org/title/${input.mangadexId}`,
        );
        const item = await this.connectors.details(
          recognized.category,
          recognized.externalId,
          'mangadex',
        );
        return { match: ImportMatch.EXACT, options: [{ score: 1, item: { ...item, synopsis: '' } }] };
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    const titles = [input.title, ...input.trackerTitles];
    const options: ImportOption[] = [];
    for (const query of titles.slice(0, 2)) {
      for (const category of searchCategories[input.kind] ?? []) {
        const exactOnly = category === 'tv' || category === 'movie';
        const page = await this.connectors.search(category, query, 1, {});
        for (const item of page.results) {
          const score = Math.max(
            ...titles.flatMap((title) =>
              [item.title, item.originalTitle, ...(item.alternateTitles ?? [])].map(
                (candidate) => titleSimilarity(title, candidate),
              ),
            ),
          );
          if (score >= (exactOnly ? 1 : 0.6)) {
            options.push({ score, item: { ...item, synopsis: '' } });
          }
        }
        if (options.some((option) => option.score === 1)) break;
      }
      if (options.some((option) => option.score >= 0.9)) break;
    }
    const ranked = options
      .sort((left, right) => right.score - left.score)
      .filter(
        (option, index, all) =>
          all.findIndex(
            (other) =>
              other.item.source === option.item.source &&
              other.item.externalId === option.item.externalId,
          ) === index,
      )
      .slice(0, 3);
    return ranked.length > 0
      ? { match: ImportMatch.SUGGESTED, options: ranked }
      : { match: ImportMatch.UNMATCHED, options: [] };
  }
}
