import { BadRequestException } from '@nestjs/common';
import { LibraryState, MediaCategory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryService } from '../src/library/library.service';
import { stillReleasing } from '../src/library/release-window';

const now = new Date('2026-09-27T12:00:00Z');
const day = (value: string) => new Date(`${value}T00:00:00Z`);

describe('Release window', () => {
  it('follows series until they end or are cancelled', () => {
    expect(stillReleasing(MediaCategory.TV, { status: 'Returning Series' }, day('2020-01-01'), now)).toBe(true);
    expect(stillReleasing(MediaCategory.TV, { status: 'Ended' }, day('2020-01-01'), now)).toBe(false);
    expect(stillReleasing(MediaCategory.TV, { status: 'Canceled' }, day('2020-01-01'), now)).toBe(false);
    expect(
      stillReleasing(
        MediaCategory.ANIME,
        { status: 'Ended', capabilities: { hasEpisodes: true } },
        day('2020-01-01'),
        now,
      ),
    ).toBe(false);
  });

  it('follows films until 90 days after release', () => {
    expect(stillReleasing(MediaCategory.MOVIE, { status: 'Post Production' }, day('2026-12-01'), now)).toBe(true);
    expect(stillReleasing(MediaCategory.MOVIE, { status: 'Released' }, day('2026-08-01'), now)).toBe(true);
    expect(stillReleasing(MediaCategory.MOVIE, { status: 'Released' }, day('2026-05-01'), now)).toBe(false);
    expect(stillReleasing(MediaCategory.MOVIE, { status: 'Canceled' }, null, now)).toBe(false);
    expect(
      stillReleasing(MediaCategory.ANIME, { capabilities: { hasEpisodes: false } }, day('2019-07-19'), now),
    ).toBe(false);
  });

  it('follows manga and manhwa until they are completed or cancelled', () => {
    expect(stillReleasing(MediaCategory.MANGA, { status: 'ongoing' }, day('2015-01-01'), now)).toBe(true);
    expect(stillReleasing(MediaCategory.MANHWA, { status: 'hiatus' }, day('2015-01-01'), now)).toBe(true);
    expect(stillReleasing(MediaCategory.MANGA, { status: 'completed' }, day('2015-01-01'), now)).toBe(false);
  });

  it('follows games while any platform release, or the game itself, is still to come', () => {
    const released = day('2024-03-01');
    expect(stillReleasing(MediaCategory.GAME, {}, null, now)).toBe(true);
    expect(stillReleasing(MediaCategory.GAME, {}, day('2027-02-01'), now)).toBe(true);
    expect(
      stillReleasing(MediaCategory.GAME, { releaseDates: [{ date: '2026-11-20', platform: 'Switch' }] }, released, now),
    ).toBe(true);
    expect(stillReleasing(MediaCategory.GAME, { status: 'Early Access' }, released, now)).toBe(true);
    expect(
      stillReleasing(MediaCategory.GAME, { releaseDates: [{ date: '2024-03-01', platform: 'PC' }] }, released, now),
    ).toBe(false);
  });

  it('refuses to turn notifications on for a finished title but lets them be turned off', async () => {
    const entry = {
      id: 'entry-id',
      userId: 'user-id',
      catalogItemId: 'item-id',
      state: LibraryState.IN_PROGRESS,
      platforms: [],
      catalogItem: {
        category: MediaCategory.TV,
        releaseDate: day('2008-01-20'),
        metadata: { status: 'Ended', capabilities: { progressUnits: ['season', 'episode'] } },
      },
    };
    const update = vi.fn().mockRejectedValue(new Error('stop after the checks'));
    const serviceWith = (notificationsEnabled: boolean) =>
      new LibraryService(
        {
          libraryEntry: {
            findFirst: vi.fn().mockResolvedValue({ ...entry, notificationsEnabled }),
            update,
          },
        } as never,
        {} as never,
        {} as never,
      );

    await expect(
      serviceWith(false).update('user-id', 'entry-id', { notificationsEnabled: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();

    await expect(
      serviceWith(true).update('user-id', 'entry-id', { notificationsEnabled: false }),
    ).rejects.toThrow('stop after the checks');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notificationsEnabled: false }) }),
    );
  });
});
