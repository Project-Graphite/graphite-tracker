import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { mediaCategories } from '../sources/source-settings.service';
import { CatalogCategory, catalogCategories } from '../sources/source.types';

const cacheMs = 30_000;
const settingsSelect = { adultContentEnabled: true } as const;

type SourceChoices = Partial<Record<CatalogCategory, string>>;

interface StoredSettings {
  adultContentEnabled: boolean;
  chosenSources: SourceChoices;
}

export interface SiteSettings {
  adultContentEnabled: boolean;
  defaultSources: SourceChoices;
}

@Injectable()
export class SiteSettingsService {
  private cached?: { settings: StoredSettings; expiresAt: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorRegistryService,
  ) {}

  async get(): Promise<SiteSettings> {
    return this.view(await this.stored());
  }

  async update(settings: { adultContentEnabled: boolean }) {
    const { chosenSources } = await this.stored();
    const saved = await this.prisma.siteSettings.upsert({
      where: { id: 1 },
      update: settings,
      create: settings,
      select: settingsSelect,
    });
    return this.view(this.remember({ ...saved, chosenSources }));
  }

  async setDefaultSource(category: CatalogCategory, key: string) {
    if (!this.connectors.list(category).some((source) => source.key === key && source.enabled)) {
      throw new BadRequestException('This source is not available for this category');
    }
    const stored = await this.stored();
    const source = await this.prisma.sourceRecord.findUniqueOrThrow({ where: { key } });
    await this.prisma.siteSourceDefault.upsert({
      where: { category: mediaCategories[category] },
      update: { sourceId: source.id },
      create: { category: mediaCategories[category], sourceId: source.id },
    });
    return this.view(
      this.remember({ ...stored, chosenSources: { ...stored.chosenSources, [category]: key } }),
    );
  }

  async defaultSource(category: CatalogCategory) {
    return (await this.get()).defaultSources[category];
  }

  async adultContent(preference: boolean) {
    return preference && (await this.get()).adultContentEnabled;
  }

  private async stored() {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.settings;
    }
    const [settings, defaults] = await Promise.all([
      this.prisma.siteSettings.findUnique({ where: { id: 1 }, select: settingsSelect }),
      this.prisma.siteSourceDefault.findMany({
        select: { category: true, source: { select: { key: true } } },
      }),
    ]);
    return this.remember({
      adultContentEnabled: settings?.adultContentEnabled ?? true,
      chosenSources: Object.fromEntries(
        defaults.map(({ category, source }) => [category.toLowerCase(), source.key]),
      ),
    });
  }

  private view({ adultContentEnabled, chosenSources }: StoredSettings): SiteSettings {
    return {
      adultContentEnabled,
      defaultSources: Object.fromEntries(
        catalogCategories.flatMap((category) => {
          const enabled = this.connectors.list(category).filter((source) => source.enabled);
          const source = enabled.find(({ key }) => key === chosenSources[category]) ?? enabled[0];
          return source ? [[category, source.key]] : [];
        }),
      ),
    };
  }

  private remember(settings: StoredSettings) {
    this.cached = { settings, expiresAt: Date.now() + cacheMs };
    return settings;
  }
}
