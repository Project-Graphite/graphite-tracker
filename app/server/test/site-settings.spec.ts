import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SiteSettingsService } from '../src/site/site-settings.service';
import { UsersService } from '../src/users/users.service';

function siteWith(stored: { adultContentEnabled: boolean } | null) {
  const prisma = {
    siteSettings: {
      findUnique: vi.fn().mockResolvedValue(stored),
      upsert: vi.fn(({ update }: { update: object }) => Promise.resolve(update)),
    },
  };
  return { prisma, site: new SiteSettingsService(prisma as never) };
}

describe('Site settings', () => {
  it('allows adult content until the system manager turns it off', async () => {
    const { site } = siteWith(null);

    await expect(site.adultContent(true)).resolves.toBe(true);
    await expect(site.adultContent(false)).resolves.toBe(false);
  });

  it('overrides every reader preference while adult content is off', async () => {
    const { site } = siteWith({ adultContentEnabled: false });

    await expect(site.adultContent(true)).resolves.toBe(false);
  });

  it('reads the stored settings once and applies an update straight away', async () => {
    const { prisma, site } = siteWith({ adultContentEnabled: true });

    await site.get();
    await site.get();
    expect(prisma.siteSettings.findUnique).toHaveBeenCalledTimes(1);

    await site.update({ adultContentEnabled: false });
    await expect(site.adultContent(true)).resolves.toBe(false);
    expect(prisma.siteSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it('refuses to turn a reader preference on while the site has it off', async () => {
    const { site } = siteWith({ adultContentEnabled: false });
    const update = vi.fn();
    const users = new UsersService({ user: { update } } as never, site);

    await expect(users.updateProfile('user-id', { showAdultContent: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(update).not.toHaveBeenCalled();
  });
});
