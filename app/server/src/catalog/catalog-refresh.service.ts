import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withLowPriority } from '../sources/connector-http.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory } from '../sources/source.types';
import { CatalogItemsService } from './catalog-items.service';

const refreshAfterMs = 7 * 24 * 60 * 60 * 1000;
const batchSize = 25;

@Injectable()
export class CatalogRefreshService {
  private readonly logger = new Logger(CatalogRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorRegistryService,
    private readonly catalogItems: CatalogItemsService,
  ) {}

  async refreshDue(now = new Date()) {
    const due = await this.prisma.sourceEntry.findMany({
      where: {
        source: { enabled: true },
        catalogItem: { libraryEntries: { some: {} } },
        OR: [
          { lastRefreshedAt: null },
          { lastRefreshedAt: { lt: new Date(now.getTime() - refreshAfterMs) } },
        ],
      },
      include: { source: true, catalogItem: { select: { category: true } } },
      orderBy: { lastRefreshedAt: { sort: 'asc', nulls: 'first' } },
      take: batchSize,
    });
    for (const entry of due) {
      try {
        const details = await withLowPriority(() =>
          this.connectors.details(
            entry.catalogItem.category.toLowerCase() as CatalogCategory,
            entry.externalId,
            entry.source.key,
            true,
          ),
        );
        await this.prisma.$transaction((transaction) =>
          this.catalogItems.upsert(transaction, details, entry.sourceId),
        );
      } catch (error) {
        this.logger.warn(
          `Refreshing ${entry.source.key}:${entry.externalId} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        await this.prisma.sourceEntry.update({
          where: { id: entry.id },
          data: { lastRefreshedAt: now },
        });
      }
    }
  }
}
