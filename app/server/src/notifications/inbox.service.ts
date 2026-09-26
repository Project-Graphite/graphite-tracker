import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  catalogItemSummary,
  catalogItemSummaryInclude,
} from '../catalog/catalog-item-summary';
import { PrismaService } from '../prisma/prisma.service';

const pageSize = 20;
const readRetentionMs = 90 * 24 * 60 * 60 * 1000;
const unreadRetentionMs = 180 * 24 * 60 * 60 * 1000;

const inboxInclude = Prisma.validator<Prisma.InboxNotificationInclude>()({
  releaseMarker: { select: { label: true } },
  libraryEntry: { select: { catalogItem: { include: catalogItemSummaryInclude } } },
});

function present(
  notification: Prisma.InboxNotificationGetPayload<{ include: typeof inboxInclude }>,
) {
  return {
    id: notification.id,
    release: notification.releaseMarker.label,
    read: notification.readAt !== null,
    createdAt: notification.createdAt,
    item: catalogItemSummary(notification.libraryEntry.catalogItem),
  };
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page: number) {
    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.inboxNotification.count({ where: { userId } }),
      this.prisma.inboxNotification.findMany({
        where: { userId },
        include: inboxInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalResults: total,
      results: notifications.map(present),
    };
  }

  async summary(userId: string, since?: Date) {
    const [unread, latest, fresh] = await Promise.all([
      this.prisma.inboxNotification.count({ where: { userId, readAt: null } }),
      this.prisma.inboxNotification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      since
        ? this.prisma.inboxNotification.findMany({
            where: { userId, readAt: null, createdAt: { gt: since } },
            include: inboxInclude,
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [],
    ]);
    return { unread, latestAt: latest?.createdAt ?? null, fresh: fresh.map(present) };
  }

  async setRead(userId: string, id: string, read: boolean) {
    const { count } = await this.prisma.inboxNotification.updateMany({
      where: { id, userId },
      data: { readAt: read ? new Date() : null },
    });
    if (!count) {
      throw new NotFoundException('Notification not found');
    }
  }

  async readAll(userId: string) {
    await this.prisma.inboxNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  removeOld(now = new Date()) {
    return this.prisma.inboxNotification.deleteMany({
      where: {
        OR: [
          { readAt: { lt: new Date(now.getTime() - readRetentionMs) } },
          { createdAt: { lt: new Date(now.getTime() - unreadRetentionMs) } },
        ],
      },
    });
  }
}
