import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from './connector-registry.service';
import { CatalogCategory } from './source.types';

const categories: Record<CatalogCategory, MediaCategory> = {
  movie: MediaCategory.MOVIE,
  tv: MediaCategory.TV,
  anime: MediaCategory.ANIME,
  manga: MediaCategory.MANGA,
  manhwa: MediaCategory.MANHWA,
  game: MediaCategory.GAME,
};

@Injectable()
export class SourceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistryService,
  ) {}

  async list(userId: string) {
    await this.sync();
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
    return {
      sources: records.map((record) => ({
        key: record.key,
        displayName: record.displayName,
        categories: record.categories.map((category) => category.toLowerCase()),
        languages: record.languages,
        capabilities: record.capabilities,
        attribution: record.attribution,
        enabled: record.enabled && (record.userSettings[0]?.enabled ?? true),
      })),
      global: global?.source.key ?? null,
      categories: Object.fromEntries(
        categoryPreferences.map((preference) => [
          preference.category.toLowerCase(),
          preference.source.key,
        ]),
      ),
    };
  }

  async setEnabled(userId: string, key: string, enabled: boolean) {
    const source = await this.source(key);
    await this.prisma.userSourceSetting.upsert({
      where: { userId_sourceId: { userId, sourceId: source.id } },
      update: { enabled },
      create: { userId, sourceId: source.id, enabled },
    });
    return this.list(userId);
  }

  async setGlobal(userId: string, key: string) {
    const source = await this.source(key);
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
    const source = await this.source(key);
    if (!source.categories.includes(categories[category])) {
      throw new NotFoundException('Source does not support this category');
    }
    await this.prisma.categorySourcePreference.upsert({
      where: { userId_category: { userId, category: categories[category] } },
      update: { sourceId: source.id },
      create: { userId, category: categories[category], sourceId: source.id },
    });
    return this.list(userId);
  }

  async clearCategory(userId: string, category: CatalogCategory) {
    this.assertCategory(category);
    await this.prisma.categorySourcePreference.deleteMany({
      where: { userId, category: categories[category] },
    });
    return this.list(userId);
  }

  private async source(key: string) {
    await this.sync();
    const source = await this.prisma.sourceRecord.findUnique({ where: { key } });
    if (!source?.enabled) {
      throw new NotFoundException('Source is not available');
    }
    return source;
  }

  private async sync() {
    await Promise.all(
      this.registry.list().map((descriptor) =>
        this.prisma.sourceRecord.upsert({
          where: { key: descriptor.key },
          update: {
            displayName: descriptor.displayName,
            categories: descriptor.categories.map((category) => categories[category]),
            languages: descriptor.languages,
            capabilities: descriptor.capabilities,
            attribution: descriptor.attribution,
            enabled: descriptor.enabled,
          },
          create: {
            key: descriptor.key,
            displayName: descriptor.displayName,
            categories: descriptor.categories.map((category) => categories[category]),
            languages: descriptor.languages,
            capabilities: descriptor.capabilities,
            attribution: descriptor.attribution,
            enabled: descriptor.enabled,
          },
        }),
      ),
    );
  }

  private assertCategory(category: CatalogCategory) {
    if (!categories[category]) {
      throw new BadRequestException('Unsupported media category');
    }
  }
}
