import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withoutAdult } from './adult-content';
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
    const disabled = new Set(
      (config.get<string>('DISABLED_SOURCES') ?? '')
        .split(',')
        .map((key) => key.trim().toLowerCase()),
    );
    for (const { descriptor } of this.connectors) {
      descriptor.enabled = descriptor.enabled && !disabled.has(descriptor.key);
    }
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
      () =>
        connector
          .search(category, query, page, filters)
          .then((result) => withoutAdult(result, filters.adult)),
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
      () =>
        connector
          .browse(category, section, page, filters)
          .then((result) => withoutAdult(result, filters.adult)),
    );
    return { ...result.value, stale: result.stale };
  }

  async details(
    category: CatalogCategory,
    externalId: string,
    source?: string,
    adult = false,
  ) {
    const connector = this.resolve(category, source);
    const result = await this.cached(
      connector,
      ['details', category, externalId],
      3_600,
      604_800,
      () => connector.details(category, externalId),
    );
    if (result.value.adult && !adult) {
      throw new NotFoundException('This title is not available');
    }
    return { ...result.value, stale: result.stale };
  }

  async genres(category: CatalogCategory, source?: string) {
    const connector = this.resolve(category, source);
    const genres = connector.genres?.bind(connector);
    if (!genres) {
      return [];
    }
    const result = await this.cached(
      connector,
      ['genres', category],
      86_400,
      604_800,
      () => genres(category),
    );
    return result.value;
  }

  releases(category: CatalogCategory, externalId: string, source: string) {
    const connector = this.resolve(category, source);
    if (!connector.releases || !connector.descriptor.capabilities.includes('RELEASES')) {
      throw new NotFoundException(
        `${connector.descriptor.displayName} does not provide release updates`,
      );
    }
    return connector.releases(category, externalId);
  }

  async recognize(value: string) {
    const url = new URL(value);
    for (const connector of this.connectors) {
      if (!connector.descriptor.enabled) {
        continue;
      }
      const match = await connector.recognize(url);
      if (match) {
        return { ...match, source: connector.descriptor.key };
      }
    }
    throw new NotFoundException('This link is not from a supported source');
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

  private cached<T>(
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
      load,
    );
  }
}
