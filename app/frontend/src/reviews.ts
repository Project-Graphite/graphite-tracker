import type { Page } from './api';
import { titleHref, type CatalogCategory } from './catalog';

export interface PublicReview {
  id: string;
  author: { handle: string; displayName: string };
  rating: number | null;
  title: string | null;
  body: string | null;
  containsSpoilers: boolean;
  visibility: 'public' | 'private';
  updatedAt: string;
}

export interface OwnReview {
  id: string;
  itemId: string;
  rating: number | null;
  title: string | null;
  body: string | null;
  containsSpoilers: boolean;
  visibility: 'public' | 'private';
  hidden: boolean;
  updatedAt: string;
}

export interface TitleReviews extends Page<PublicReview> {
  itemId: string | null;
  rating: { average: number | null; count: number };
}

export interface ItemSummary {
  id: string;
  category: CatalogCategory;
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  source: string | null;
  externalId: string | null;
  adult: boolean;
}

export const reviewBodyLimit = 10_000;

export const reportReasons = {
  spam: 'Spam or advertising',
  abuse: 'Harassment or hate',
  spoilers: 'Unmarked spoilers',
  other: 'Something else',
} as const;

export function itemHref({ category, externalId, source }: ItemSummary) {
  return source && externalId ? titleHref({ category, externalId, source }) : undefined;
}
