import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { MediaCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from './connector-registry.service';
import { CatalogCategory, ConnectorDescriptor } from './source.types';

export const mediaCategories: Record<CatalogCategory, MediaCategory> = {
  movie: MediaCategory.MOVIE,
  tv: MediaCategory.TV,
  anime: MediaCategory.ANIME,
  manga: MediaCategory.MANGA,
  manhwa: MediaCategory.MANHWA,
  game: MediaCategory.GAME,
};

export function sourceRecordData(descriptor: ConnectorDescriptor) {
  return {
    displayName: descriptor.displayName,
    categories: descriptor.categories.map((category) => mediaCategories[category]),
    languages: descriptor.languages,
    capabilities: descriptor.capabilities,
    attribution: descriptor.attribution,
    enabled: descriptor.enabled,
  };
}

@Injectable()
export class SourceSettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
  ) {}

  onModuleInit() {
    return this.sync();
  }

  async list(userId: string) {
    await this.sync();
    const descriptors = new Map(
      this.registry.list().map((descriptor) => [descriptor.key, descriptor]),
    );
    const [records, global, categoryPreferences] = await Promise.all([
      this.prisma.sourceRecord.findMany({
        include: {
          userSettings: { where: { userId } },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.globalSourcePreference.findUnique({
        where: { userId },
        include: { source: true },
      }),
      this.prisma.categorySourcePreference.findMany({
        where: { userId },
        include: { source: true },
      }),
    ]);
    const enabledSources = new Set(
      records
        .filter(
          (record) => record.enabled && (record.userSettings[0]?.enabled ?? true),
        )
        .map((record) => record.key),
    );
    return {
      sources: records.map((record) => ({
        key: record.key,
        displayName: record.displayName,
        categories: record.categories.map((category) => category.toLowerCase()),
        languages: record.languages,
        capabilities: record.capabilities,
        attribution: record.attribution,
        attributionUrl: descriptors.get(record.key)?.attributionUrl,
        available: record.enabled,
        enabled: enabledSources.has(record.key),
      })),
      global:
        global && enabledSources.has(global.source.key) ? global.source.key : null,
      categories: Object.fromEntries(
        categoryPreferences
          .filter((preference) => enabledSources.has(preference.source.key))
          .map((preference) => [
            preference.category.toLowerCase(),
            preference.source.key,
          ]),
      ),
    };
  }

  async setEnabled(userId: string, key: string, enabled: boolean) {
    const source = await this.availableSource(key);
    await this.prisma.userSourceSetting.upsert({
      where: { userId_sourceId: { userId, sourceId: source.id } },
      update: { enabled },
      create: { userId, sourceId: source.id, enabled },
    });
    return this.list(userId);
  }

  async setGlobal(userId: string, key: string) {
    const source = await this.enabledSource(userId, key);
    await this.prisma.globalSourcePreference.upsert({
      where: { userId },
      update: { sourceId: source.id },
      create: { userId, sourceId: source.id },
    });
    return this.list(userId);
  }

  async clearGlobal(userId: string) {
    await this.prisma.globalSourcePreference.deleteMany({ where: { userId } });
    return this.list(userId);
  }

  async setCategory(userId: string, category: CatalogCategory, key: string) {
    this.assertCategory(category);
    const source = await this.enabledSource(userId, key);
    if (!source.categories.includes(mediaCategories[category])) {
      throw new NotFoundException('Source does not support this category');
    }
    await this.prisma.categorySourcePreference.upsert({
      where: { userId_category: { userId, category: mediaCategories[category] } },
      update: { sourceId: source.id },
      create: { userId, category: mediaCategories[category], sourceId: source.id },
    });
    return this.list(userId);
  }

  async clearCategory(userId: string, category: CatalogCategory) {
    this.assertCategory(category);
    await this.prisma.categorySourcePreference.deleteMany({
      where: { userId, category: mediaCategories[category] },
    });
    return this.list(userId);
  }

  private async availableSource(key: string) {
    await this.sync();
    const source = await this.prisma.sourceRecord.findUnique({ where: { key } });
    if (!source?.enabled) {
      throw new NotFoundException('Source is not available');
    }
    return source;
  }

  private async enabledSource(userId: string, key: string) {
    const source = await this.availableSource(key);
    const setting = await this.prisma.userSourceSetting.findUnique({
      where: { userId_sourceId: { userId, sourceId: source.id } },
    });
    if (setting?.enabled === false) {
      throw new BadRequestException('Enable this source before selecting it');
    }
    return source;
  }

  private async sync() {
    await Promise.all(
      this.registry.list().map((descriptor) =>
        this.prisma.sourceRecord.upsert({
          where: { key: descriptor.key },
          update: sourceRecordData(descriptor),
          create: { key: descriptor.key, ...sourceRecordData(descriptor) },
        }),
      ),
    );
  }

  private assertCategory(category: CatalogCategory) {
    if (!Object.hasOwn(mediaCategories, category)) {
      throw new BadRequestException('Unsupported media category');
    }
  }
}
