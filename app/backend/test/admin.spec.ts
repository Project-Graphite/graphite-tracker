import { ForbiddenException } from '@nestjs/common';
import { ReportResolution } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../src/admin/admin.guard';
import { AdminService } from '../src/admin/admin.service';
import { grantAdmin } from '../src/admin/grant-admin';

const contextFor = (user: object) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;

describe('Administration', () => {
  it('admits only administrators', () => {
    const guard = new AdminGuard();

    expect(guard.canActivate(contextFor({ id: 'admin', isAdmin: true }))).toBe(true);
    expect(() => guard.canActivate(contextFor({ id: 'reader', isAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it('hides a reported review and resolves every open report on it', async () => {
    const reviewUpdate = vi.fn();
    const reportUpdateMany = vi.fn();
    const prisma = {
      reviewReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report-id', reviewId: 'review-id' }),
        updateMany: reportUpdateMany,
        update: vi.fn(),
      },
      review: { findUnique: vi.fn().mockResolvedValue({ id: 'review-id' }), update: reviewUpdate },
      $transaction: vi.fn(),
    };

    await new AdminService(prisma as never).resolveReport(
      'admin-id',
      'report-id',
      ReportResolution.HIDDEN,
    );

    expect(reviewUpdate).toHaveBeenCalledWith({
      where: { id: 'review-id' },
      data: { hiddenAt: expect.any(Date) },
    });
    expect(reportUpdateMany).toHaveBeenCalledWith({
      where: { reviewId: 'review-id', resolution: null },
      data: {
        resolution: ReportResolution.HIDDEN,
        moderatorId: 'admin-id',
        resolvedAt: expect.any(Date),
      },
    });
    expect(prisma.reviewReport.update).not.toHaveBeenCalled();
  });

  it('dismisses a report without touching the review', async () => {
    const prisma = {
      reviewReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report-id', reviewId: 'review-id' }),
        update: vi.fn(),
      },
      review: { update: vi.fn() },
    };

    await new AdminService(prisma as never).resolveReport(
      'admin-id',
      'report-id',
      ReportResolution.DISMISSED,
    );

    expect(prisma.reviewReport.update).toHaveBeenCalledWith({
      where: { id: 'report-id' },
      data: { resolution: ReportResolution.DISMISSED, moderatorId: 'admin-id', resolvedAt: expect.any(Date) },
    });
    expect(prisma.review.update).not.toHaveBeenCalled();
  });

  it('deactivates a reader and revokes their sessions but never an administrator', async () => {
    const userUpdate = vi.fn();
    const sessionRevoke = vi.fn();
    const serviceWith = (user: object) =>
      new AdminService({
        user: { findUnique: vi.fn().mockResolvedValue(user), update: userUpdate },
        refreshSession: { updateMany: sessionRevoke },
        $transaction: vi.fn(),
      } as never);

    await serviceWith({ id: 'reader', isAdmin: false }).setUserActive('admin', 'reader', false);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'reader' }, data: { isActive: false } });
    expect(sessionRevoke).toHaveBeenCalledWith({
      where: { userId: 'reader', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    await expect(
      serviceWith({ id: 'admin', isAdmin: true }).setUserActive('admin', 'admin', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      serviceWith({ id: 'other-admin', isAdmin: true }).setUserActive('admin', 'other-admin', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('granting the administrator', () => {
    function prismaWith(existingAdmin: object | null, user: object | null) {
      return {
        user: {
          findFirst: vi.fn().mockResolvedValue(existingAdmin),
          findUnique: vi.fn().mockResolvedValue(user),
          update: vi.fn(),
        },
      };
    }

    it('promotes one verified, active account', async () => {
      const prisma = prismaWith(null, {
        id: 'user-id',
        handle: 'reader',
        verifiedAt: new Date(),
        isActive: true,
      });

      await expect(grantAdmin(prisma as never, ' Reader@Example.com ')).resolves.toBe(
        'reader is now the administrator',
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'reader@example.com' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { isAdmin: true },
      });
    });

    it.each([
      ['an administrator already exists', prismaWith({ id: 'admin' }, null)],
      ['the account is unverified', prismaWith(null, { id: 'u', verifiedAt: null, isActive: true })],
      ['no account matches', prismaWith(null, null)],
    ])('refuses when %s', async (_label, prisma) => {
      await expect(grantAdmin(prisma as never, 'reader@example.com')).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
