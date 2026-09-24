import type { CatalogCategory } from './catalog';
import type { LibraryEntry, LibraryState } from './library';

export type ImportState = 'parsing' | 'matching' | 'ready' | 'applying' | 'applied' | 'failed';
export type ImportMatch = 'pending' | 'exact' | 'suggested' | 'unmatched' | 'duplicate' | 'unsupported';
export type ConflictPolicy = 'add_missing' | 'keep_greater_progress';

export interface ImportSummary {
  id: string;
  sourceApp: 'mihon' | 'aniyomi' | null;
  state: ImportState;
  createdAt: string;
  appliedAt: string | null;
}

export interface ImportDetail extends ImportSummary {
  conflictPolicy: ConflictPolicy;
  error: string | null;
  expiresAt: string;
  previouslyAppliedAt: string | null;
  undecided: number;
  matches: Partial<Record<ImportMatch, number>>;
  outcomes: Partial<Record<'added' | 'updated' | 'kept' | 'duplicate' | 'skipped', number>>;
}

export interface ImportCandidate {
  id: string;
  kind: 'manga' | 'anime';
  title: string;
  sourceName: string | null;
  progress: number | null;
  state: LibraryState;
  match: ImportMatch;
  issue: 'no_title' | 'no_connector' | 'lookup_failed' | null;
  choice: number | null;
  decision: 'accept' | 'skip' | null;
  outcome: string | null;
  options: Array<{
    score: number;
    source: string;
    externalId: string;
    category: CatalogCategory;
    title: string;
    releaseDate: string | null;
    posterUrl: string | null;
  }>;
  existing: LibraryEntry | null;
}

export const importApps = { mihon: 'Mihon', aniyomi: 'AniYomi' } as const;

export const importStateLabels: Record<ImportState, string> = {
  parsing: 'Reading backup',
  matching: 'Matching titles',
  ready: 'Ready for review',
  applying: 'Applying',
  applied: 'Applied',
  failed: 'Failed',
};
