import { NotFoundException } from '@nestjs/common';
import { ActivityKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesService } from '../src/users/profiles.service';

const hidden = {
  isPublic: false,
  showLibrary: false,
  showActivity: false,
  showRatings: false,
  showReviews: false,
  showStatistics: false,
};

function serviceFor(privacy: Partial<typeof hidden>, user: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-id',
        handle: 'reader',
        displayName: 'Reader One',
        bio: 'Private bio',
        isActive: true,
        privacy: { ...hidden, ...privacy },
        ...user,
      }),
    },
    activityEvent: { count: vi.fn(), findMany: vi.fn() },
    libraryEntry: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
    review: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([0, []]),
  };
  return { prisma, service: new ProfilesService(prisma as never) };
}

describe('ProfilesService privacy', () => {
  it('shows only the display name of a private profile', async () => {
    const { prisma, service } = serviceFor({});

    await expect(service.profile('Reader')).resolves.toEqual({
      handle: 'reader',
      displayName: 'Reader One',
      isPublic: false,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: 'reader' } }),
    );
    expect(prisma.libraryEntry.groupBy).not.toHaveBeenCalled();
  });

  it('treats a deactivated account as missing', async () => {
    const { service } = serviceFor({ isPublic: true }, { isActive: false });

    await expect(service.profile('reader')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['activity', (service: ProfilesService) => service.activity('reader', 1)],
    ['library', (service: ProfilesService) => service.library('reader', { page: 1 })],
    ['ratings', (service: ProfilesService) => service.ratings('reader', 1)],
    ['reviews', (service: ProfilesService) => service.reviews('reader', 1)],
  ])('discloses neither records nor counts for a hidden %s section', async (_section, read) => {
    const everySectionOn = {
      showLibrary: true,
      showActivity: true,
      showRatings: true,
      showReviews: true,
      showStatistics: true,
    };
    const privateProfile = serviceFor(everySectionOn);
    const publicProfile = serviceFor({ isPublic: true });

    await expect(read(privateProfile.service)).rejects.toBeInstanceOf(NotFoundException);
    await expect(read(publicProfile.service)).rejects.toBeInstanceOf(NotFoundException);
    expect(publicProfile.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('filters earlier activity by the sections that are visible now', async () => {
    const { prisma, service } = serviceFor({
      isPublic: true,
      showActivity: true,
      showRatings: true,
    });

    await service.activity('reader', 1);

    expect(prisma.activityEvent.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        OR: [
          {
            kind: ActivityKind.RATED,
            review: { is: { rating: { not: null }, hiddenAt: null } },
          },
        ],
      },
    });
  });

  it('keeps rating statistics out when ratings are hidden', async () => {
    const { prisma, service } = serviceFor({ isPublic: true, showStatistics: true });

    const profile = await service.profile('reader');

    expect(profile).toMatchObject({
      bio: 'Private bio',
      sections: { statistics: true, ratings: false },
      statistics: { total: 0, ratings: null },
    });
    expect(prisma.review.aggregate).not.toHaveBeenCalled();
  });
});
