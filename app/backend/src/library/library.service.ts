import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LibraryState, MediaCategory, Prisma } from '@prisma/client';
import { CatalogItemsService } from '../catalog/catalog-items.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { mediaCategories } from '../sources/source-settings.service';
import {
  CreateLibraryEntryDto,
  LibraryStateInput,
} from './dto/create-library-entry.dto';
import { ListLibraryDto } from './dto/list-library.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';

export const libraryStates: Record<LibraryStateInput, LibraryState> = {
  planned: LibraryState.PLANNED,
  in_progress: LibraryState.IN_PROGRESS,
  completed: LibraryState.COMPLETED,
  dropped: LibraryState.DROPPED,
};

const pageSize = 24;

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
    private readonly catalogItems: CatalogItemsService,
  ) {}

  async list(userId: string, query: ListLibraryDto) {
    const where: Prisma.LibraryEntryWhereInput = {
      userId,
      ...(query.state ? { state: libraryStates[query.state] } : {}),
      catalogItem: {
        ...(query.category ? { category: mediaCategories[query.category] } : {}),
        ...(query.query
          ? {
              canonicalTitle: {
                contains: query.query,
                mode: Prisma.QueryMode.insensitive,
              },
            }
          : {}),
      },
    };
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.libraryEntry.count({ where }),
      this.prisma.libraryEntry.findMany({
        where,
        include: libraryEntryInclude,
        orderBy: [
          query.sort === 'title'
            ? { catalogItem: { canonicalTitle: 'asc' } }
            : query.sort === 'release'
              ? { catalogItem: { releaseDate: { sort: 'desc', nulls: 'last' } } }
              : { updatedAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalResults: total,
      results: entries.map((entry) => this.present(entry)),
    };
  }

  async lookup(userId: string, refs: string) {
    const sources = refs
      .split(',')
      .slice(0, 100)
      .flatMap((ref) => {
        const separator = ref.indexOf(':');
        return separator > 0 && separator < ref.length - 1
          ? [{ externalId: ref.slice(separator + 1), source: { key: ref.slice(0, separator) } }]
          : [];
      });
    if (sources.length === 0) {
      return [];
    }
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        catalogItem: { sourceEntries: { some: { OR: sources } } },
      },
      include: libraryEntryInclude,
    });
    return entries.map((entry) => this.present(entry));
  }

  async create(userId: string, input: CreateLibraryEntryDto) {
    const connector = this.connectors.resolve(input.category, input.source);
    const details = await this.connectors.details(
      input.category,
      input.externalId,
      input.source,
    );
    const state = libraryStates[input.state];
    const entry = await this.prisma.$transaction(async (transaction) => {
      const source = await this.catalogItems.sourceRecord(transaction, connector.descriptor);
      const item = await this.catalogItems.upsert(transaction, details, source.id);
      return transaction.libraryEntry.upsert({
        where: { userId_catalogItemId: { userId, catalogItemId: item.id } },
        update: {},
        create: {
          userId,
          catalogItemId: item.id,
          state,
          startedAt: state === LibraryState.IN_PROGRESS ? new Date() : null,
          completedAt: state === LibraryState.COMPLETED ? new Date() : null,
          statusEvents: { create: { newState: state } },
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
    this.validateProgress(
      current.catalogItem.category,
      current.catalogItem.metadata,
      input,
    );
    const progressRecorded = [
      input.progressSeason,
      input.progressEpisode,
      input.progressChapter,
      input.progressVolume,
      input.hoursPlayed,
      input.completionPercentage,
    ].some((value) => typeof value === 'number' && value > 0);
    const nextState = input.state
      ? libraryStates[input.state]
      : progressRecorded && current.state === LibraryState.PLANNED
        ? LibraryState.IN_PROGRESS
        : current.state;
    const preferredSourceId =
      input.preferredSource === null
        ? null
        : input.preferredSource
          ? await this.preferredSourceId(current.catalogItemId, input.preferredSource)
          : undefined;
    const finished =
      nextState === LibraryState.COMPLETED || nextState === LibraryState.DROPPED;
    if (input.notificationsEnabled && finished) {
      throw new BadRequestException(
        'Notifications require a planned or in-progress state',
      );
    }
    if (
      input.notificationsEnabled &&
      current.catalogItem.category === MediaCategory.GAME &&
      (input.platforms ?? current.platforms).length === 0
    ) {
      throw new BadRequestException(
        'Select at least one game platform before enabling notifications',
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
        notificationsEnabled: finished ? false : input.notificationsEnabled,
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

  private validateProgress(
    category: MediaCategory,
    metadata: Prisma.JsonValue,
    input: UpdateLibraryEntryDto,
  ) {
    const itemMetadata =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata
        : {};
    const capabilities =
      itemMetadata.capabilities &&
      typeof itemMetadata.capabilities === 'object' &&
      !Array.isArray(itemMetadata.capabilities)
        ? itemMetadata.capabilities
        : {};
    const progressUnits = Array.isArray(capabilities.progressUnits)
      ? capabilities.progressUnits
      : [];
    const invalid =
      ((!progressUnits.includes('season') || !progressUnits.includes('episode')) &&
        (input.progressSeason !== undefined || input.progressEpisode !== undefined)) ||
      ((!progressUnits.includes('chapter') || !progressUnits.includes('volume')) &&
        (input.progressChapter !== undefined || input.progressVolume !== undefined)) ||
      ((!progressUnits.includes('hours') || !progressUnits.includes('percentage')) &&
        (input.hoursPlayed !== undefined ||
          input.completionPercentage !== undefined ||
          input.platforms !== undefined));
    if (invalid) {
      throw new BadRequestException('Progress does not match this media category');
    }
    if (category === MediaCategory.GAME && input.platforms) {
      const availablePlatforms = Array.isArray(itemMetadata.platforms)
        ? itemMetadata.platforms.filter(
            (platform): platform is string => typeof platform === 'string',
          )
        : [];
      if (
        new Set(input.platforms).size !== input.platforms.length ||
        input.platforms.some((platform) => !availablePlatforms.includes(platform))
      ) {
        throw new BadRequestException(
          'Selected platform is not available for this game',
        );
      }
    }
  }

  private present(
    entry: Prisma.LibraryEntryGetPayload<{
      include: typeof libraryEntryInclude;
    }>,
  ) {
    return {
      id: entry.id,
      state: entry.state.toLowerCase(),
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
        posterUrl: entry.catalogItem.posterPath,
        releaseDate: entry.catalogItem.releaseDate,
        metadata: entry.catalogItem.metadata,
        sources: entry.catalogItem.sourceEntries.map((sourceEntry) => ({
          key: sourceEntry.source.key,
          name: sourceEntry.source.displayName,
          externalId: sourceEntry.externalId,
          url: sourceEntry.canonicalUrl,
          active: sourceEntry.source.enabled,
        })),
      },
    };
  }
}
