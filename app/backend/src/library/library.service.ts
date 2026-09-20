import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LibraryState, MediaCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCandidate, CatalogCategory } from '../sources/source.types';
import {
  CreateLibraryEntryDto,
  LibraryStateInput,
} from './dto/create-library-entry.dto';
import { ListLibraryDto } from './dto/list-library.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';

const states: Record<LibraryStateInput, LibraryState> = {
  planned: LibraryState.PLANNED,
  in_progress: LibraryState.IN_PROGRESS,
  completed: LibraryState.COMPLETED,
  dropped: LibraryState.DROPPED,
};

const categories: Record<CatalogCategory, MediaCategory> = {
  movie: MediaCategory.MOVIE,
  tv: MediaCategory.TV,
  anime: MediaCategory.ANIME,
  manga: MediaCategory.MANGA,
  manhwa: MediaCategory.MANHWA,
  game: MediaCategory.GAME,
};

const libraryEntryInclude = Prisma.validator<Prisma.LibraryEntryInclude>()({
  preferredSource: true,
  catalogItem: {
    include: { sourceEntries: { include: { source: true } } },
  },
});

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorRegistryService,
  ) {}

  async list(userId: string, query: ListLibraryDto = new ListLibraryDto()) {
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        ...(query.state ? { state: states[query.state] } : {}),
        catalogItem: {
          ...(query.category ? { category: categories[query.category] } : {}),
          ...(query.query
            ? {
                canonicalTitle: {
                  contains: query.query,
                  mode: Prisma.QueryMode.insensitive,
                },
              }
            : {}),
        },
      },
      include: libraryEntryInclude,
      orderBy:
        query.sort === 'title'
          ? { catalogItem: { canonicalTitle: 'asc' } }
          : query.sort === 'release'
            ? { catalogItem: { releaseDate: 'desc' } }
            : { updatedAt: 'desc' },
    });
    return entries.map((entry) => this.present(entry));
  }

  findByTmdbId(userId: string, externalId: string) {
    return this.findBySourceId(userId, 'tmdb', externalId);
  }

  async findBySourceId(userId: string, source: string, externalId: string) {
    const entry = await this.prisma.libraryEntry.findFirst({
      where: {
        userId,
        catalogItem: {
          sourceEntries: {
            some: {
              externalId,
              source: { key: source },
            },
          },
        },
      },
      include: libraryEntryInclude,
    });
    return entry ? this.present(entry) : null;
  }

  async create(userId: string, input: CreateLibraryEntryDto) {
    const category = input.category as CatalogCategory;
    const connector = this.connectors.resolve(category, input.source);
    const itemDetails = await this.connectors.details(
      category,
      input.externalId,
      input.source,
    );
    const releaseDate = itemDetails.releaseDate
      ? new Date(`${itemDetails.releaseDate}T00:00:00.000Z`)
      : null;
    const entry = await this.prisma.$transaction(async (transaction) => {
      const source = await transaction.sourceRecord.upsert({
        where: { key: connector.descriptor.key },
        update: {
          displayName: connector.descriptor.displayName,
          categories: connector.descriptor.categories.map(
            (value) => categories[value],
          ),
          languages: connector.descriptor.languages,
          capabilities: connector.descriptor.capabilities,
          attribution: connector.descriptor.attribution,
          enabled: connector.descriptor.enabled,
        },
        create: {
          key: connector.descriptor.key,
          displayName: connector.descriptor.displayName,
          categories: connector.descriptor.categories.map(
            (value) => categories[value],
          ),
          languages: connector.descriptor.languages,
          capabilities: connector.descriptor.capabilities,
          attribution: connector.descriptor.attribution,
          enabled: connector.descriptor.enabled,
        },
      });
      const existingSource = await transaction.sourceEntry.findUnique({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: itemDetails.externalId,
          },
        },
      });
      const canonical =
        existingSource ??
        (await transaction.catalogItem.findFirst({
          where: {
            category: categories[category],
            canonicalTitle: {
              equals: itemDetails.title,
              mode: Prisma.QueryMode.insensitive,
            },
            releaseDate,
          },
          select: { id: true },
        }));
      const item = existingSource
        ? await transaction.catalogItem.update({
            where: { id: existingSource.catalogItemId },
            data: this.catalogData(itemDetails, releaseDate, {
              sourceEntries: {
                update: {
                  where: { id: existingSource.id },
                  data: this.sourceData(itemDetails),
                },
              },
            }),
          })
        : canonical
          ? await transaction.catalogItem.update({
              where: { id: canonical.id },
              data: this.catalogData(itemDetails, releaseDate, {
                sourceEntries: {
                  create: {
                    sourceId: source.id,
                    externalId: itemDetails.externalId,
                    ...this.sourceData(itemDetails),
                  },
                },
              }),
            })
          : await transaction.catalogItem.create({
              data: this.catalogData(itemDetails, releaseDate, {
                category: categories[category],
                sourceEntries: {
                  create: {
                    sourceId: source.id,
                    externalId: itemDetails.externalId,
                    ...this.sourceData(itemDetails),
                  },
                },
              }),
            });
      return transaction.libraryEntry.upsert({
        where: { userId_catalogItemId: { userId, catalogItemId: item.id } },
        update: {},
        create: {
          userId,
          catalogItemId: item.id,
          state: states[input.state],
          startedAt:
            input.state === LibraryStateInput.InProgress ? new Date() : null,
          completedAt:
            input.state === LibraryStateInput.Completed ? new Date() : null,
          statusEvents: { create: { newState: states[input.state] } },
        },
        include: libraryEntryInclude,
      });
    });
    return this.present(entry);
  }

  async update(userId: string, id: string, input: UpdateLibraryEntryDto) {
    const current = await this.prisma.libraryEntry.findFirst({
      where: { id, userId },
      include: { catalogItem: true },
    });
    if (!current) {
      throw new NotFoundException('Library entry not found');
    }
    this.validateProgress(current.catalogItem.category, input);
    const progressChanged = [
      input.progressSeason,
      input.progressEpisode,
      input.progressChapter,
      input.progressVolume,
      input.hoursPlayed,
      input.completionPercentage,
    ].some((value) => value !== undefined);
    const nextState = input.state
      ? states[input.state]
      : progressChanged && current.state === LibraryState.PLANNED
        ? LibraryState.IN_PROGRESS
        : current.state;
    const preferredSourceId = input.preferredSource
      ? await this.preferredSourceId(current.catalogItemId, input.preferredSource)
      : undefined;
    if (
      input.notificationsEnabled &&
      nextState !== LibraryState.PLANNED &&
      nextState !== LibraryState.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'Notifications require a planned or in-progress state',
      );
    }
    const entry = await this.prisma.libraryEntry.update({
      where: { id },
      data: {
        state: nextState,
        progressSeason: input.progressSeason,
        progressEpisode: input.progressEpisode,
        progressChapter: input.progressChapter,
        progressVolume: input.progressVolume,
        hoursPlayed: input.hoursPlayed,
        completionPercentage: input.completionPercentage,
        platforms: input.platforms,
        notificationsEnabled:
          nextState === LibraryState.COMPLETED ||
          nextState === LibraryState.DROPPED
            ? false
            : input.notificationsEnabled,
        preferredSourceId,
        startedAt:
          nextState === LibraryState.IN_PROGRESS && !current.startedAt
            ? new Date()
            : undefined,
        completedAt:
          nextState === LibraryState.COMPLETED && !current.completedAt
            ? new Date()
            : undefined,
        statusEvents:
          current.state === nextState
            ? undefined
            : { create: { oldState: current.state, newState: nextState } },
      },
      include: libraryEntryInclude,
    });
    return this.present(entry);
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.libraryEntry.deleteMany({
      where: { id, userId },
    });
    if (!result.count) {
      throw new NotFoundException('Library entry not found');
    }
  }

  private catalogData<T extends object>(
    item: CatalogCandidate,
    releaseDate: Date | null,
    additional: T,
  ) {
    return {
      canonicalTitle: item.title,
      alternateTitles:
        item.originalTitle === item.title ? [] : [item.originalTitle],
      synopsis: item.synopsis,
      posterPath: item.posterUrl,
      backdropPath: item.backdropUrl,
      releaseDate,
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
        }),
      ) as Prisma.InputJsonValue,
      ...additional,
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

  private async preferredSourceId(catalogItemId: string, key: string) {
    const source = await this.prisma.sourceRecord.findFirst({
      where: {
        key,
        enabled: true,
        sourceEntries: { some: { catalogItemId } },
      },
      select: { id: true },
    });
    if (!source) {
      throw new BadRequestException('Preferred source is not attached to this title');
    }
    return source.id;
  }

  private validateProgress(category: MediaCategory, input: UpdateLibraryEntryDto) {
    const invalid =
      (category !== MediaCategory.TV &&
        category !== MediaCategory.ANIME &&
        (input.progressSeason !== undefined || input.progressEpisode !== undefined)) ||
      (category !== MediaCategory.MANGA &&
        category !== MediaCategory.MANHWA &&
        (input.progressChapter !== undefined || input.progressVolume !== undefined)) ||
      (category !== MediaCategory.GAME &&
        (input.hoursPlayed !== undefined ||
          input.completionPercentage !== undefined ||
          input.platforms !== undefined));
    if (invalid) {
      throw new BadRequestException('Progress does not match this media category');
    }
  }

  private present(
    entry: Prisma.LibraryEntryGetPayload<{
      include: typeof libraryEntryInclude;
    }>,
  ) {
    return {
      id: entry.id,
      state: this.presentState(entry.state),
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      notificationsEnabled: entry.notificationsEnabled,
      progress: {
        season: entry.progressSeason,
        episode: entry.progressEpisode,
        chapter: entry.progressChapter?.toNumber() ?? null,
        volume: entry.progressVolume?.toNumber() ?? null,
        hours: entry.hoursPlayed?.toNumber() ?? null,
        percentage: entry.completionPercentage,
        platforms: entry.platforms,
      },
      preferredSource: entry.preferredSource?.key ?? null,
      item: {
        id: entry.catalogItem.id,
        category: entry.catalogItem.category.toLowerCase(),
        title: entry.catalogItem.canonicalTitle,
        synopsis: entry.catalogItem.synopsis,
        posterUrl: entry.catalogItem.posterPath,
        backdropUrl: entry.catalogItem.backdropPath,
        releaseDate: entry.catalogItem.releaseDate,
        metadata: entry.catalogItem.metadata,
        sources: entry.catalogItem.sourceEntries.map((sourceEntry) => ({
          key: sourceEntry.source.key,
          name: sourceEntry.source.displayName,
          externalId: sourceEntry.externalId,
          url: sourceEntry.canonicalUrl,
          active: sourceEntry.source.enabled,
          capabilities: sourceEntry.source.capabilities,
        })),
      },
    };
  }

  private presentState(state: LibraryState) {
    return {
      PLANNED: 'planned',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      DROPPED: 'dropped',
    }[state];
  }
}
