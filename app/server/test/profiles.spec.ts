import { NotFoundException } from '@nestjs/common';
import { ActivityKind } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePrivacyDto, UpdateProfileDto } from '../src/users/dto/users.dto';
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
        catalogItem: { libraryEntries: { none: { userId: 'user-id', isPrivate: true } } },
        OR: [
          {
            kind: ActivityKind.RATED,
            review: { is: { rating: { not: null }, hiddenAt: null } },
          },
        ],
      },
    });
  });

  it('shows the administrator a private profile in full, marked as private', async () => {
    const admin = { id: 'admin-id', isAdmin: true };
    const { prisma, service } = serviceFor({ showReviews: true });

    await expect(service.profile('reader', admin)).resolves.toMatchObject({
      isPublic: false,
      bio: 'Private bio',
      sections: { library: true, activity: true, ratings: true, reviews: true, statistics: true },
      privateSections: ['library', 'activity', 'ratings', 'reviews', 'statistics'],
      statistics: { total: 0 },
    });
    await service.reviews('reader', 1, admin);
    expect(prisma.review.count).toHaveBeenCalledWith({
      where: { hiddenAt: null, body: { not: null }, user: { isActive: true }, userId: 'user-id' },
    });
    await service.library('reader', { page: 1 }, admin);
    expect(prisma.libraryEntry.count).toHaveBeenCalled();
  });

  it('marks only the hidden sections of a public profile for the administrator', async () => {
    const { service } = serviceFor({ isPublic: true, showLibrary: true, showStatistics: true });

    await expect(
      service.profile('reader', { id: 'admin-id', isAdmin: true }),
    ).resolves.toMatchObject({
      isPublic: true,
      privateSections: ['activity', 'ratings', 'reviews'],
    });
  });

  it('shows readers and the administrator on their own profile only what is public', async () => {
    const { service } = serviceFor({});

    for (const viewer of [
      { id: 'someone', isAdmin: false },
      { id: 'user-id', isAdmin: true },
    ]) {
      await expect(service.profile('reader', viewer)).resolves.toEqual({
        handle: 'reader',
        displayName: 'Reader One',
        isPublic: false,
      });
      await expect(service.reviews('reader', 1, viewer)).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('keeps private entries off the profile for everyone but administrators', async () => {
    const everything = {
      isPublic: true,
      showLibrary: true,
      showActivity: true,
      showRatings: true,
      showReviews: true,
      showStatistics: true,
    };
    const hidesPrivate = { catalogItem: { libraryEntries: { none: { userId: 'user-id', isPrivate: true } } } };
    const { prisma, service } = serviceFor(everything);

    await service.profile('reader');
    await service.library('reader', { page: 1 });
    await service.activity('reader', 1);
    await service.ratings('reader', 1);
    await service.reviews('reader', 1);

    expect(prisma.libraryEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id', isPrivate: false } }),
    );
    expect(prisma.libraryEntry.count).toHaveBeenCalledWith({
      where: { userId: 'user-id', isPrivate: false },
    });
    expect(prisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(hidesPrivate) }),
    );
    expect(prisma.activityEvent.count).toHaveBeenCalledWith({ where: expect.objectContaining(hidesPrivate) });
    for (const [where] of prisma.review.count.mock.calls as Array<[{ where: object }]>) {
      expect(where.where).toMatchObject(hidesPrivate);
    }

    const admin = serviceFor(everything);
    await admin.service.library('reader', { page: 1 }, { id: 'admin-id', isAdmin: true } as never);
    expect(admin.prisma.libraryEntry.count).toHaveBeenCalledWith({ where: { userId: 'user-id' } });
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

describe('Profile settings input', () => {
  const errors = async (type: new () => object, value: object) =>
    (await validate(plainToInstance(type, value))).map(({ property }) => property);

  it('rejects a null display name but still clears the bio with null', async () => {
    await expect(errors(UpdateProfileDto, {})).resolves.toEqual([]);
    await expect(errors(UpdateProfileDto, { bio: null })).resolves.toEqual([]);
    await expect(errors(UpdateProfileDto, { displayName: null })).resolves.toEqual(['displayName']);
  });

  it('rejects null for every privacy switch that is sent', async () => {
    await expect(errors(UpdatePrivacyDto, {})).resolves.toEqual([]);
    await expect(
      errors(UpdatePrivacyDto, Object.fromEntries(Object.keys(hidden).map((key) => [key, null]))),
    ).resolves.toEqual(Object.keys(hidden));
  });
});
