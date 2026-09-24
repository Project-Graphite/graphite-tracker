import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityKind,
  LibraryState,
  Prisma,
  ReportReason,
  Review,
  ReviewVisibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveReviewDto } from './dto/review.dto';

const pageSize = 10;

export const publicReviewWhere = {
  visibility: ReviewVisibility.PUBLIC,
  hiddenAt: null,
  body: { not: null },
  user: { isActive: true },
} satisfies Prisma.ReviewWhereInput;

export function presentPublicReview(
  review: Review & { user: { handle: string; displayName: string } },
) {
  return {
    id: review.id,
    author: { handle: review.user.handle, displayName: review.user.displayName },
    rating: review.rating,
    title: review.title,
    body: review.body,
    containsSpoilers: review.containsSpoilers,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async forSource(source: string, externalId: string, page: number) {
    const item = await this.prisma.catalogItem.findFirst({
      where: { sourceEntries: { some: { externalId, source: { key: source } } } },
      select: { id: true },
    });
    if (!item) {
      return {
        itemId: null,
        rating: { average: null, count: 0 },
        page: 1,
        totalPages: 1,
        totalResults: 0,
        results: [],
      };
    }
    const where = { ...publicReviewWhere, catalogItemId: item.id };
    const [rating, total, reviews] = await this.prisma.$transaction([
      this.prisma.review.aggregate({
        where: {
          catalogItemId: item.id,
          rating: { not: null },
          hiddenAt: null,
          user: { isActive: true },
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { user: { select: { handle: true, displayName: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      itemId: item.id,
      rating: {
        average:
          rating._avg.rating === null ? null : Math.round(rating._avg.rating * 10) / 10,
        count: rating._count.rating,
      },
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalResults: total,
      results: reviews.map(presentPublicReview),
    };
  }

  async own(userId: string, catalogItemId: string) {
    const review = await this.prisma.review.findUnique({
      where: { userId_catalogItemId: { userId, catalogItemId } },
    });
    return review && this.presentOwn(review);
  }

  async save(userId: string, catalogItemId: string, input: SaveReviewDto) {
    const rating = input.rating ?? null;
    const title = input.title ?? null;
    const body = input.body ?? null;
    if (rating === null && body === null) {
      throw new BadRequestException('Add a rating or write a review');
    }
    if (title !== null && body === null) {
      throw new BadRequestException('A review title needs a review');
    }
    const key = { userId_catalogItemId: { userId, catalogItemId } };
    const [item, entry, existing] = await Promise.all([
      this.prisma.catalogItem.findUnique({ where: { id: catalogItemId }, select: { id: true } }),
      this.prisma.libraryEntry.findUnique({ where: key, select: { state: true } }),
      this.prisma.review.findUnique({ where: key }),
    ]);
    if (!item) {
      throw new NotFoundException('Title not found');
    }
    if (
      !existing &&
      entry?.state !== LibraryState.COMPLETED &&
      entry?.state !== LibraryState.DROPPED
    ) {
      throw new ForbiddenException(
        'Mark this title as completed or dropped before rating or reviewing it',
      );
    }
    const data = {
      rating,
      title,
      body,
      containsSpoilers: input.containsSpoilers,
      visibility:
        input.visibility === 'public' ? ReviewVisibility.PUBLIC : ReviewVisibility.PRIVATE,
    };
    const review = await this.prisma.$transaction(async (transaction) => {
      const saved = await transaction.review.upsert({
        where: key,
        create: { userId, catalogItemId, ...data },
        update: data,
      });
      const kinds = [
        ...(rating !== null && rating !== existing?.rating ? [ActivityKind.RATED] : []),
        ...(body !== null && !existing?.body ? [ActivityKind.REVIEWED] : []),
      ];
      if (kinds.includes(ActivityKind.RATED)) {
        await transaction.activityEvent.deleteMany({
          where: { reviewId: saved.id, kind: ActivityKind.RATED },
        });
      }
      if (kinds.length > 0) {
        await transaction.activityEvent.createMany({
          data: kinds.map((kind) => ({ userId, catalogItemId, reviewId: saved.id, kind })),
        });
      }
      return saved;
    });
    return this.presentOwn(review);
  }

  async remove(userId: string, catalogItemId: string) {
    const result = await this.prisma.review.deleteMany({ where: { userId, catalogItemId } });
    if (result.count === 0) {
      throw new NotFoundException('Review not found');
    }
  }

  async report(userId: string, reviewId: string, reason: ReportReason) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, ...publicReviewWhere },
      select: { userId: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.userId === userId) {
      throw new BadRequestException('You cannot report your own review');
    }
    try {
      await this.prisma.reviewReport.create({ data: { reviewId, reporterId: userId, reason } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You already reported this review');
      }
      throw error;
    }
    return { reported: true };
  }

  private presentOwn(review: Review) {
    return {
      id: review.id,
      itemId: review.catalogItemId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      containsSpoilers: review.containsSpoilers,
      visibility: review.visibility.toLowerCase(),
      hidden: review.hiddenAt !== null,
      updatedAt: review.updatedAt,
    };
  }
}
