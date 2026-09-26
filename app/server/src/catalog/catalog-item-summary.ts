import { Prisma } from '@prisma/client';

export const catalogItemSummaryInclude = Prisma.validator<Prisma.CatalogItemInclude>()({
  sourceEntries: { include: { source: true } },
});

export function catalogItemSummary(
  item: Prisma.CatalogItemGetPayload<{ include: typeof catalogItemSummaryInclude }>,
) {
  const entry = item.sourceEntries.find((sourceEntry) => sourceEntry.source.enabled);
  return {
    id: item.id,
    category: item.category.toLowerCase(),
    title: item.canonicalTitle,
    posterUrl: item.posterPath,
    releaseDate: item.releaseDate,
    adult: (item.metadata as { adult?: unknown } | null)?.adult === true,
    source: entry?.source.key ?? null,
    externalId: entry?.externalId ?? null,
  };
}
