import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectorCacheService } from './connector-cache.service';
import { IgdbService } from './igdb/igdb.service';
import { MangaDexService } from './mangadex/mangadex.service';
import { RawgService } from './rawg/rawg.service';
import {
  CatalogCategory,
  CatalogFilters,
  CatalogSection,
  SourceConnector,
} from './source.types';
import { TmdbService } from './tmdb/tmdb.service';

@Injectable()
export class ConnectorRegistryService {
  private readonly connectors: SourceConnector[];
  private readonly lastRequest = new Map<string, number>();
  private readonly requestQueues = new Map<string, Promise<void>>();

  constructor(
    config: ConfigService,
    tmdb: TmdbService,
    mangadex: MangaDexService,
    igdb: IgdbService,
    rawg: RawgService,
    private readonly cache: ConnectorCacheService,
  ) {
    const gameSource = (config.get<string>('GAME_SOURCE') ?? 'igdb')
      .trim()
      .toLowerCase();
    if (gameSource !== 'igdb' && gameSource !== 'rawg') {
      throw new Error('GAME_SOURCE must be either igdb or rawg');
    }
    igdb.descriptor.enabled =
      gameSource === 'igdb' && igdb.descriptor.enabled;
    rawg.descriptor.enabled =
      gameSource === 'rawg' && rawg.descriptor.enabled;
    this.connectors = [tmdb, mangadex, igdb, rawg];
  }

  list(category?: CatalogCategory) {
    return this.connectors
      .map((connector) => connector.descriptor)
      .filter((descriptor) => !category || descriptor.categories.includes(category));
  }

  async search(
    category: CatalogCategory,
    query: string,
    page: number,
    filters: CatalogFilters,
    source?: string,
  ) {
    const connector = this.resolve(category, source);
    const result = await this.cached(
      connector,
      ['search', category, query, page, filters],
      300,
      86_400,
      () => connector.search(category, query, page, filters),
    );
    return { ...result.value, stale: result.stale };
  }

  async browse(
    category: CatalogCategory,
    section: CatalogSection,
    page: number,
    filters: CatalogFilters,
    source?: string,
  ) {
    const connector = this.resolve(category, source);
    const result = await this.cached(
      connector,
      ['browse', category, section, page, filters],
      section === 'popular' ? 900 : 300,
      86_400,
      () => connector.browse(category, section, page, filters),
    );
    return { ...result.value, stale: result.stale };
  }

  async details(category: CatalogCategory, externalId: string, source?: string) {
    const connector = this.resolve(category, source);
    const result = await this.cached(
      connector,
      ['details', category, externalId],
      3_600,
      604_800,
      () => connector.details(category, externalId),
    );
    return { ...result.value, stale: result.stale };
  }

  async recognize(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new NotFoundException('Source URL is invalid');
    }
    for (const connector of this.connectors) {
      if (!connector.descriptor.enabled) {
        continue;
      }
      const match = await connector.recognize(url);
      if (match) {
        return { ...match, source: connector.descriptor.key };
      }
    }
    throw new NotFoundException('No connector recognizes this URL');
  }

  resolve(category: CatalogCategory, source?: string) {
    const connector = source
      ? this.connectors.find((candidate) => candidate.descriptor.key === source)
      : this.connectors.find((candidate) =>
          candidate.descriptor.enabled &&
          candidate.descriptor.categories.includes(category),
        );
    if (
      !connector ||
      !connector.descriptor.enabled ||
      !connector.descriptor.categories.includes(category)
    ) {
      throw new NotFoundException('No enabled connector supports this category');
    }
    return connector;
  }

  private async cached<T>(
    connector: SourceConnector,
    parts: unknown[],
    freshSeconds: number,
    staleSeconds: number,
    load: () => Promise<T>,
  ) {
    return this.cache.getOrLoad(
      `connector:${connector.descriptor.key}:${Buffer.from(JSON.stringify(parts)).toString('base64url')}`,
      freshSeconds,
      staleSeconds,
      async () => {
        await this.limit(connector.descriptor.key);
        return load();
      },
    );
  }

  private async limit(source: string) {
    const interval = source === 'igdb' ? 250 : source === 'mangadex' ? 200 : 40;
    const previous = this.requestQueues.get(source) ?? Promise.resolve();
    const current = previous.then(async () => {
      const wait = Math.max(
        0,
        (this.lastRequest.get(source) ?? 0) + interval - Date.now(),
      );
      if (wait) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequest.set(source, Date.now());
    });
    this.requestQueues.set(source, current);
    try {
      await current;
    } finally {
      if (this.requestQueues.get(source) === current) {
        this.requestQueues.delete(source);
      }
    }
  }
}
