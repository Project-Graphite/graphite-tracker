import { MediaCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SourcePreferences {
  global: string | null;
  categories: Map<MediaCategory, string>;
}

export async function loadSourcePreferences(
  prisma: PrismaService,
  userId: string,
): Promise<SourcePreferences> {
  const usable = { enabled: true, userSettings: { none: { userId, enabled: false } } };
  const [global, categories] = await Promise.all([
    prisma.globalSourcePreference.findFirst({
      where: { userId, source: usable },
      select: { sourceId: true },
    }),
    prisma.categorySourcePreference.findMany({
      where: { userId, source: usable },
      select: { category: true, sourceId: true },
    }),
  ]);
  return {
    global: global?.sourceId ?? null,
    categories: new Map(categories.map(({ category, sourceId }) => [category, sourceId])),
  };
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

export function releaseSourceEntry<T extends { sourceId: string; source: { enabled: boolean } }>(
  sourceEntries: T[],
  preferredSourceId: string | null,
  category: MediaCategory,
  preferences: SourcePreferences,
) {
  return preferredSourceId
    ? sourceEntries.find((entry) => entry.sourceId === preferredSourceId && entry.source.enabled)
    : effectiveSourceEntry(sourceEntries, null, category, preferences);
}
