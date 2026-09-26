import { Injectable, Logger } from '@nestjs/common';
import { MediaCategory, NotificationState, Prisma } from '@prisma/client';
import { loadSourcePreferences } from '../library/effective-source';
import { MailDeliveryError, MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { categoryNames, digestDue, subscriptionInclude, wantsRelease } from './subscriptions';
import { UnsubscribeTokensService } from './unsubscribe-tokens.service';

const maxDeliveryFailures = 3;
const retentionMs = 90 * 24 * 60 * 60 * 1000;
const interruptedSendMs = 60 * 60 * 1000;

const digestEventInclude = Prisma.validator<Prisma.NotificationEventInclude>()({
  releaseMarker: { include: { sourceEntry: { include: { source: true } } } },
  libraryEntry: { include: subscriptionInclude },
});

type DigestEvent = Prisma.NotificationEventGetPayload<{ include: typeof digestEventInclude }>;

function readerFailure(error: unknown) {
  if (!(error instanceof MailDeliveryError)) {
    return null;
  }
  const refusedRecipient = error.code === 'EENVELOPE' && error.command === 'RCPT TO';
  if (!refusedRecipient && error.code !== 'EMESSAGE') {
    return null;
  }
  return error.responseCode === undefined
    ? { permanent: true, reason: refusedRecipient ? 'Recipient address refused' : 'Message refused' }
    : { permanent: error.responseCode >= 500, reason: `SMTP ${error.responseCode}` };
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
    await this.prisma.$executeRaw`
      UPDATE notification_events AS event
      SET state = 'queued', sent_at = NULL
      FROM notification_preferences AS preference
      WHERE preference.user_id = event.user_id
        AND event.state = 'sent'
        AND event.sent_at < ${new Date(now.getTime() - interruptedSendMs)}
        AND (preference.last_digest_at IS NULL OR preference.last_digest_at < event.sent_at)`;
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
    const wantedIds = new Set(wanted.map(({ id }) => id));
    await this.prisma.notificationEvent.updateMany({
      where: {
        id: { in: events.filter(({ id }) => !wantedIds.has(id)).map(({ id }) => id) },
        state: NotificationState.QUEUED,
      },
      data: { state: NotificationState.SKIPPED },
    });
    if (!preference || wanted.length === 0) {
      return true;
    }
    const claimed = new Set(
      (
        await this.prisma.notificationEvent.updateManyAndReturn({
          where: { id: { in: [...wantedIds] }, state: NotificationState.QUEUED },
          data: { state: NotificationState.SENT, sentAt: now },
          select: { id: true },
        })
      ).map(({ id }) => id),
    );
    const sending = wanted.filter(({ id }) => claimed.has(id));
    if (sending.length === 0) {
      return true;
    }
    try {
      await this.mail.send(this.message(user, sending));
    } catch (error) {
      const refused = readerFailure(error);
      const failures = preference.deliveryFailures + 1;
      const suspend = refused?.permanent === true && failures >= maxDeliveryFailures;
      await this.prisma.$transaction([
        this.prisma.notificationEvent.updateMany({
          where: { id: { in: [...claimed] } },
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
          `Digest delivery is unavailable (${error instanceof Error ? error.message : 'unknown error'}); retrying on the next run`,
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
