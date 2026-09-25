import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityKind, Prisma } from '@prisma/client';
import {
  catalogItemSummary,
  catalogItemSummaryInclude,
} from '../catalog/catalog-item-summary';
import { libraryStates } from '../library/library.service';
import { PrismaService } from '../prisma/prisma.service';
import { presentPublicReview, publicReviewWhere } from '../reviews/reviews.service';
import { catalogCategories } from '../sources/source.types';
import { mediaCategories } from '../sources/source-settings.service';
import { ProfileLibraryDto } from './dto/users.dto';

const pageSize = 20;

type Section = 'showLibrary' | 'showActivity' | 'showRatings' | 'showReviews';

function paged<T>(page: number, total: number, results: T[]) {
  return {
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalResults: total,
    results,
  };
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(handle: string) {
    const { user, privacy } = await this.owner(handle);
    if (!privacy.isPublic) {
      return { handle: user.handle, displayName: user.displayName, isPublic: false };
    }
    return {
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      isPublic: true,
      sections: {
        library: privacy.showLibrary,
        activity: privacy.showActivity,
        ratings: privacy.showRatings,
        reviews: privacy.showReviews,
        statistics: privacy.showStatistics,
      },
      statistics: privacy.showStatistics
        ? await this.statistics(user.id, privacy.showRatings)
        : null,
    };
  }

  async activity(handle: string, page: number) {
    const { user, privacy } = await this.section(handle, 'showActivity');
    const where: Prisma.ActivityEventWhereInput = {
      userId: user.id,
      OR: [
        ...(privacy.showLibrary
          ? [{ kind: { in: [ActivityKind.ADDED, ActivityKind.STATE_CHANGED] } }]
          : []),
        ...(privacy.showRatings
          ? [{ kind: ActivityKind.RATED, review: { is: { rating: { not: null }, hiddenAt: null } } }]
          : []),
        ...(privacy.showReviews
          ? [{ kind: ActivityKind.REVIEWED, review: { is: publicReviewWhere } }]
          : []),
      ],
    };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.activityEvent.count({ where }),
      this.prisma.activityEvent.findMany({
        where,
        include: {
          catalogItem: { include: catalogItemSummaryInclude },
          review: { select: { rating: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(
      page,
      total,
      events.map((event) => ({
        id: event.id,
        kind: event.kind.toLowerCase(),
        state: event.state?.toLowerCase() ?? null,
        rating: event.kind === ActivityKind.RATED ? (event.review?.rating ?? null) : null,
        createdAt: event.createdAt,
        item: catalogItemSummary(event.catalogItem),
      })),
    );
  }

  async library(handle: string, query: ProfileLibraryDto) {
    const { user, privacy } = await this.section(handle, 'showLibrary');
    const where: Prisma.LibraryEntryWhereInput = {
      userId: user.id,
      ...(query.state ? { state: libraryStates[query.state] } : {}),
      ...(query.category
        ? { catalogItem: { category: mediaCategories[query.category] } }
        : {}),
    };
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.libraryEntry.count({ where }),
      this.prisma.libraryEntry.findMany({
        where,
        include: {
          catalogItem: {
            include: {
              ...catalogItemSummaryInclude,
              reviews: {
                where: { userId: user.id, rating: { not: null }, hiddenAt: null },
                select: { rating: true },
              },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(
      query.page,
      total,
      entries.map((entry) => ({
        id: entry.id,
        state: entry.state.toLowerCase(),
        progress: {
          season: entry.progressSeason,
          episode: entry.progressEpisode,
          chapter: entry.progressChapter?.toNumber() ?? null,
          volume: entry.progressVolume?.toNumber() ?? null,
          hours: entry.hoursPlayed?.toNumber() ?? null,
          percentage: entry.completionPercentage,
        },
        rating: privacy.showRatings ? (entry.catalogItem.reviews[0]?.rating ?? null) : null,
        item: catalogItemSummary(entry.catalogItem),
      })),
    );
  }

  async ratings(handle: string, page: number) {
    const { user } = await this.section(handle, 'showRatings');
    const where = { userId: user.id, rating: { not: null }, hiddenAt: null };
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { catalogItem: { include: catalogItemSummaryInclude } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(
      page,
      total,
      reviews.map((review) => ({
        rating: review.rating,
        updatedAt: review.updatedAt,
        item: catalogItemSummary(review.catalogItem),
      })),
    );
  }

  async reviews(handle: string, page: number) {
    const { user } = await this.section(handle, 'showReviews');
    const where = { ...publicReviewWhere, userId: user.id };
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { handle: true, displayName: true } },
          catalogItem: { include: catalogItemSummaryInclude },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(
      page,
      total,
      reviews.map((review) => ({
        ...presentPublicReview(review),
        item: catalogItemSummary(review.catalogItem),
      })),
    );
  }

  private async statistics(userId: string, includeRatings: boolean) {
    const [states, categories, ratings] = await Promise.all([
      this.prisma.libraryEntry.groupBy({ by: ['state'], where: { userId }, _count: true }),
      Promise.all(
        catalogCategories.map(async (category) => [
          category,
          await this.prisma.libraryEntry.count({
            where: { userId, catalogItem: { category: mediaCategories[category] } },
          }),
        ]),
      ),
      includeRatings
        ? this.prisma.review.aggregate({
            where: { userId, rating: { not: null }, hiddenAt: null },
            _avg: { rating: true },
            _count: { rating: true },
          })
        : null,
    ]);
    return {
      total: states.reduce((sum, group) => sum + group._count, 0),
      states: Object.fromEntries(
        states.map((group) => [group.state.toLowerCase(), group._count]),
      ),
      categories: Object.fromEntries(categories),
      ratings: ratings && {
        count: ratings._count.rating,
        average:
          ratings._avg.rating === null ? null : Math.round(ratings._avg.rating * 10) / 10,
      },
    };
  }

  private async owner(handle: string) {
    const user = await this.prisma.user.findUnique({
      where: { handle: handle.toLowerCase() },
      include: { privacy: true },
    });
    if (!user?.isActive || !user.privacy) {
      throw new NotFoundException('Profile not found');
    }
    return { user, privacy: user.privacy };
  }

  private async section(handle: string, section: Section) {
    const owner = await this.owner(handle);
    if (!owner.privacy.isPublic || !owner.privacy[section]) {
      throw new NotFoundException('This part of the profile is private');
    }
    return owner;
  }
}
