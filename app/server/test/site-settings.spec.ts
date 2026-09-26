import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SiteSettingsService } from '../src/site/site-settings.service';
import { UsersService } from '../src/users/users.service';

const connectors = {
  list: (category: string) =>
    [
      { key: 'anilist', categories: ['anime'], enabled: true },
      { key: 'tmdb', categories: ['movie', 'tv', 'anime'], enabled: true },
      { key: 'igdb', categories: ['game'], enabled: false },
      { key: 'rawg', categories: ['game'], enabled: true },
    ].filter((source) => source.categories.includes(category)),
};

function siteWith(
  stored: { adultContentEnabled: boolean } | null,
  defaults: Array<{ category: string; source: { key: string } }> = [],
) {
  const prisma = {
    siteSettings: {
      findUnique: vi.fn().mockResolvedValue(stored),
      upsert: vi.fn(({ update }: { update: object }) => Promise.resolve(update)),
    },
    siteSourceDefault: {
      findMany: vi.fn().mockResolvedValue(defaults),
      upsert: vi.fn().mockResolvedValue({}),
    },
    sourceRecord: {
      findUniqueOrThrow: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve({ id: `${where.key}-id` }),
      ),
    },
  };
  return { prisma, site: new SiteSettingsService(prisma as never, connectors as never) };
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

  it('uses the chosen default source and falls back to the first enabled one', async () => {
    const { site } = siteWith({ adultContentEnabled: true }, [
      { category: 'ANIME', source: { key: 'tmdb' } },
      { category: 'GAME', source: { key: 'igdb' } },
    ]);

    await expect(site.get()).resolves.toEqual({
      adultContentEnabled: true,
      defaultSources: { movie: 'tmdb', tv: 'tmdb', anime: 'tmdb', game: 'rawg' },
    });
  });

  it('lets the system manager choose an enabled default source straight away', async () => {
    const { prisma, site } = siteWith({ adultContentEnabled: true });

    await expect(site.defaultSource('anime')).resolves.toBe('anilist');
    await expect(site.setDefaultSource('anime', 'tmdb')).resolves.toMatchObject({
      defaultSources: { anime: 'tmdb' },
    });
    expect(prisma.siteSourceDefault.upsert).toHaveBeenCalledWith({
      where: { category: 'ANIME' },
      update: { sourceId: 'tmdb-id' },
      create: { category: 'ANIME', sourceId: 'tmdb-id' },
    });
    await expect(site.defaultSource('anime')).resolves.toBe('tmdb');
    expect(prisma.siteSourceDefault.findMany).toHaveBeenCalledTimes(1);

    for (const [category, key] of [
      ['game', 'igdb'],
      ['anime', 'rawg'],
    ] as const) {
      await expect(site.setDefaultSource(category, key)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
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
