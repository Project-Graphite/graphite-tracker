import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ActivityKind, LibraryState, Prisma, ReportReason, ReviewVisibility } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { SaveReviewDto } from '../src/reviews/dto/review.dto';
import { ReviewsService } from '../src/reviews/reviews.service';

const itemId = '00000000-0000-4000-8000-000000000001';

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-id',
    userId: 'user-id',
    catalogItemId: itemId,
    rating: null,
    title: null,
    body: null,
    containsSpoilers: false,
    visibility: ReviewVisibility.PRIVATE,
    hiddenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function serviceFor(state: LibraryState | null, existing: object | null = null) {
  const activity = { createMany: vi.fn(), deleteMany: vi.fn() };
  const upsert = vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
    Promise.resolve(review(create)),
  );
  const prisma = {
    catalogItem: { findUnique: vi.fn().mockResolvedValue({ id: itemId }) },
    libraryEntry: { findUnique: vi.fn().mockResolvedValue(state && { state }) },
    review: { findUnique: vi.fn().mockResolvedValue(existing) },
    $transaction: (run: (transaction: object) => Promise<unknown>) =>
      run({ review: { upsert }, activityEvent: activity }),
  };
  return { activity, service: new ReviewsService(prisma as never), upsert };
}

const input = (overrides: Partial<SaveReviewDto> = {}) =>
  ({ rating: 8, title: null, body: null, containsSpoilers: false, visibility: 'public', ...overrides }) as SaveReviewDto;

describe('ReviewsService', () => {
  it.each([LibraryState.PLANNED, LibraryState.IN_PROGRESS, null])(
    'refuses a first rating while the title is %s',
    async (state) => {
      const { service, upsert } = serviceFor(state);

      await expect(service.save('user-id', itemId, input())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it.each([LibraryState.COMPLETED, LibraryState.DROPPED])(
    'lets the owner rate and review a %s title',
    async (state) => {
      const { activity, service } = serviceFor(state);

      const saved = await service.save(
        'user-id',
        itemId,
        input({ body: 'Worth it.', visibility: 'public' }),
      );

      expect(saved).toMatchObject({ rating: 8, body: 'Worth it.', visibility: 'public' });
      expect(activity.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-id', catalogItemId: itemId, reviewId: 'review-id', kind: ActivityKind.RATED },
          { userId: 'user-id', catalogItemId: itemId, reviewId: 'review-id', kind: ActivityKind.REVIEWED },
        ],
      });
    },
  );

  it('keeps an existing review editable after the title moves back in progress', async () => {
    const { activity, service } = serviceFor(
      LibraryState.IN_PROGRESS,
      review({ rating: 8, body: 'Worth it.' }),
    );

    await expect(
      service.save('user-id', itemId, input({ body: 'Worth it, on reflection.' })),
    ).resolves.toMatchObject({ body: 'Worth it, on reflection.' });
    expect(activity.createMany).not.toHaveBeenCalled();
  });

  it('drops the rating activity when a rating is cleared', async () => {
    const { activity, service } = serviceFor(
      LibraryState.COMPLETED,
      review({ rating: 8, body: 'Worth it.' }),
    );

    await service.save('user-id', itemId, input({ rating: null, body: 'Worth it.' }));

    expect(activity.deleteMany).toHaveBeenCalledWith({
      where: { reviewId: 'review-id', kind: ActivityKind.RATED },
    });
    expect(activity.createMany).not.toHaveBeenCalled();
  });

  it('drops the review activity when the review text is removed', async () => {
    const { activity, service } = serviceFor(
      LibraryState.COMPLETED,
      review({ rating: 8, body: 'Worth it.' }),
    );

    await service.save('user-id', itemId, input({ rating: 8, body: null }));

    expect(activity.deleteMany).toHaveBeenCalledTimes(1);
    expect(activity.deleteMany).toHaveBeenCalledWith({
      where: { reviewId: 'review-id', kind: ActivityKind.REVIEWED },
    });
    expect(activity.createMany).not.toHaveBeenCalled();
  });

  it('stores review text exactly as written and never as markup', async () => {
    const body = '<script>alert(1)</script><img src=x onerror=alert(2)> & "quotes"';
    const { service } = serviceFor(LibraryState.COMPLETED);

    await expect(service.save('user-id', itemId, input({ body }))).resolves.toMatchObject({ body });
  });

  it.each([
    ['neither a rating nor a review', input({ rating: null })],
    ['a title without a review', input({ title: 'Headline' })],
  ])('rejects %s', async (_label, value) => {
    const { service } = serviceFor(LibraryState.COMPLETED);

    await expect(service.save('user-id', itemId, value)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('limits reviews to whole ratings from 1 to 10 and 10,000 characters', async () => {
    const errors = async (value: object) =>
      (await validate(plainToInstance(SaveReviewDto, { visibility: 'public', ...value }))).map(
        ({ property }) => property,
      );

    await expect(errors({ rating: 10, body: 'x'.repeat(10_000) })).resolves.toEqual([]);
    await expect(errors({ body: 'x'.repeat(10_001) })).resolves.toEqual(['body']);
    await expect(errors({ rating: 0 })).resolves.toEqual(['rating']);
    await expect(errors({ rating: 11 })).resolves.toEqual(['rating']);
    await expect(errors({ rating: 7.5 })).resolves.toEqual(['rating']);
    await expect(errors({ rating: 5, visibility: 'friends' })).resolves.toEqual(['visibility']);
  });

  it('keeps a hidden review hidden when its author rewrites it', async () => {
    const { service, upsert } = serviceFor(
      LibraryState.COMPLETED,
      review({ body: 'Abusive text.', visibility: ReviewVisibility.PUBLIC, hiddenAt: new Date() }),
    );

    await service.save('user-id', itemId, input({ body: 'Rewritten text.' }));

    expect(upsert.mock.calls[0]?.[0].update).not.toHaveProperty('hiddenAt');
  });

  describe('removing', () => {
    function removeService(deleted: number, remaining: number) {
      const deleteMany = vi.fn().mockResolvedValue({ count: deleted });
      const service = new ReviewsService({
        review: { count: vi.fn().mockResolvedValue(remaining), deleteMany },
      } as never);
      return { deleteMany, service };
    }

    it('deletes only a review a moderator has not hidden', async () => {
      const { deleteMany, service } = removeService(1, 0);

      await expect(service.remove('user-id', itemId)).resolves.toBeUndefined();
      expect(deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', catalogItemId: itemId, hiddenAt: null },
      });
    });

    it('keeps a hidden review and its reports so it cannot be deleted and written again', async () => {
      await expect(removeService(0, 1).service.remove('user-id', itemId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('reports a missing review', async () => {
      await expect(removeService(0, 0).service.remove('user-id', itemId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reports', () => {
    function reportService(found: object | null, create = vi.fn()) {
      return new ReviewsService({
        review: { findFirst: vi.fn().mockResolvedValue(found) },
        reviewReport: { create },
      } as never);
    }

    it('accepts one report per reader for a public review', async () => {
      const create = vi.fn();
      await expect(
        reportService({ userId: 'author' }, create).report('reader', 'review-id', ReportReason.SPOILERS),
      ).resolves.toEqual({ reported: true });
      expect(create).toHaveBeenCalledWith({
        data: { reviewId: 'review-id', reporterId: 'reader', reason: ReportReason.SPOILERS },
      });
    });

    it('does not let authors report themselves or find private and hidden reviews', async () => {
      await expect(
        reportService({ userId: 'author' }).report('author', 'review-id', ReportReason.SPAM),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        reportService(null).report('reader', 'review-id', ReportReason.SPAM),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a second report from the same reader', async () => {
      const create = vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(
        reportService({ userId: 'author' }, create).report('reader', 'review-id', ReportReason.ABUSE),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('lists only visible public reviews and averages ratings from active, unhidden reviews', async () => {
    const aggregate = vi.fn();
    const findMany = vi.fn();
    const service = new ReviewsService({
      catalogItem: { findFirst: vi.fn().mockResolvedValue({ id: itemId }) },
      review: { aggregate, count: vi.fn(), findMany },
      $transaction: () =>
        Promise.resolve([{ _avg: { rating: 7.66 }, _count: { rating: 3 } }, 0, []]),
    } as never);

    await expect(service.forSource('tmdb', '550', 1)).resolves.toMatchObject({
      itemId,
      rating: { average: 7.7, count: 3 },
    });
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { catalogItemId: itemId, rating: { not: null }, hiddenAt: null, user: { isActive: true } },
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          catalogItemId: itemId,
          visibility: ReviewVisibility.PUBLIC,
          hiddenAt: null,
          body: { not: null },
          user: { isActive: true },
        },
      }),
    );
  });

  it('adds private reviews only for their author and the administrator', async () => {
    const findMany = vi.fn();
    const service = new ReviewsService({
      catalogItem: { findFirst: vi.fn().mockResolvedValue({ id: itemId }) },
      review: { aggregate: vi.fn(), count: vi.fn(), findMany },
      $transaction: () => Promise.resolve([{ _avg: { rating: null }, _count: { rating: 0 } }, 0, []]),
    } as never);
    const listed = { catalogItemId: itemId, hiddenAt: null, body: { not: null }, user: { isActive: true } };

    await service.forSource('tmdb', '550', 1, { id: 'reader-id', isAdmin: false });
    await service.forSource('tmdb', '550', 1, { id: 'admin-id', isAdmin: true });

    expect(findMany.mock.calls.map(([args]) => (args as { where: object }).where)).toEqual([
      { ...listed, OR: [{ visibility: ReviewVisibility.PUBLIC }, { userId: 'reader-id' }] },
      listed,
    ]);
  });
});
