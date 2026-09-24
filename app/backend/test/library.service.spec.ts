import { BadRequestException } from '@nestjs/common';
import { LibraryState, MediaCategory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryService } from '../src/library/library.service';

describe('LibraryService', () => {
  it('looks up the current user entries by source external IDs', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LibraryService(
      { libraryEntry: { findMany } } as never,
      {} as never,
      {} as never,
    );

    await expect(service.lookup('user-id', 'tmdb:550,tmdb:anime,tmdb:tv:42,broken')).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        catalogItem: {
          sourceEntries: {
            some: {
              OR: [
                { externalId: '550', source: { key: 'tmdb' } },
                { externalId: 'anime', source: { key: 'tmdb' } },
                { externalId: 'tv:42', source: { key: 'tmdb' } },
              ],
            },
          },
        },
      },
      include: expect.any(Object),
    });
  });

  it('rejects episode progress for an anime film without episode capabilities', async () => {
    const update = vi.fn();
    const service = new LibraryService(
      {
        libraryEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'entry-id',
            userId: 'user-id',
            catalogItemId: 'item-id',
            state: LibraryState.PLANNED,
            platforms: [],
            catalogItem: {
              category: MediaCategory.ANIME,
              metadata: { capabilities: { progressUnits: [] } },
            },
          }),
          update,
        },
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update('user-id', 'entry-id', { progressEpisode: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects game platforms that are absent from catalogue metadata', async () => {
    const update = vi.fn();
    const service = new LibraryService(
      {
        libraryEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'entry-id',
            userId: 'user-id',
            catalogItemId: 'item-id',
            state: LibraryState.PLANNED,
            platforms: [],
            catalogItem: {
              category: MediaCategory.GAME,
              metadata: {
                capabilities: { progressUnits: ['hours', 'percentage'] },
                platforms: ['PC'],
              },
            },
          }),
          update,
        },
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update('user-id', 'entry-id', { platforms: ['PlayStation 5'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('requires a selected platform for game release notifications', async () => {
    const update = vi.fn();
    const service = new LibraryService(
      {
        libraryEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'entry-id',
            userId: 'user-id',
            catalogItemId: 'item-id',
            state: LibraryState.PLANNED,
            platforms: [],
            catalogItem: {
              category: MediaCategory.GAME,
              metadata: {
                capabilities: { progressUnits: ['hours', 'percentage'] },
                platforms: ['PC'],
              },
            },
          }),
          update,
        },
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update('user-id', 'entry-id', { notificationsEnabled: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
