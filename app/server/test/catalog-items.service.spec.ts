import { Logger } from '@nestjs/common';
import { MediaCategory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CatalogItemsService } from '../src/catalog/catalog-items.service';
import { CatalogRefreshService } from '../src/catalog/catalog-refresh.service';
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

  it('never overwrites a stored item with a partial search result', async () => {
    const transaction = {
      sourceEntry: {
        findUnique: vi.fn().mockResolvedValue({ id: 'entry', catalogItemId: 'stored-item' }),
      },
      catalogItem: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'stored-item' }),
        update: vi.fn(),
      },
    };

    await expect(
      new CatalogItemsService().upsert(transaction as never, candidate, 'rawg-source', { partial: true }),
    ).resolves.toEqual({ id: 'stored-item' });
    expect(transaction.catalogItem.update).not.toHaveBeenCalled();
  });

  it('marks an item created from a partial search result for a full refresh', async () => {
    const transaction = {
      sourceEntry: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogItem: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'new-item' }),
      },
    };

    await new CatalogItemsService().upsert(transaction as never, candidate, 'rawg-source', { partial: true });

    expect(transaction.catalogItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceEntries: { create: expect.objectContaining({ lastRefreshedAt: null }) },
      }),
    });
  });
});

describe('CatalogRefreshService', () => {
  const due = [
    { id: 'entry-1', sourceId: 'rawg-source', externalId: '42', source: { key: 'rawg' }, catalogItem: { category: MediaCategory.GAME } },
    { id: 'entry-2', sourceId: 'rawg-source', externalId: '43', source: { key: 'rawg' }, catalogItem: { category: MediaCategory.GAME } },
  ];

  function refreshWith(details: ReturnType<typeof vi.fn>) {
    const prisma = {
      sourceEntry: { findMany: vi.fn().mockResolvedValue(due), update: vi.fn() },
      $transaction: vi.fn((work: (client: unknown) => unknown) => work('transaction')),
    };
    const catalogItems = { upsert: vi.fn() };
    return {
      catalogItems,
      prisma,
      refresh: new CatalogRefreshService(prisma as never, { details } as never, catalogItems as never),
    };
  }

  it('refreshes library titles that were never or not recently refreshed with full details', async () => {
    const now = new Date('2026-09-26T12:00:00Z');
    const details = vi.fn((_category: string, externalId: string) => Promise.resolve({ ...candidate, externalId }));
    const { catalogItems, prisma, refresh } = refreshWith(details);

    await refresh.refreshDue(now);

    expect(prisma.sourceEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: { enabled: true },
          catalogItem: { libraryEntries: { some: {} } },
          OR: [
            { lastRefreshedAt: null },
            { lastRefreshedAt: { lt: new Date('2026-09-19T12:00:00Z') } },
          ],
        },
        orderBy: { lastRefreshedAt: { sort: 'asc', nulls: 'first' } },
      }),
    );
    expect(details).toHaveBeenCalledWith('game', '42', 'rawg', true);
    expect(catalogItems.upsert).toHaveBeenCalledWith('transaction', { ...candidate, externalId: '43' }, 'rawg-source');
    expect(prisma.sourceEntry.update).not.toHaveBeenCalled();
  });

  it('moves on from a title its source cannot return and tries it again next week', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const now = new Date('2026-09-26T12:00:00Z');
    const details = vi
      .fn()
      .mockRejectedValueOnce(new Error('RAWG returned 404'))
      .mockResolvedValueOnce({ ...candidate, externalId: '43' });
    const { catalogItems, prisma, refresh } = refreshWith(details);

    await refresh.refreshDue(now);

    expect(prisma.sourceEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: { lastRefreshedAt: now },
    });
    expect(catalogItems.upsert).toHaveBeenCalledTimes(1);
  });
});
