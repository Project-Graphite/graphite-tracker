import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const cacheMs = 30_000;
const settingsSelect = { adultContentEnabled: true } as const;

export interface SiteSettings {
  adultContentEnabled: boolean;
}

@Injectable()
export class SiteSettingsService {
  private cached?: { settings: SiteSettings; expiresAt: number };

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.settings;
    }
    return this.remember(
      (await this.prisma.siteSettings.findUnique({ where: { id: 1 }, select: settingsSelect })) ?? {
        adultContentEnabled: true,
      },
    );
  }

  async update(settings: SiteSettings) {
    return this.remember(
      await this.prisma.siteSettings.upsert({
        where: { id: 1 },
        update: settings,
        create: settings,
        select: settingsSelect,
      }),
    );
  }

  async adultContent(preference: boolean) {
    return preference && (await this.get()).adultContentEnabled;
  }

  private remember(settings: SiteSettings) {
    this.cached = { settings, expiresAt: Date.now() + cacheMs };
    return settings;
  }
}
