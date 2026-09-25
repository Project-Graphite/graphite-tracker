import { Injectable, Logger } from '@nestjs/common';
import { MediaCategory, NotificationState, Prisma } from '@prisma/client';
import { loadSourcePreferences } from '../library/effective-source';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { categoryNames, digestDue, subscriptionInclude, wantsRelease } from './subscriptions';
import { UnsubscribeTokensService } from './unsubscribe-tokens.service';

const maxDeliveryFailures = 3;
const retentionMs = 90 * 24 * 60 * 60 * 1000;

const digestEventInclude = Prisma.validator<Prisma.NotificationEventInclude>()({
  releaseMarker: { include: { sourceEntry: { include: { source: true } } } },
  libraryEntry: { include: subscriptionInclude },
});

type DigestEvent = Prisma.NotificationEventGetPayload<{ include: typeof digestEventInclude }>;

function recipientFailure(error: unknown) {
  const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  if (code !== 'EENVELOPE') {
    return null;
  }
  return typeof responseCode === 'number'
    ? { permanent: responseCode >= 500, reason: `SMTP ${responseCode}` }
    : { permanent: true, reason: 'Recipient address refused' };
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly tokens: UnsubscribeTokensService,
  ) {}

  async sendDue(now = new Date()) {
    if (!this.mail.configured) {
      return;
    }
    const pending = await this.prisma.notificationEvent.findMany({
      where: { state: NotificationState.QUEUED },
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const { userId } of pending) {
      if (!(await this.send(userId, now))) {
        return;
      }
    }
  }

  removeOld(now = new Date()) {
    return this.prisma.notificationEvent.deleteMany({
      where: {
        state: { in: [NotificationState.SENT, NotificationState.SKIPPED] },
        createdAt: { lt: new Date(now.getTime() - retentionMs) },
      },
    });
  }

  private async send(userId: string, now: Date) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { notificationPreference: true },
    });
    const preference = user.notificationPreference;
    const subscribed = user.isActive && preference?.enabled && !preference.suspendedAt;
    if (subscribed && !digestDue(now, user.timeZone, preference.cadence, preference.lastDigestAt)) {
      return true;
    }
    const events = await this.prisma.notificationEvent.findMany({
      where: { userId, state: NotificationState.QUEUED },
      include: digestEventInclude,
      orderBy: { createdAt: 'asc' },
    });
    const preferences = subscribed ? await loadSourcePreferences(this.prisma, userId) : null;
    const wanted = preferences
      ? events.filter((event) => wantsRelease(event.libraryEntry, event.releaseMarker, preferences))
      : [];
    const wantedIds = wanted.map(({ id }) => id);
    await this.prisma.notificationEvent.updateMany({
      where: { userId, state: NotificationState.QUEUED, id: { notIn: wantedIds } },
      data: { state: NotificationState.SKIPPED },
    });
    if (!preference || wanted.length === 0) {
      return true;
    }
    const claimed = await this.prisma.notificationEvent.updateMany({
      where: { id: { in: wantedIds }, state: NotificationState.QUEUED },
      data: { state: NotificationState.SENT, sentAt: now },
    });
    if (claimed.count !== wanted.length) {
      return true;
    }
    try {
      await this.mail.send(this.message(user, wanted));
    } catch (error) {
      const refused = recipientFailure(error);
      const failures = preference.deliveryFailures + 1;
      const suspend = refused?.permanent === true && failures >= maxDeliveryFailures;
      await this.prisma.$transaction([
        this.prisma.notificationEvent.updateMany({
          where: { id: { in: wantedIds } },
          data:
            suspend && refused
              ? { state: NotificationState.FAILED, sentAt: null, error: refused.reason }
              : { state: NotificationState.QUEUED, sentAt: null },
        }),
        ...(refused?.permanent
          ? [
              this.prisma.notificationPreference.update({
                where: { userId },
                data: { deliveryFailures: failures, suspendedAt: suspend ? now : null },
              }),
            ]
          : []),
      ]);
      if (!refused) {
        this.logger.warn(
          `Digest delivery is unavailable (${(error as { code?: string }).code ?? 'unknown error'}); retrying on the next run`,
        );
        return false;
      }
      this.logger.warn(
        `Digest for user ${userId} was refused (${refused.reason})${suspend ? '; email notifications suspended' : ''}`,
      );
      return true;
    }
    await this.prisma.notificationPreference.update({
      where: { userId },
      data: { lastDigestAt: now, deliveryFailures: 0 },
    });
    return true;
  }

  private message(user: { id: string; email: string; displayName: string }, events: DigestEvent[]) {
    const titles = new Map<string, DigestEvent[]>();
    for (const event of events) {
      titles.set(event.libraryEntryId, [...(titles.get(event.libraryEntryId) ?? []), event]);
    }
    const categories = new Set<MediaCategory>(
      events.map((event) => event.libraryEntry.catalogItem.category),
    );
    const unsubscribe = (path: string, scope: Parameters<UnsubscribeTokensService['sign']>[1]) =>
      this.mail.link(`${path}?token=${this.tokens.sign(user.id, scope)}`);
    const sections = [...titles.values()].map((group) => {
      const [{ libraryEntry, releaseMarker }] = group as [DigestEvent, ...DigestEvent[]];
      const { sourceEntry } = releaseMarker;
      return [
        libraryEntry.catalogItem.canonicalTitle,
        ...group.map((event) => `  ${event.releaseMarker.label}`),
        `  ${this.mail.link(`/titles/${libraryEntry.catalogItem.category.toLowerCase()}/${encodeURIComponent(sourceEntry.externalId)}?source=${sourceEntry.source.key}`)}`,
        `  Stop emails about this title: ${unsubscribe('/unsubscribe', { scope: 'title', entryId: libraryEntry.id })}`,
      ].join('\n');
    });
    return {
      to: user.email,
      subject: `${events.length} new ${events.length === 1 ? 'release' : 'releases'} in your Graphite Tracker library`,
      text: [
        `Hi ${user.displayName},`,
        '',
        'New since your last digest:',
        '',
        sections.join('\n\n'),
        '',
        '--',
        ...[...categories].map(
          (category) =>
            `Stop ${categoryNames[category]} emails: ${unsubscribe('/unsubscribe', { scope: 'category', category })}`,
        ),
        `Stop all release emails: ${unsubscribe('/unsubscribe', { scope: 'all' })}`,
        `Manage notifications: ${this.mail.link('/settings/notifications')}`,
      ].join('\n'),
      headers: {
        'List-Unsubscribe': `<${unsubscribe('/api/v1/notifications/unsubscribe', { scope: 'all' })}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  }
}
