import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { loadSourcePreferences, SourcePreferences } from '../library/effective-source';
import { PrismaService } from '../prisma/prisma.service';
import { withLowPriority } from '../sources/connector-http.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory } from '../sources/source.types';
import {
  followedEntryWhere,
  followsRelease,
  newSignals,
  releaseKinds,
  subscribedEntryWhere,
  subscriptionInclude,
  wantsRelease,
} from './subscriptions';

const refreshIntervalMs = 6 * 60 * 60 * 1000;
const baselineGapMs = 7 * 24 * 60 * 60 * 1000;
const batchSize = 100;
const runBudgetMs = 10 * 60 * 1000;

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
    const deadline = Date.now() + runBudgetMs;
    for (;;) {
      const due = await this.prisma.sourceEntry.findMany({
        where: {
          source: { enabled: true, capabilities: { has: 'RELEASES' } },
          OR: [
            { releasesAttemptedAt: null },
            { releasesAttemptedAt: { lt: new Date(now.getTime() - refreshIntervalMs) } },
          ],
          catalogItem: { libraryEntries: { some: followedEntryWhere } },
        },
        include: monitoredEntryInclude,
        orderBy: { releasesAttemptedAt: { sort: 'asc', nulls: 'first' } },
        take: batchSize,
      });
      for (const entry of due) {
        if (Date.now() >= deadline) return;
        await this.refresh(entry, now);
      }
      if (due.length < batchSize) return;
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
      signals = await withLowPriority(() =>
        this.connectors.releases(
          entry.catalogItem.category.toLowerCase() as CatalogCategory,
          entry.externalId,
          entry.source.key,
        ),
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
    const markers = newSignals(signals, existing).map((signal) => ({
      id: randomUUID(),
      sourceEntryId: entry.id,
      key: signal.key,
      kind: releaseKinds[signal.kind],
      label: signal.label,
      platform: signal.platform ?? null,
      ordinal: signal.ordinal,
      occurredAt: new Date(`${signal.occurredAt}T00:00:00.000Z`),
    }));
    const { inbox, events } =
      !baseline && markers.length > 0
        ? await this.recipients(entry.catalogItemId, markers)
        : { inbox: [], events: [] };
    try {
      await this.prisma.$transaction([
        this.prisma.releaseMarker.createMany({ data: markers }),
        this.prisma.sourceEntry.update({
          where: { id: entry.id },
          data: { releasesCheckedAt: now },
        }),
        this.prisma.inboxNotification.createMany({ data: inbox, skipDuplicates: true }),
        this.prisma.notificationEvent.createMany({ data: events, skipDuplicates: true }),
      ]);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      this.logger.warn(
        `Releases for ${entry.source.key}:${entry.externalId} were recorded by another run`,
      );
    }
  }

  private async recipients(
    catalogItemId: string,
    markers: Array<{ id: string; sourceEntryId: string; platform: string | null }>,
  ) {
    const [followers, subscribers] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { catalogItemId, ...followedEntryWhere },
        include: subscriptionInclude,
      }),
      this.prisma.libraryEntry.findMany({
        where: { catalogItemId, ...subscribedEntryWhere },
        include: subscriptionInclude,
      }),
    ]);
    const releasesFor = async (
      entries: typeof followers,
      wants: (entry: (typeof followers)[number], marker: (typeof markers)[number], preferences: SourcePreferences) => boolean,
    ) => {
      const rows = [];
      for (const entry of entries) {
        const preferences = await loadSourcePreferences(this.prisma, entry.userId);
        rows.push(
          ...markers
            .filter((marker) => wants(entry, marker, preferences))
            .map((marker) => ({
              userId: entry.userId,
              libraryEntryId: entry.id,
              releaseMarkerId: marker.id,
            })),
        );
      }
      return rows;
    };
    return {
      inbox: await releasesFor(followers, followsRelease),
      events: await releasesFor(subscribers, wantsRelease),
    };
  }
}
