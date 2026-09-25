import { Injectable } from '@nestjs/common';
import { DigestCadence, NotificationPreference } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mediaCategories } from '../sources/source-settings.service';
import { UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { UnsubscribeTokensService } from './unsubscribe-tokens.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: UnsubscribeTokensService,
  ) {}

  async preferences(userId: string) {
    return this.present(
      await this.prisma.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
    );
  }

  async update(userId: string, input: UpdateNotificationPreferencesDto) {
    const data = {
      enabled: input.enabled,
      categories: input.categories?.map((category) => mediaCategories[category]),
      cadence: input.cadence && (input.cadence === 'weekly' ? DigestCadence.WEEKLY : DigestCadence.DAILY),
      ...(input.enabled ? { suspendedAt: null, deliveryFailures: 0 } : {}),
    };
    return this.present(
      await this.prisma.notificationPreference.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      }),
    );
  }

  async unsubscribe(token: string) {
    const claim = this.tokens.verify(token);
    if (claim.scope === 'title') {
      await this.prisma.libraryEntry.updateMany({
        where: { id: claim.entryId, userId: claim.sub },
        data: { notificationsEnabled: false },
      });
      const entry = await this.prisma.libraryEntry.findFirst({
        where: { id: claim.entryId, userId: claim.sub },
        select: { catalogItem: { select: { canonicalTitle: true } } },
      });
      return { scope: claim.scope, title: entry?.catalogItem.canonicalTitle ?? null };
    }
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId: claim.sub },
      update: {},
      create: { userId: claim.sub },
    });
    await this.prisma.notificationPreference.update({
      where: { userId: claim.sub },
      data:
        claim.scope === 'category'
          ? { categories: preference.categories.filter((category) => category !== claim.category) }
          : { enabled: false },
    });
    return claim.scope === 'category'
      ? { scope: claim.scope, category: claim.category.toLowerCase() }
      : { scope: claim.scope };
  }

  private present(preference: NotificationPreference) {
    return {
      enabled: preference.enabled,
      categories: preference.categories.map((category) => category.toLowerCase()),
      cadence: preference.cadence.toLowerCase(),
      suspended: preference.suspendedAt !== null,
    };
  }
}
