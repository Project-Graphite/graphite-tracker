import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationState, Prisma, ReportResolution, ReviewVisibility } from '@prisma/client';
import {
  catalogItemSummary,
  catalogItemSummaryInclude,
} from '../catalog/catalog-item-summary';
import { PrismaService } from '../prisma/prisma.service';

const pageSize = 20;

const moderatedReviewWhere = {
  body: { not: null },
} satisfies Prisma.ReviewWhereInput;

const moderatedReviewInclude = Prisma.validator<Prisma.ReviewInclude>()({
  user: { select: { handle: true, displayName: true } },
  catalogItem: { include: catalogItemSummaryInclude },
  _count: { select: { reports: { where: { resolution: null } } } },
});

function paged<T>(page: number, total: number, results: T[]) {
  return {
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalResults: total,
    results,
  };
}

function presentReview(
  review: Prisma.ReviewGetPayload<{ include: typeof moderatedReviewInclude }>,
) {
  return {
    id: review.id,
    author: review.user,
    rating: review.rating,
    title: review.title,
    body: review.body,
    containsSpoilers: review.containsSpoilers,
    visibility: review.visibility.toLowerCase(),
    hidden: review.hiddenAt !== null,
    openReports: review._count.reports,
    updatedAt: review.updatedAt,
    item: catalogItemSummary(review.catalogItem),
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async reports(status: 'open' | 'resolved', page: number) {
    const where = {
      resolution: status === 'open' ? null : { not: null },
      review: moderatedReviewWhere,
    };
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.reviewReport.count({ where }),
      this.prisma.reviewReport.findMany({
        where,
        include: {
          review: { include: moderatedReviewInclude },
          reporter: { select: { handle: true, displayName: true } },
          moderator: { select: { handle: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(
      page,
      total,
      reports.map((report) => ({
        id: report.id,
        reason: report.reason.toLowerCase(),
        createdAt: report.createdAt,
        resolution: report.resolution?.toLowerCase() ?? null,
        resolvedAt: report.resolvedAt,
        reporter: report.reporter,
        moderator: report.moderator?.handle ?? null,
        review: presentReview(report.review),
      })),
    );
  }

  async resolveReport(moderatorId: string, id: string, resolution: ReportResolution) {
    const report = await this.prisma.reviewReport.findFirst({
      where: { id, resolution: null },
    });
    if (!report) {
      throw new NotFoundException('Open report not found');
    }
    if (resolution === ReportResolution.HIDDEN) {
      await this.setReviewHidden(moderatorId, report.reviewId, true);
      return;
    }
    await this.prisma.reviewReport.update({
      where: { id },
      data: { resolution, moderatorId, resolvedAt: new Date() },
    });
  }

  async reviews(status: 'public' | 'private' | 'hidden', page: number) {
    const where: Prisma.ReviewWhereInput = {
      ...moderatedReviewWhere,
      ...(status === 'hidden'
        ? { hiddenAt: { not: null } }
        : {
            hiddenAt: null,
            visibility: status === 'public' ? ReviewVisibility.PUBLIC : ReviewVisibility.PRIVATE,
          }),
    };
    const [total, reviews] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: moderatedReviewInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(page, total, reviews.map(presentReview));
  }

  async setReviewHidden(moderatorId: string, id: string, hidden: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.$transaction([
      this.prisma.review.update({
        where: { id },
        data: { hiddenAt: hidden ? new Date() : null },
      }),
      ...(hidden
        ? [
            this.prisma.reviewReport.updateMany({
              where: { reviewId: id, resolution: null },
              data: { resolution: ReportResolution.HIDDEN, moderatorId, resolvedAt: new Date() },
            }),
          ]
        : []),
    ]);
  }

  async users(query: string | undefined, page: number) {
    const where: Prisma.UserWhereInput = query
      ? {
          OR: (['email', 'handle', 'displayName'] as const).map((field) => ({
            [field]: { contains: query, mode: Prisma.QueryMode.insensitive },
          })),
        }
      : {};
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          handle: true,
          displayName: true,
          verifiedAt: true,
          isActive: true,
          isAdmin: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paged(page, total, users);
  }

  async failedNotifications(page: number) {
    const where = { state: NotificationState.FAILED };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.notificationEvent.count({ where }),
      this.prisma.notificationEvent.findMany({
        where,
        include: {
          user: { select: { handle: true, displayName: true } },
          releaseMarker: { select: { label: true } },
          libraryEntry: { select: { catalogItem: { include: catalogItemSummaryInclude } } },
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
        user: event.user,
        release: event.releaseMarker.label,
        error: event.error,
        createdAt: event.createdAt,
        item: catalogItemSummary(event.libraryEntry.catalogItem),
      })),
    );
  }

  async setUserActive(adminId: string, id: string, active: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isAdmin: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.id === adminId || user.isAdmin) {
      throw new ForbiddenException('Administrator accounts cannot be deactivated here');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive: active } }),
      ...(active
        ? []
        : [
            this.prisma.refreshSession.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);
  }
}
