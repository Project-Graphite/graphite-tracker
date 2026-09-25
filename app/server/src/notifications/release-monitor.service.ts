import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { loadSourcePreferences } from '../library/effective-source';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory } from '../sources/source.types';
import {
  newSignals,
  releaseKinds,
  subscribedEntryWhere,
  subscriptionInclude,
  wantsRelease,
} from './subscriptions';

const refreshIntervalMs = 6 * 60 * 60 * 1000;
const baselineGapMs = 7 * 24 * 60 * 60 * 1000;
const batchSize = 100;

const monitoredEntryInclude = Prisma.validator<Prisma.SourceEntryInclude>()({
  source: true,
  catalogItem: true,
});

@Injectable()
export class ReleaseMonitorService {
  private readonly logger = new Logger(ReleaseMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorRegistryService,
  ) {}

  async refreshDue(now = new Date()) {
    const due = await this.prisma.sourceEntry.findMany({
      where: {
        source: { enabled: true, capabilities: { has: 'RELEASES' } },
        OR: [
          { releasesAttemptedAt: null },
          { releasesAttemptedAt: { lt: new Date(now.getTime() - refreshIntervalMs) } },
        ],
        catalogItem: { libraryEntries: { some: subscribedEntryWhere } },
      },
      include: monitoredEntryInclude,
      orderBy: { releasesAttemptedAt: { sort: 'asc', nulls: 'first' } },
      take: batchSize,
    });
    for (const entry of due) {
      await this.refresh(entry, now);
    }
  }

  private async refresh(
    entry: Prisma.SourceEntryGetPayload<{ include: typeof monitoredEntryInclude }>,
    now: Date,
  ) {
    await this.prisma.sourceEntry.update({
      where: { id: entry.id },
      data: { releasesAttemptedAt: now },
    });
    let signals;
    try {
      signals = await this.connectors.releases(
        entry.catalogItem.category.toLowerCase() as CatalogCategory,
        entry.externalId,
        entry.source.key,
      );
    } catch (error) {
      this.logger.warn(
        `Release check for ${entry.source.key}:${entry.externalId} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return;
    }
    const baseline =
      !entry.releasesCheckedAt || now.getTime() - entry.releasesCheckedAt.getTime() > baselineGapMs;
    const existing = await this.prisma.releaseMarker.findMany({
      where: { sourceEntryId: entry.id },
      select: { key: true, kind: true, ordinal: true },
    });
    const [markers] = await this.prisma.$transaction([
      this.prisma.releaseMarker.createManyAndReturn({
        data: newSignals(signals, existing).map((signal) => ({
          sourceEntryId: entry.id,
          key: signal.key,
          kind: releaseKinds[signal.kind],
          label: signal.label,
          platform: signal.platform,
          ordinal: signal.ordinal,
          occurredAt: new Date(`${signal.occurredAt}T00:00:00.000Z`),
        })),
        skipDuplicates: true,
      }),
      this.prisma.sourceEntry.update({
        where: { id: entry.id },
        data: { releasesCheckedAt: now },
      }),
    ]);
    if (!baseline && markers.length > 0) {
      await this.queue(entry.catalogItemId, markers);
    }
  }

  private async queue(
    catalogItemId: string,
    markers: Array<{ id: string; sourceEntryId: string; platform: string | null }>,
  ) {
    const subscribers = await this.prisma.libraryEntry.findMany({
      where: { catalogItemId, ...subscribedEntryWhere },
      include: subscriptionInclude,
    });
    const events = [];
    for (const subscriber of subscribers) {
      const preferences = await loadSourcePreferences(this.prisma, subscriber.userId);
      events.push(
        ...markers
          .filter((marker) => wantsRelease(subscriber, marker, preferences))
          .map((marker) => ({
            userId: subscriber.userId,
            libraryEntryId: subscriber.id,
            releaseMarkerId: marker.id,
          })),
      );
    }
    await this.prisma.notificationEvent.createMany({ data: events, skipDuplicates: true });
  }
}
