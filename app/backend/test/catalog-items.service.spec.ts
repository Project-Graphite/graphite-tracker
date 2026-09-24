import { MediaCategory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CatalogItemsService } from '../src/catalog/catalog-items.service';
import { CatalogCandidate } from '../src/sources/source.types';

const candidate: CatalogCandidate = {
  source: 'rawg',
  externalId: '42',
  category: 'game',
  title: 'Graphite Quest',
  originalTitle: 'Graphite Quest',
  synopsis: '',
  posterUrl: null,
  backdropUrl: null,
  releaseDate: '2030-01-01',
  language: 'en',
  genres: [],
  runtimeMinutes: null,
  status: null,
  tagline: null,
  rating: null,
  ratingCount: 0,
  capabilities: {
    progressUnits: ['hours', 'percentage'],
    hasEpisodes: false,
    hasSeasons: false,
    hasPlatforms: true,
    supportsReleaseNotifications: true,
  },
};

describe('CatalogItemsService', () => {
  it('attaches a second source to the same work instead of creating another item', async () => {
    const transaction = {
      sourceEntry: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogItem: {
        findMany: vi.fn().mockResolvedValue([{ id: 'item-from-igdb' }]),
        update: vi.fn().mockResolvedValue({ id: 'item-from-igdb' }),
        create: vi.fn(),
      },
    };

    await expect(
      new CatalogItemsService().upsert(transaction as never, candidate, 'rawg-source'),
    ).resolves.toEqual({ id: 'item-from-igdb' });
    expect(transaction.catalogItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: MediaCategory.GAME,
          releaseDate: {
            gte: new Date('2030-01-01T00:00:00.000Z'),
            lt: new Date('2031-01-01T00:00:00.000Z'),
          },
          sourceEntries: { none: { sourceId: 'rawg-source' } },
        }),
      }),
    );
    expect(transaction.catalogItem.update).toHaveBeenCalledWith({
      where: { id: 'item-from-igdb' },
      data: {
        sourceEntries: {
          create: expect.objectContaining({ sourceId: 'rawg-source', externalId: '42' }),
        },
      },
    });
    expect(transaction.catalogItem.create).not.toHaveBeenCalled();
  });

  it('creates a new item when the title matches more than one work', async () => {
    const transaction = {
      sourceEntry: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogItem: {
        findMany: vi.fn().mockResolvedValue([{ id: 'first' }, { id: 'second' }]),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'new-item' }),
      },
    };

    await expect(
      new CatalogItemsService().upsert(transaction as never, candidate, 'rawg-source'),
    ).resolves.toEqual({ id: 'new-item' });
    expect(transaction.catalogItem.update).not.toHaveBeenCalled();
  });
});
