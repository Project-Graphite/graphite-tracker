import { describe, expect, it, vi } from 'vitest';
import { LibraryService } from '../src/library/library.service';

describe('LibraryService', () => {
  it('looks up the current user entry by TMDB external ID', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new LibraryService(
      { libraryEntry: { findFirst } } as never,
      {} as never,
    );

    await expect(service.findByTmdbId('user-id', '550')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        catalogItem: {
          sourceEntries: {
            some: {
              externalId: '550',
              source: { key: 'tmdb' },
            },
          },
        },
      },
      include: expect.any(Object),
    });
  });
});
