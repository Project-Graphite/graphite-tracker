import { MediaCategory } from '@prisma/client';

export interface SourcePreferences {
  global: string | null;
  categories: Map<MediaCategory, string>;
}

export function effectiveSourceEntry<T extends { sourceId: string; source: { enabled: boolean } }>(
  sourceEntries: T[],
  preferredSourceId: string | null,
  category: MediaCategory,
  preferences: SourcePreferences,
) {
  const active = sourceEntries.filter((entry) => entry.source.enabled);
  return (
    [preferredSourceId, preferences.categories.get(category), preferences.global]
      .map((sourceId) => active.find((entry) => entry.sourceId === sourceId))
      .find((entry) => entry !== undefined) ?? active[0]
  );
}
