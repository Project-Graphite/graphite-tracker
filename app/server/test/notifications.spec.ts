import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DigestCadence,
  LibraryState,
  MediaCategory,
  NotificationState,
  ReleaseKind,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { DigestService } from '../src/notifications/digest.service';
import { UpdateNotificationPreferencesDto } from '../src/notifications/dto/notifications.dto';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ReleaseMonitorService } from '../src/notifications/release-monitor.service';
import { digestDue, newSignals, wantsRelease } from '../src/notifications/subscriptions';
import { UnsubscribeTokensService } from '../src/notifications/unsubscribe-tokens.service';

const secret = 'test-access-secret';
const tokens = new UnsubscribeTokensService(
  new ConfigService({ AUTH_ACCESS_TOKEN_SECRET: secret }),
  new JwtService(),
);
const noPreferences = { global: null, categories: new Map<MediaCategory, string>() };
const sourcePreferenceMocks = {
  globalSourcePreference: { findFirst: vi.fn().mockResolvedValue(null) },
  categorySourcePreference: { findMany: vi.fn().mockResolvedValue([]) },
};

function subscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    userId: 'user-1',
    notificationsEnabled: true,
    state: LibraryState.IN_PROGRESS,
    preferredSourceId: null as string | null,
    platforms: [] as string[],
    user: { notificationPreference: { categories: [MediaCategory.TV, MediaCategory.GAME] } },
    catalogItem: {
      canonicalTitle: 'Tower Chronicles',
      category: MediaCategory.TV,
      sourceEntries: [
        { id: 'tmdb-entry', sourceId: 'tmdb', source: { enabled: true } },
        { id: 'other-entry', sourceId: 'other', source: { enabled: true } },
      ],
    },
    ...overrides,
  };
}

const episode = (season: number, number: number) => ({
  key: `episode:${season}x${number}`,
  kind: 'episode' as const,
  label: `Season ${season}, episode ${number}`,
  ordinal: season * 10_000 + number,
  occurredAt: '2026-09-20',
});

describe('Release subscriptions', () => {
  it('sends digests after 08:00 in the reader time zone, daily or on Mondays', () => {
    const mondayMorningTokyo = new Date('2026-09-27T23:30:00Z');
    const mondayDawnTokyo = new Date('2026-09-27T21:00:00Z');
    const tuesdayMorningTokyo = new Date('2026-09-28T23:30:00Z');

    expect(digestDue(mondayMorningTokyo, 'Asia/Tokyo', DigestCadence.DAILY, null)).toBe(true);
    expect(digestDue(mondayDawnTokyo, 'Asia/Tokyo', DigestCadence.DAILY, null)).toBe(false);
    expect(digestDue(mondayMorningTokyo, 'UTC', DigestCadence.DAILY, null)).toBe(true);
    expect(
      digestDue(mondayMorningTokyo, 'Asia/Tokyo', DigestCadence.DAILY, new Date('2026-09-27T23:05:00Z')),
    ).toBe(false);
    expect(
      digestDue(tuesdayMorningTokyo, 'Asia/Tokyo', DigestCadence.DAILY, mondayMorningTokyo),
    ).toBe(true);
    expect(digestDue(mondayMorningTokyo, 'Asia/Tokyo', DigestCadence.WEEKLY, null)).toBe(true);
    expect(digestDue(tuesdayMorningTokyo, 'Asia/Tokyo', DigestCadence.WEEKLY, null)).toBe(false);
  });

  it('keeps only unseen releases that move forward', () => {
    const existing = [
      { key: 'episode:2x7', kind: ReleaseKind.EPISODE, ordinal: 20_007 },
      { key: 'release:PC', kind: ReleaseKind.RELEASE, ordinal: null },
    ];

    expect(
      newSignals(
        [
          episode(2, 7),
          episode(2, 6),
          episode(2, 8),
          { key: 'release:PC', kind: 'release', label: 'Out now on PC', occurredAt: '2026-09-20' },
          { key: 'release:Switch', kind: 'release', label: 'Out now on Switch', occurredAt: '2026-09-20' },
        ],
        existing,
      ).map(({ key }) => key),
    ).toEqual(['episode:2x8', 'release:Switch']);
  });

  it('honours the category, title, list, platform and source switches', () => {
    const marker = { sourceEntryId: 'tmdb-entry', platform: null as string | null };
    const wants = (overrides: Record<string, unknown>, releaseMarker = marker) =>
      wantsRelease(subscriber(overrides) as never, releaseMarker, noPreferences);

    expect(wants({})).toBe(true);
    expect(wants({ notificationsEnabled: false })).toBe(false);
    expect(wants({ state: LibraryState.COMPLETED })).toBe(false);
    expect(wants({ user: { notificationPreference: { categories: [MediaCategory.GAME] } } })).toBe(false);
    expect(wants({ preferredSourceId: 'other' })).toBe(false);
    expect(wants({ platforms: ['PC'] }, { sourceEntryId: 'tmdb-entry', platform: 'PlayStation 5' })).toBe(
      false,
    );
    expect(wants({ platforms: ['PC'] }, { sourceEntryId: 'tmdb-entry', platform: 'PC' })).toBe(true);
  });

  it('accepts only known categories and cadences in preferences', async () => {
    const errors = async (value: object) =>
      (await validate(plainToInstance(UpdateNotificationPreferencesDto, value))).map(
        ({ property }) => property,
      );

    await expect(errors({ enabled: true, categories: ['tv', 'game'], cadence: 'weekly' })).resolves.toEqual([]);
    await expect(errors({ categories: ['tv', 'tv'], cadence: 'hourly', enabled: null })).resolves.toEqual([
      'enabled',
      'categories',
      'cadence',
    ]);
  });
});

describe('ReleaseMonitorService', () => {
  function monitorWith(options: {
    checkedAt: Date | null;
    markers?: Array<{ key: string; kind: ReleaseKind; ordinal: number | null }>;
    subscribers?: object[];
  }) {
    const prisma = {
      ...sourcePreferenceMocks,
      sourceEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'tmdb-entry',
            externalId: '1399',
            catalogItemId: 'item-1',
            releasesCheckedAt: options.checkedAt,
            source: { key: 'tmdb' },
            catalogItem: { category: MediaCategory.TV },
          },
        ]),
        update: vi.fn().mockReturnValue('entry-update'),
      },
      releaseMarker: {
        findMany: vi.fn().mockResolvedValue(options.markers ?? []),
        createManyAndReturn: vi.fn(({ data }: { data: Array<Record<string, unknown>> }) =>
          data.map((marker, index) => ({ id: `marker-${index}`, platform: null, ...marker })),
        ),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue(options.subscribers ?? []) },
      notificationEvent: { createMany: vi.fn() },
      inboxNotification: { createMany: vi.fn() },
      $transaction: vi.fn((queries: unknown[]) => Promise.all(queries)),
    };
    const connectors = { releases: vi.fn().mockResolvedValue([episode(2, 7), episode(2, 8)]) };
    return {
      prisma,
      connectors,
      monitor: new ReleaseMonitorService(prisma as never, connectors as never),
    };
  }

  it('records what a title already has without notifying anyone the first time', async () => {
    const { connectors, monitor, prisma } = monitorWith({ checkedAt: null, subscribers: [subscriber()] });

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(connectors.releases).toHaveBeenCalledWith('tv', '1399', 'tmdb');
    expect(prisma.releaseMarker.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(prisma.notificationEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.inboxNotification.createMany).not.toHaveBeenCalled();
    expect(prisma.sourceEntry.update).toHaveBeenLastCalledWith({
      where: { id: 'tmdb-entry' },
      data: { releasesCheckedAt: expect.any(Date) },
    });
  });

  it('queues one event per new release for each reader who wants it', async () => {
    const { monitor, prisma } = monitorWith({
      checkedAt: new Date('2026-09-26T06:00:00Z'),
      markers: [{ key: 'episode:2x7', kind: ReleaseKind.EPISODE, ordinal: 20_007 }],
      subscribers: [
        subscriber(),
        subscriber({ id: 'entry-2', userId: 'user-2', preferredSourceId: 'other' }),
        subscriber({ id: 'entry-3', userId: 'user-3', user: { notificationPreference: { categories: [] } } }),
      ],
    });

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(prisma.releaseMarker.createManyAndReturn.mock.calls[0]?.[0].data).toEqual([
      expect.objectContaining({ key: 'episode:2x8', kind: ReleaseKind.EPISODE, ordinal: 20_008 }),
    ]);
    expect(prisma.notificationEvent.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', libraryEntryId: 'entry-1', releaseMarkerId: 'marker-0' }],
      skipDuplicates: true,
    });
  });

  it('puts each new release in the inbox of every follower, whatever their email settings', async () => {
    const { monitor, prisma } = monitorWith({
      checkedAt: new Date('2026-09-26T06:00:00Z'),
      markers: [{ key: 'episode:2x7', kind: ReleaseKind.EPISODE, ordinal: 20_007 }],
      subscribers: [
        subscriber(),
        subscriber({ id: 'entry-2', userId: 'user-2', preferredSourceId: 'other' }),
        subscriber({ id: 'entry-3', userId: 'user-3', user: { notificationPreference: null } }),
      ],
    });

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(prisma.inboxNotification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-1', libraryEntryId: 'entry-1', releaseMarkerId: 'marker-0' },
        { userId: 'user-3', libraryEntryId: 'entry-3', releaseMarkerId: 'marker-0' },
      ],
      skipDuplicates: true,
    });
  });

  it('treats a title unchecked for over a week as a fresh start', async () => {
    const { monitor, prisma } = monitorWith({
      checkedAt: new Date('2026-09-01T00:00:00Z'),
      subscribers: [subscriber()],
    });

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(prisma.notificationEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.inboxNotification.createMany).not.toHaveBeenCalled();
  });

  it('leaves a title for the next run when its source fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { connectors, monitor, prisma } = monitorWith({ checkedAt: null });
    connectors.releases.mockRejectedValue(new Error('TMDB returned 503'));

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(prisma.sourceEntry.update).toHaveBeenCalledTimes(1);
    expect(prisma.sourceEntry.update).toHaveBeenCalledWith({
      where: { id: 'tmdb-entry' },
      data: { releasesAttemptedAt: expect.any(Date) },
    });
    expect(prisma.releaseMarker.createManyAndReturn).not.toHaveBeenCalled();
  });

  async function monitorWithDue(count: number) {
    const monitored = monitorWith({ checkedAt: null });
    const [entry] = (await monitored.prisma.sourceEntry.findMany()) as Array<Record<string, unknown>>;
    monitored.prisma.sourceEntry.findMany.mockClear();
    return {
      ...monitored,
      due: Array.from({ length: count }, (_, index) => ({ ...entry, id: `entry-${index}` })),
    };
  }

  it('keeps checking due titles past one batch until none are left', async () => {
    const { connectors, due, monitor, prisma } = await monitorWithDue(101);
    prisma.sourceEntry.findMany
      .mockResolvedValueOnce(due.slice(0, 100))
      .mockResolvedValueOnce(due.slice(100));

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));

    expect(prisma.sourceEntry.findMany).toHaveBeenCalledTimes(2);
    expect(connectors.releases).toHaveBeenCalledTimes(101);
  });

  it('leaves the remaining titles for the next run once ten minutes are spent', async () => {
    const { connectors, due, monitor, prisma } = await monitorWithDue(5);
    prisma.sourceEntry.findMany.mockResolvedValue(due);
    let clock = Date.now();
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    connectors.releases.mockImplementation(() => {
      clock += 6 * 60 * 1000;
      return Promise.resolve([]);
    });

    await monitor.refreshDue(new Date('2026-09-26T12:00:00Z'));
    now.mockRestore();

    expect(connectors.releases).toHaveBeenCalledTimes(2);
  });
});

describe('DigestService', () => {
  const now = new Date('2026-09-27T23:30:00Z');
  const reader = (preference: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'reader@example.com',
    displayName: 'Reader',
    timeZone: 'Asia/Tokyo',
    isActive: true,
    notificationPreference: {
      enabled: true,
      suspendedAt: null,
      cadence: DigestCadence.DAILY,
      lastDigestAt: null,
      deliveryFailures: 0,
      ...preference,
    },
  });
  const event = (id: string, label: string, entry = subscriber()) => ({
    id,
    userId: 'user-1',
    libraryEntryId: entry.id,
    releaseMarker: {
      sourceEntryId: 'tmdb-entry',
      platform: null,
      label,
      sourceEntry: { externalId: '1399', source: { key: 'tmdb' } },
    },
    libraryEntry: entry,
  });

  function digestWith(options: { user?: object; events?: object[]; pending?: string[] }) {
    const events = options.events ?? [event('event-1', 'Season 2, episode 8'), event('event-2', 'Season 2, episode 9')];
    const prisma = {
      ...sourcePreferenceMocks,
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue(options.user ?? reader()) },
      notificationEvent: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce((options.pending ?? ['user-1']).map((userId) => ({ userId })))
          .mockResolvedValue(events),
        updateMany: vi.fn().mockResolvedValue({ count: events.length }),
      },
      notificationPreference: { update: vi.fn().mockReturnValue('preference-update') },
      $transaction: vi.fn((queries: unknown[]) => Promise.all(queries)),
    };
    const mail = {
      configured: true,
      send: vi.fn(),
      link: (path: string) => `https://tracker.example${path}`,
    };
    return { mail, prisma, digests: new DigestService(prisma as never, mail as never, tokens) };
  }

  it('sends one digest with every wanted release after claiming them', async () => {
    const { digests, mail, prisma } = digestWith({});

    await digests.sendDue(now);

    expect(mail.send).toHaveBeenCalledTimes(1);
    const [message] = mail.send.mock.calls[0] as [{ to: string; text: string; headers: Record<string, string> }];
    expect(message.to).toBe('reader@example.com');
    expect(message.text).toContain('Tower Chronicles\n  Season 2, episode 8\n  Season 2, episode 9');
    expect(message.text).toContain('https://tracker.example/titles/tv/1399?source=tmdb');
    expect(message.headers).toEqual({
      'List-Unsubscribe': expect.stringMatching(/^<https:\/\/tracker\.example\/api\/v1\/notifications\/unsubscribe\?token=/),
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    const claim = prisma.notificationEvent.updateMany.mock.calls.findIndex(
      ([args]) => (args as { data: { state: string } }).data.state === NotificationState.SENT,
    );
    expect(prisma.notificationEvent.updateMany.mock.invocationCallOrder[claim]).toBeLessThan(
      mail.send.mock.invocationCallOrder[0]!,
    );
    expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { lastDigestAt: now, deliveryFailures: 0 },
    });
  });

  it('never sends a release another run has already claimed', async () => {
    const { digests, mail, prisma } = digestWith({});
    prisma.notificationEvent.updateMany.mockResolvedValue({ count: 1 });

    await digests.sendDue(now);

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('waits for the digest hour and skips releases nobody wants any more', async () => {
    const early = digestWith({});
    await early.digests.sendDue(new Date('2026-09-27T21:00:00Z'));
    expect(early.mail.send).not.toHaveBeenCalled();
    expect(early.prisma.notificationEvent.updateMany).not.toHaveBeenCalled();

    const unsubscribed = digestWith({ user: reader({ enabled: false }) });
    await unsubscribed.digests.sendDue(now);
    expect(unsubscribed.mail.send).not.toHaveBeenCalled();
    expect(unsubscribed.prisma.notificationEvent.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', state: NotificationState.QUEUED, id: { notIn: [] } },
      data: { state: NotificationState.SKIPPED },
    });

    const completed = digestWith({
      events: [event('event-1', 'Season 2, episode 8', subscriber({ state: LibraryState.COMPLETED }))],
    });
    await completed.digests.sendDue(now);
    expect(completed.mail.send).not.toHaveBeenCalled();
  });

  it('suspends email after repeated rejections without logging the address', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { digests, mail, prisma } = digestWith({ user: reader({ deliveryFailures: 2 }) });
    mail.send.mockRejectedValue(
      Object.assign(new Error('550 5.1.1 <reader@example.com> unknown'), {
        code: 'EENVELOPE',
        responseCode: 550,
      }),
    );

    await digests.sendDue(now);

    expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { deliveryFailures: 3, suspendedAt: now },
    });
    expect(prisma.notificationEvent.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['event-1', 'event-2'] } },
      data: { state: NotificationState.FAILED, sentAt: null, error: 'SMTP 550' },
    });
    expect(warn.mock.calls.flat().join(' ')).not.toContain('reader@example.com');
  });

  it('keeps sending to other readers when one address is refused', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { digests, mail, prisma } = digestWith({ pending: ['user-1', 'user-2', 'user-3'] });
    mail.send
      .mockRejectedValueOnce(Object.assign(new Error('Invalid recipient'), { code: 'EENVELOPE' }))
      .mockRejectedValueOnce(
        Object.assign(new Error('450 mailbox busy'), { code: 'EENVELOPE', responseCode: 450 }),
      )
      .mockResolvedValueOnce(undefined);

    await digests.sendDue(now);

    expect(mail.send).toHaveBeenCalledTimes(3);
    expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { deliveryFailures: 1, suspendedAt: null },
    });
    expect(prisma.notificationPreference.update).toHaveBeenCalledTimes(2);
  });

  it('keeps releases queued and stops the run while SMTP is unreachable', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { digests, mail, prisma } = digestWith({ pending: ['user-1', 'user-2'] });
    mail.send.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }));

    await digests.sendDue(now);

    expect(prisma.notificationEvent.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ['event-1', 'event-2'] } },
      data: { state: NotificationState.QUEUED, sentAt: null },
    });
    expect(prisma.notificationPreference.update).not.toHaveBeenCalled();
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('builds unsubscribe links that stop a title, a category or everything', async () => {
    const { digests, mail } = digestWith({});
    await digests.sendDue(now);
    const [{ text }] = mail.send.mock.calls[0] as [{ text: string }];
    const link = (label: string) =>
      new URL(new RegExp(`${label}: (\\S+)`).exec(text)?.[1] ?? '').searchParams.get('token') ?? '';
    const prisma = {
      libraryEntry: {
        updateMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ catalogItem: { canonicalTitle: 'Tower Chronicles' } }),
      },
      notificationPreference: {
        upsert: vi.fn().mockResolvedValue({ categories: [MediaCategory.TV, MediaCategory.GAME] }),
        update: vi.fn(),
      },
    };
    const notifications = new NotificationsService(prisma as never, tokens);

    await expect(notifications.unsubscribe(link('Stop emails about this title'))).resolves.toEqual({
      scope: 'title',
      title: 'Tower Chronicles',
    });
    expect(prisma.libraryEntry.updateMany).toHaveBeenCalledWith({
      where: { id: 'entry-1', userId: 'user-1' },
      data: { notificationsEnabled: false },
    });

    await expect(notifications.unsubscribe(link('Stop TV emails'))).resolves.toEqual({
      scope: 'category',
      category: 'tv',
    });
    expect(prisma.notificationPreference.update).toHaveBeenLastCalledWith({
      where: { userId: 'user-1' },
      data: { categories: [MediaCategory.GAME] },
    });

    await expect(notifications.unsubscribe(link('Stop all release emails'))).resolves.toEqual({ scope: 'all' });
    expect(prisma.notificationPreference.update).toHaveBeenLastCalledWith({
      where: { userId: 'user-1' },
      data: { enabled: false },
    });
  });
});

describe('Unsubscribe tokens', () => {
  it('rejects tampered tokens and never mixes with sign-in tokens', async () => {
    const jwt = new JwtService();
    const token = tokens.sign('user-1', { scope: 'all' });
    const accessToken = await jwt.signAsync({ sub: 'user-1', scope: 'all' }, { secret });

    expect(tokens.verify(token)).toMatchObject({ sub: 'user-1', scope: 'all' });
    expect(() => tokens.verify(`${token}x`)).toThrow(BadRequestException);
    expect(() => tokens.verify(accessToken)).toThrow(BadRequestException);
    expect(() => jwt.verify(token, { secret })).toThrow();
  });
});
