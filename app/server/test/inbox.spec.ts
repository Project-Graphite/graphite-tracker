import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InboxService } from '../src/notifications/inbox.service';

const row = {
  id: 'note-1',
  readAt: null,
  createdAt: new Date('2026-09-27T09:00:00Z'),
  releaseMarker: { label: 'Chapter 120' },
  libraryEntry: {
    catalogItem: {
      id: 'item-1',
      category: 'MANGA',
      canonicalTitle: 'Tower Story',
      posterPath: null,
      releaseDate: null,
      metadata: {},
      sourceEntries: [{ externalId: 'md-1', source: { key: 'mangadex', enabled: true } }],
    },
  },
};

function inboxWith(overrides: Record<string, unknown> = {}) {
  const prisma = {
    inboxNotification: {
      count: vi.fn().mockResolvedValue(3),
      findFirst: vi.fn().mockResolvedValue({ createdAt: row.createdAt }),
      findMany: vi.fn().mockResolvedValue([row]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
      ...overrides,
    },
  };
  return { prisma, inbox: new InboxService(prisma as never) };
}

describe('InboxService', () => {
  it('reports the unread count and only releases newer than the last check', async () => {
    const { inbox, prisma } = inboxWith();
    const since = new Date('2026-09-27T08:00:00Z');

    await expect(inbox.summary('user-1')).resolves.toEqual({
      unread: 3,
      latestAt: row.createdAt,
      fresh: [],
    });
    expect(prisma.inboxNotification.findMany).not.toHaveBeenCalled();

    await expect(inbox.summary('user-1', since)).resolves.toMatchObject({
      fresh: [
        {
          id: 'note-1',
          release: 'Chapter 120',
          read: false,
          item: { title: 'Tower Story', source: 'mangadex', externalId: 'md-1' },
        },
      ],
    });
    expect(prisma.inboxNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', readAt: null, createdAt: { gt: since } } }),
    );
  });

  it('marks only the reader’s own notifications as read', async () => {
    const { inbox, prisma } = inboxWith({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) });

    await expect(inbox.setRead('user-1', 'someone-elses', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inboxNotification.updateMany).toHaveBeenCalledWith({
      where: { id: 'someone-elses', userId: 'user-1' },
      data: { readAt: expect.any(Date) },
    });
  });

  it('forgets read notifications after 90 days and every notification after 180', async () => {
    const { inbox, prisma } = inboxWith();

    await inbox.removeOld(new Date('2026-09-27T00:00:00Z'));

    expect(prisma.inboxNotification.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { readAt: { lt: new Date('2026-06-29T00:00:00Z') } },
          { createdAt: { lt: new Date('2026-03-31T00:00:00Z') } },
        ],
      },
    });
  });
});
