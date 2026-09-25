import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ImportConflictPolicy,
  ImportMatch,
  ImportState,
  LibraryState,
  Prisma,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { DecideCandidateDto } from '../src/imports/dto/import.dto';
import { ImportMatcherService, titleSimilarity } from '../src/imports/import-matcher.service';
import { ImportsService } from '../src/imports/imports.service';
import { CatalogCandidate } from '../src/sources/source.types';

function candidate(overrides: Partial<CatalogCandidate>): CatalogCandidate {
  return {
    source: 'mangadex',
    externalId: 'id',
    category: 'manga',
    title: 'Title',
    originalTitle: 'Title',
    alternateTitles: [],
    synopsis: 'A long synopsis',
    posterUrl: null,
    backdropUrl: null,
    releaseDate: null,
    language: 'ja',
    genres: [],
    runtimeMinutes: null,
    status: null,
    tagline: null,
    rating: null,
    ratingCount: 0,
    capabilities: {
      progressUnits: ['chapter', 'volume'],
      hasEpisodes: false,
      hasSeasons: false,
      hasPlatforms: false,
      supportsReleaseNotifications: true,
    },
    ...overrides,
  };
}

const page = (results: CatalogCandidate[]) => ({
  page: 1,
  totalPages: 1,
  totalResults: results.length,
  results,
  attribution: 'Test',
  stale: false,
});

describe('ImportMatcherService', () => {
  it('scores identical titles above near matches', () => {
    expect(titleSimilarity('Tower Story!', 'tower  story')).toBe(1);
    expect(titleSimilarity('Tower Story', 'Tower Stories')).toBeGreaterThan(0.6);
    expect(titleSimilarity('Tower Story', 'Graphite Days')).toBeLessThan(0.3);
  });

  it('accepts a MangaDex identifier as an exact match', async () => {
    const registry = {
      recognize: vi.fn().mockResolvedValue({ category: 'manhwa', externalId: 'uuid', source: 'mangadex' }),
      details: vi.fn().mockResolvedValue(candidate({ externalId: 'uuid', category: 'manhwa' })),
      search: vi.fn(),
    };

    const result = await new ImportMatcherService(registry as never).match({
      kind: 'manga',
      title: 'Anything',
      trackerTitles: [],
      mangadexId: 'uuid',
    });

    expect(result.match).toBe(ImportMatch.EXACT);
    expect(result.options[0]?.item).toMatchObject({ externalId: 'uuid', synopsis: '' });
    expect(registry.search).not.toHaveBeenCalled();
  });

  it('only suggests title matches and never accepts them silently', async () => {
    const registry = {
      recognize: vi.fn().mockRejectedValue(new NotFoundException()),
      search: vi.fn().mockImplementation((category: string) =>
        Promise.resolve(
          page(
            category === 'manga'
              ? [
                  candidate({ externalId: 'near', title: 'Tower Stories' }),
                  candidate({ externalId: 'far', title: 'Graphite Days' }),
                ]
              : [candidate({ externalId: 'manhwa', category: 'manhwa', title: 'Tower Story' })],
          ),
        ),
      ),
    };

    const result = await new ImportMatcherService(registry as never).match({
      kind: 'manga',
      title: 'Tower Story',
      trackerTitles: [],
      mangadexId: 'missing',
    });

    expect(result.match).toBe(ImportMatch.SUGGESTED);
    expect(result.options.map((option) => option.item.externalId)).toEqual(['manhwa', 'near']);
  });

  it('matches ordinary TV and films only on an identical title', async () => {
    const registry = {
      search: vi.fn().mockImplementation((category: string) =>
        Promise.resolve(
          page(
            category === 'movie'
              ? [candidate({ externalId: 'film', category: 'movie', title: 'Graphite Day' })]
              : [],
          ),
        ),
      ),
    };

    const result = await new ImportMatcherService(registry as never).match({
      kind: 'anime',
      title: 'Graphite Days',
      trackerTitles: [],
      mangadexId: null,
    });

    expect(result).toEqual({ match: ImportMatch.UNMATCHED, options: [] });
  });
});

describe('ImportsService', () => {
  function service(prisma: object, library: object = {}) {
    return new ImportsService(
      prisma as never,
      { resolve: vi.fn() } as never,
      {} as never,
      library as never,
      {} as never,
    );
  }

  it('flags duplicates and untitled entries while storing the preview', async () => {
    const createMany = vi.fn();
    const prisma = {
      $transaction: (run: (transaction: object) => Promise<void>) =>
        run({ importCandidate: { createMany }, importBatch: { update: vi.fn() } }),
    };
    const imports = service(prisma);
    const internals = imports as unknown as {
      parse(file: Buffer): Promise<unknown>;
      match(batchId: string): Promise<void>;
      read(batchId: string, file: Buffer): Promise<void>;
    };
    const entry = {
      kind: 'manga',
      trackerTitles: [],
      sourceName: null,
      sourceUrl: null,
      mangadexId: null,
      progress: null,
      state: 'planned',
    };
    vi.spyOn(internals, 'parse').mockResolvedValue({
      app: 'mihon',
      entries: [
        { ...entry, title: 'Tower Story' },
        { ...entry, title: 'tower story' },
        { ...entry, title: '' },
      ],
    });
    await expect(internals.read('batch-id', Buffer.from('backup'))).resolves.toBe(true);

    const rows = (createMany.mock.calls[0] as [{ data: Array<Record<string, unknown>> }])[0].data;
    expect(rows.map((row) => row.match)).toEqual([
      undefined,
      ImportMatch.DUPLICATE,
      ImportMatch.UNSUPPORTED,
    ]);
    expect(rows[0]).toMatchObject({ state: LibraryState.PLANNED, position: 0 });
  });

  it('matches an upload once its preview is stored and never after a failed read', async () => {
    const imports = service({
      importBatch: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'unreadable-batch' })
          .mockResolvedValueOnce({ id: 'stored-batch' }),
      },
    });
    const internals = imports as unknown as {
      match(batchId: string): Promise<void>;
      read(batchId: string, file: Buffer): Promise<boolean>;
    };
    vi.spyOn(internals, 'read').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const match = vi.spyOn(internals, 'match').mockResolvedValue(undefined);
    vi.spyOn(imports, 'detail').mockResolvedValue({} as never);

    await imports.create('user-id', Buffer.from('unreadable'));
    await imports.create('user-id', Buffer.from('backup'));

    await vi.waitFor(() => expect(match).toHaveBeenCalledWith('stored-batch'));
    expect(match).toHaveBeenCalledTimes(1);
  });

  it('does not touch the library while suggestions are undecided', async () => {
    const updateMany = vi.fn();
    const imports = service({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'batch-id', state: ImportState.READY }),
        updateMany,
      },
      importCandidate: { count: vi.fn().mockResolvedValue(2) },
    });

    await expect(
      imports.apply('user-id', 'batch-id', ImportConflictPolicy.ADD_MISSING),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('starts applying a batch only once when two requests race', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const imports = service({
      importBatch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'batch-id', state: ImportState.READY }),
        updateMany,
      },
      importCandidate: { count: vi.fn().mockResolvedValue(0) },
    });
    const applyAccepted = vi.spyOn(
      imports as unknown as { applyAccepted(): Promise<void> },
      'applyAccepted',
    );

    await expect(
      imports.apply('user-id', 'batch-id', ImportConflictPolicy.ADD_MISSING),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'batch-id', state: ImportState.READY },
      data: { state: ImportState.APPLYING, conflictPolicy: ImportConflictPolicy.ADD_MISSING },
    });
    expect(applyAccepted).not.toHaveBeenCalled();
  });

  describe('applying a confirmed entry', () => {
    const option = { score: 1, item: candidate({ externalId: 'uuid' }) };
    const imported = {
      id: 'candidate-id',
      kind: 'manga',
      progress: new Prisma.Decimal(40),
      state: LibraryState.IN_PROGRESS,
      sourceName: 'Other reader',
      sourceUrl: '/manga/9',
      mangadexId: null,
    };

    function applyWith(existing: object | null, policy: ImportConflictPolicy, overrides = {}) {
      const transaction = {
        libraryEntry: {
          findUnique: vi.fn().mockResolvedValue(existing),
          create: vi.fn(),
          update: vi.fn(),
        },
        importedSourceReference: { upsert: vi.fn() },
      };
      const internals = service({}) as unknown as {
        applyCandidate(transaction: object, input: object): Promise<string>;
      };
      return {
        transaction,
        outcome: internals.applyCandidate(transaction, {
          batchId: 'batch-id',
          candidate: { ...imported, ...overrides },
          catalogItemId: 'item-id',
          option,
          policy,
          sourceId: 'mangadex-source',
          userId: 'user-id',
        }),
      };
    }

    it('adds a missing title with its progress and an inactive source reference', async () => {
      const { outcome, transaction } = applyWith(null, ImportConflictPolicy.ADD_MISSING);

      await expect(outcome).resolves.toBe('added');
      expect(transaction.libraryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          state: LibraryState.IN_PROGRESS,
          progressChapter: 40,
          progressEpisode: null,
          preferredSourceId: null,
          importedSources: {
            create: { batchId: 'batch-id', sourceName: 'Other reader', sourceUrl: '/manga/9' },
          },
        }),
      });
    });

    it('keeps MangaDex as the title preference without an inactive reference', async () => {
      const { outcome, transaction } = applyWith(null, ImportConflictPolicy.ADD_MISSING, {
        sourceName: 'MangaDex',
      });

      await expect(outcome).resolves.toBe('added');
      expect(transaction.libraryEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          preferredSourceId: 'mangadex-source',
          importedSources: undefined,
        }),
      });
    });

    it('keeps an existing entry when only missing titles are added', async () => {
      const { outcome, transaction } = applyWith(
        { id: 'entry-id', state: LibraryState.PLANNED, progressChapter: null },
        ImportConflictPolicy.ADD_MISSING,
      );

      await expect(outcome).resolves.toBe('kept');
      expect(transaction.libraryEntry.create).not.toHaveBeenCalled();
      expect(transaction.libraryEntry.update).not.toHaveBeenCalled();
    });

    it('raises lower local progress when asked to keep the greater progress', async () => {
      const { outcome, transaction } = applyWith(
        { id: 'entry-id', state: LibraryState.PLANNED, progressChapter: new Prisma.Decimal(12) },
        ImportConflictPolicy.KEEP_GREATER_PROGRESS,
      );

      await expect(outcome).resolves.toBe('updated');
      expect(transaction.libraryEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-id' },
        data: expect.objectContaining({
          progressChapter: 40,
          state: LibraryState.IN_PROGRESS,
        }),
      });
    });

    it.each([
      ['a completed entry', { state: LibraryState.COMPLETED, progressChapter: new Prisma.Decimal(12) }],
      ['newer local progress', { state: LibraryState.IN_PROGRESS, progressChapter: new Prisma.Decimal(80) }],
    ])('never overwrites %s', async (_label, existing) => {
      const { outcome, transaction } = applyWith(
        { id: 'entry-id', ...existing },
        ImportConflictPolicy.KEEP_GREATER_PROGRESS,
      );

      await expect(outcome).resolves.toBe('kept');
      expect(transaction.libraryEntry.update).not.toHaveBeenCalled();
    });
  });
});

describe('Import decisions', () => {
  it('lets the suggested title be left out but never sent as null', async () => {
    const errors = async (value: object) =>
      (await validate(plainToInstance(DecideCandidateDto, value))).map(({ property }) => property);

    await expect(errors({ decision: 'accept' })).resolves.toEqual([]);
    await expect(errors({ decision: 'accept', choice: 1 })).resolves.toEqual([]);
    await expect(errors({ decision: 'accept', choice: null })).resolves.toEqual(['choice']);
  });
});
