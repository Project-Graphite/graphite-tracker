import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityKind, Prisma } from '@prisma/client';
import {
  catalogItemSummary,
  catalogItemSummaryInclude,
} from '../catalog/catalog-item-summary';
import { libraryStates } from '../library/library.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  presentPublicReview,
  publicReviewWhere,
  readableReviewWhere,
} from '../reviews/reviews.service';
import { catalogCategories } from '../sources/source.types';
import { mediaCategories } from '../sources/source-settings.service';
import { ProfileLibraryDto } from './dto/users.dto';

const pageSize = 20;

type Section = 'showLibrary' | 'showActivity' | 'showRatings' | 'showReviews';

const sectionSettings = {
  library: 'showLibrary',
  activity: 'showActivity',
  ratings: 'showRatings',
  reviews: 'showReviews',
  statistics: 'showStatistics',
} as const;

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

  async profile(handle: string, viewer?: AuthenticatedUser) {
    const { user, privacy, admin } = await this.owner(handle, viewer);
    if (!privacy.isPublic && !admin) {
      return { handle: user.handle, displayName: user.displayName, isPublic: false };
    }
    const sections = Object.fromEntries(
      Object.entries(sectionSettings).map(([section, setting]) => [section, admin || privacy[setting]]),
    ) as Record<keyof typeof sectionSettings, boolean>;
    return {
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      isPublic: privacy.isPublic,
      sections,
      ...(admin
        ? {
            privateSections: Object.entries(sectionSettings)
              .filter(([, setting]) => !privacy.isPublic || !privacy[setting])
              .map(([section]) => section),
          }
        : {}),
      statistics: sections.statistics ? await this.statistics(user.id, sections.ratings) : null,
    };
  }

  async activity(handle: string, page: number, viewer?: AuthenticatedUser) {
    const { user, privacy, admin } = await this.section(handle, 'showActivity', viewer);
    const where: Prisma.ActivityEventWhereInput = {
      userId: user.id,
      OR: [
        ...(admin || privacy.showLibrary
          ? [{ kind: { in: [ActivityKind.ADDED, ActivityKind.STATE_CHANGED] } }]
          : []),
        ...(admin || privacy.showRatings
          ? [{ kind: ActivityKind.RATED, review: { is: { rating: { not: null }, hiddenAt: null } } }]
          : []),
        ...(admin || privacy.showReviews
          ? [{ kind: ActivityKind.REVIEWED, review: { is: admin ? readableReviewWhere(viewer) : publicReviewWhere } }]
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

  async library(handle: string, query: ProfileLibraryDto, viewer?: AuthenticatedUser) {
    const { user, privacy, admin } = await this.section(handle, 'showLibrary', viewer);
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
        rating:
          admin || privacy.showRatings ? (entry.catalogItem.reviews[0]?.rating ?? null) : null,
        item: catalogItemSummary(entry.catalogItem),
      })),
    );
  }

  async ratings(handle: string, page: number, viewer?: AuthenticatedUser) {
    const { user } = await this.section(handle, 'showRatings', viewer);
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

  async reviews(handle: string, page: number, viewer?: AuthenticatedUser) {
    const { user, admin } = await this.section(handle, 'showReviews', viewer);
    const where = { ...(admin ? readableReviewWhere(viewer) : publicReviewWhere), userId: user.id };
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

  private async owner(handle: string, viewer?: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { handle: handle.toLowerCase() },
      include: { privacy: true },
    });
    if (!user?.isActive || !user.privacy) {
      throw new NotFoundException('Profile not found');
    }
    return {
      user,
      privacy: user.privacy,
      admin: viewer?.isAdmin === true && viewer.id !== user.id,
    };
  }

  private async section(handle: string, section: Section, viewer?: AuthenticatedUser) {
    const owner = await this.owner(handle, viewer);
    if (!owner.admin && (!owner.privacy.isPublic || !owner.privacy[section])) {
      throw new NotFoundException('This part of the profile is private');
    }
    return owner;
  }
}
