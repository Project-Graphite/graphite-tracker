import { Injectable, NotFoundException } from '@nestjs/common';
import { LibraryState, MediaCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TmdbService } from '../sources/tmdb/tmdb.service';
import {
  CreateLibraryEntryDto,
  LibraryStateInput,
} from './dto/create-library-entry.dto';

const states: Record<LibraryStateInput, LibraryState> = {
  planned: LibraryState.PLANNED,
  in_progress: LibraryState.IN_PROGRESS,
  completed: LibraryState.COMPLETED,
  dropped: LibraryState.DROPPED,
};

const libraryEntryInclude = Prisma.validator<Prisma.LibraryEntryInclude>()({
  catalogItem: {
    include: { sourceEntries: { include: { source: true } } },
  },
});

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbService,
  ) {}

  async list(userId: string) {
    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId },
      include: libraryEntryInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return entries.map((entry) => this.present(entry));
  }

  async create(userId: string, input: CreateLibraryEntryDto) {
    const movie = await this.tmdb.movieDetails(input.externalId);
    const entry = await this.prisma.$transaction(async (transaction) => {
      const source = await transaction.sourceRecord.upsert({
        where: { key: 'tmdb' },
        update: { enabled: true },
        create: {
          key: 'tmdb',
          displayName: 'The Movie Database',
          categories: [MediaCategory.MOVIE, MediaCategory.TV, MediaCategory.ANIME],
          languages: [],
          capabilities: ['SEARCH', 'DETAILS', 'RELEASES', 'EPISODES', 'DEEP_LINK'],
          attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
        },
      });
      const existingSource = await transaction.sourceEntry.findUnique({
        where: {
          sourceId_externalId: { sourceId: source.id, externalId: movie.externalId },
        },
      });
      const item = existingSource
        ? await transaction.catalogItem.update({
            where: { id: existingSource.catalogItemId },
            data: {
              canonicalTitle: movie.title,
              alternateTitles:
                movie.originalTitle === movie.title ? [] : [movie.originalTitle],
              synopsis: movie.synopsis,
              posterPath: movie.posterUrl,
              backdropPath: movie.backdropUrl,
              releaseDate: movie.releaseDate
                ? new Date(`${movie.releaseDate}T00:00:00.000Z`)
                : null,
              sourceEntries: {
                update: {
                  where: { id: existingSource.id },
                  data: {
                    sourceTitle: movie.title,
                    language: movie.language,
                    lastRefreshedAt: new Date(),
                  },
                },
              },
            },
          })
        : await transaction.catalogItem.create({
            data: {
              category: MediaCategory.MOVIE,
              canonicalTitle: movie.title,
              alternateTitles:
                movie.originalTitle === movie.title ? [] : [movie.originalTitle],
              synopsis: movie.synopsis,
              posterPath: movie.posterUrl,
              backdropPath: movie.backdropUrl,
              releaseDate: movie.releaseDate
                ? new Date(`${movie.releaseDate}T00:00:00.000Z`)
                : null,
              sourceEntries: {
                create: {
                  sourceId: source.id,
                  externalId: movie.externalId,
                  canonicalUrl: `https://www.themoviedb.org/movie/${movie.externalId}`,
                  language: movie.language,
                  sourceTitle: movie.title,
                  lastRefreshedAt: new Date(),
                },
              },
            },
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

  async update(userId: string, id: string, state: LibraryStateInput) {
    const current = await this.prisma.libraryEntry.findFirst({
      where: { id, userId },
    });
    if (!current) {
      throw new NotFoundException('Library entry not found');
    }
    const nextState = states[state];
    const entry = await this.prisma.libraryEntry.update({
      where: { id },
      data: {
        state: nextState,
        startedAt:
          state === LibraryStateInput.InProgress && !current.startedAt
            ? new Date()
            : undefined,
        completedAt:
          state === LibraryStateInput.Completed && !current.completedAt
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
      item: {
        id: entry.catalogItem.id,
        category: entry.catalogItem.category.toLowerCase(),
        title: entry.catalogItem.canonicalTitle,
        synopsis: entry.catalogItem.synopsis,
        posterUrl: entry.catalogItem.posterPath,
        releaseDate: entry.catalogItem.releaseDate,
        sources: entry.catalogItem.sourceEntries.map((sourceEntry) => ({
          key: sourceEntry.source.key,
          externalId: sourceEntry.externalId,
          url: sourceEntry.canonicalUrl,
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
