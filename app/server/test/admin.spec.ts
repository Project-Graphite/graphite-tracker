import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportResolution, ReviewVisibility, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard, SystemManagerGuard } from '../src/admin/admin.guard';
import { AdminService } from '../src/admin/admin.service';
import { grantSystemManager } from '../src/admin/grant-system-manager';

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

  it('admits only the system manager to role and site changes', () => {
    const guard = new SystemManagerGuard();

    expect(
      guard.canActivate(contextFor({ id: 'manager', isAdmin: true, isSystemManager: true })),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor({ id: 'admin', isAdmin: true, isSystemManager: false })),
    ).toThrow(ForbiddenException);
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

  it('lists public and private reviews that still have text, with their reports', async () => {
    const reportCount = vi.fn();
    const reportFindMany = vi.fn();
    const reviewCount = vi.fn();
    const reviewFindMany = vi.fn();
    const service = new AdminService({
      reviewReport: { count: reportCount, findMany: reportFindMany },
      review: { count: reviewCount, findMany: reviewFindMany },
      $transaction: () => Promise.resolve([0, []]),
    } as never);

    await service.reports('open', 1);
    await service.reviews('public', 1);
    await service.reviews('private', 1);
    await service.reviews('hidden', 1);

    const reportWhere = { resolution: null, review: { body: { not: null } } };
    expect(reportCount).toHaveBeenCalledWith({ where: reportWhere });
    expect(reportFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: reportWhere }));
    expect(reviewCount.mock.calls.map(([args]) => (args as { where: object }).where)).toEqual([
      { body: { not: null }, hiddenAt: null, visibility: ReviewVisibility.PUBLIC },
      { body: { not: null }, hiddenAt: null, visibility: ReviewVisibility.PRIVATE },
      { body: { not: null }, hiddenAt: { not: null } },
    ]);
    expect(reviewFindMany).toHaveBeenCalledTimes(3);
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

    await serviceWith({ id: 'reader', role: UserRole.MEMBER }).setUserActive('admin', 'reader', false);
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'reader' }, data: { isActive: false } });
    expect(sessionRevoke).toHaveBeenCalledWith({
      where: { userId: 'reader', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    await expect(
      serviceWith({ id: 'admin', role: UserRole.ADMIN }).setUserActive('admin', 'admin', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      serviceWith({ id: 'other-admin', role: UserRole.ADMIN }).setUserActive('admin', 'other-admin', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      serviceWith({ id: 'manager', role: UserRole.SYSTEM_MANAGER }).setUserActive('admin', 'manager', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('appointing administrators', () => {
    const serviceWith = (user: object | null) => {
      const update = vi.fn();
      return {
        update,
        service: new AdminService({
          user: { findUnique: vi.fn().mockResolvedValue(user), update },
        } as never),
      };
    };
    const reader = { id: 'reader', role: UserRole.MEMBER, verifiedAt: new Date(), isActive: true };

    it('appoints and removes administrators', async () => {
      const appoint = serviceWith(reader);
      await appoint.service.setUserRole('manager', 'reader', 'admin');
      expect(appoint.update).toHaveBeenCalledWith({
        where: { id: 'reader' },
        data: { role: UserRole.ADMIN },
      });

      const remove = serviceWith({ ...reader, role: UserRole.ADMIN });
      await remove.service.setUserRole('manager', 'reader', 'member');
      expect(remove.update).toHaveBeenCalledWith({
        where: { id: 'reader' },
        data: { role: UserRole.MEMBER },
      });
    });

    it.each([
      ['the target is the system manager', { ...reader, role: UserRole.SYSTEM_MANAGER }, 'admin', ForbiddenException],
      ['the target is the acting manager', { ...reader, id: 'manager' }, 'member', ForbiddenException],
      ['the account is unverified', { ...reader, verifiedAt: null }, 'admin', BadRequestException],
      ['the account is deactivated', { ...reader, isActive: false }, 'admin', BadRequestException],
      ['no account matches', null, 'admin', NotFoundException],
    ] as const)('refuses when %s', async (_label, user, role, error) => {
      const { service, update } = serviceWith(user);
      await expect(service.setUserRole('manager', user?.id ?? 'reader', role)).rejects.toBeInstanceOf(error);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('granting the system manager', () => {
    function prismaWith(user: object | null, current: object | null = null) {
      const transaction = {
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          findFirst: vi.fn().mockResolvedValue(current),
          update: vi.fn(),
        },
        refreshSession: { updateMany: vi.fn() },
      };
      return {
        transaction,
        prisma: {
          $transaction: vi.fn((run: (client: typeof transaction) => unknown) => run(transaction)),
        },
      };
    }
    const reader = {
      id: 'user-id',
      handle: 'reader',
      role: UserRole.ADMIN,
      verifiedAt: new Date(),
      isActive: true,
    };

    it('promotes one verified, active account and signs it out everywhere', async () => {
      const { prisma, transaction } = prismaWith(reader);

      await expect(grantSystemManager(prisma as never, ' Reader@Example.com ', false)).resolves.toBe(
        'reader is now the system manager',
      );
      expect(transaction.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'reader@example.com' },
      });
      expect(transaction.user.update).toHaveBeenCalledTimes(1);
      expect(transaction.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { role: UserRole.SYSTEM_MANAGER },
      });
      expect(transaction.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('hands the role over only when asked to, demoting the previous manager', async () => {
      const current = { id: 'manager-id', handle: 'manager' };

      const refused = prismaWith(reader, current);
      await expect(grantSystemManager(refused.prisma as never, 'reader@example.com', false)).rejects.toThrow(
        'add --transfer',
      );
      expect(refused.transaction.user.update).not.toHaveBeenCalled();

      const transferred = prismaWith(reader, current);
      await expect(grantSystemManager(transferred.prisma as never, 'reader@example.com', true)).resolves.toBe(
        'reader is now the system manager; manager is now a member',
      );
      expect(transferred.transaction.user.update.mock.calls).toEqual([
        [{ where: { id: 'manager-id' }, data: { role: UserRole.MEMBER } }],
        [{ where: { id: 'user-id' }, data: { role: UserRole.SYSTEM_MANAGER } }],
      ]);
    });

    it.each([
      ['the account is unverified', prismaWith({ ...reader, verifiedAt: null })],
      ['the account is deactivated', prismaWith({ ...reader, isActive: false })],
      ['the account is already the system manager', prismaWith({ ...reader, role: UserRole.SYSTEM_MANAGER })],
      ['no account matches', prismaWith(null)],
    ])('refuses when %s', async (_label, { prisma, transaction }) => {
      await expect(grantSystemManager(prisma as never, 'reader@example.com', true)).rejects.toThrow();
      expect(transaction.user.update).not.toHaveBeenCalled();
    });
  });
});
