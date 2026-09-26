import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  mediaCategories,
  sourceRecordData,
} from '../sources/source-settings.service';
import { CatalogCandidate, ConnectorDescriptor } from '../sources/source.types';

@Injectable()
export class CatalogItemsService {
  sourceRecord(transaction: Prisma.TransactionClient, descriptor: ConnectorDescriptor) {
    return transaction.sourceRecord.upsert({
      where: { key: descriptor.key },
      update: sourceRecordData(descriptor),
      create: { key: descriptor.key, ...sourceRecordData(descriptor) },
    });
  }

  async upsert(
    transaction: Prisma.TransactionClient,
    candidate: CatalogCandidate,
    sourceId: string,
  ) {
    const existing = await transaction.sourceEntry.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: candidate.externalId } },
    });
    if (existing) {
      return transaction.catalogItem.update({
        where: { id: existing.catalogItemId },
        data: {
          ...this.catalogData(candidate),
          sourceEntries: {
            update: { where: { id: existing.id }, data: this.sourceData(candidate) },
          },
        },
      });
    }
    const category = mediaCategories[candidate.category];
    const year = candidate.releaseDate ? Number(candidate.releaseDate.slice(0, 4)) : null;
    const sameWork = await transaction.catalogItem.findMany({
      where: {
        category,
        releaseDate: year
          ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }
          : null,
        OR: [
          { canonicalTitle: { equals: candidate.title, mode: Prisma.QueryMode.insensitive } },
          { alternateTitles: { has: candidate.title } },
        ],
        sourceEntries: { none: { sourceId } },
      },
      select: { id: true },
      take: 2,
    });
    const sourceEntry = {
      sourceId,
      externalId: candidate.externalId,
      ...this.sourceData(candidate),
    };
    if (sameWork.length === 1 && sameWork[0]) {
      return transaction.catalogItem.update({
        where: { id: sameWork[0].id },
        data: { sourceEntries: { create: sourceEntry } },
      });
    }
    return transaction.catalogItem.create({
      data: {
        category,
        ...this.catalogData(candidate),
        sourceEntries: { create: sourceEntry },
      },
    });
  }

  private catalogData(item: CatalogCandidate) {
    return {
      canonicalTitle: item.title,
      alternateTitles: [item.originalTitle, ...(item.alternateTitles ?? [])].filter(
        (title, index, titles) => title !== item.title && titles.indexOf(title) === index,
      ),
      synopsis: item.synopsis,
      posterPath: item.posterUrl,
      backdropPath: item.backdropUrl,
      releaseDate: item.releaseDate ? new Date(`${item.releaseDate}T00:00:00.000Z`) : null,
      metadata: JSON.parse(
        JSON.stringify({
          language: item.language,
          genres: item.genres,
          runtimeMinutes: item.runtimeMinutes,
          status: item.status,
          tagline: item.tagline,
          rating: item.rating,
          ratingCount: item.ratingCount,
          capabilities: item.capabilities,
          episodeCount: item.episodeCount,
          seasonCount: item.seasonCount,
          chapterCount: item.chapterCount,
          volumeCount: item.volumeCount,
          platforms: item.platforms,
          releaseDates: item.releaseDates,
          relationships: item.relationships,
          adult: item.adult,
        }),
      ) as Prisma.InputJsonValue,
    };
  }

  private sourceData(item: CatalogCandidate) {
    return {
      canonicalUrl: item.deepLinks?.[0]?.url ?? null,
      language: item.language,
      sourceTitle: item.title,
      availableChapter: item.chapterCount,
      availableEpisode: item.episodeCount,
      lastSeenUpdate: item.releaseDate,
      lastRefreshedAt: new Date(),
    };
  }
}
