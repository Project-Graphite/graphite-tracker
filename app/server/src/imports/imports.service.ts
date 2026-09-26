import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ImportConflictPolicy,
  ImportDecision,
  ImportMatch,
  ImportState,
  LibraryState,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { CatalogItemsService } from '../catalog/catalog-items.service';
import { LibraryService } from '../library/library.service';
import { PrismaService } from '../prisma/prisma.service';
import { SiteSettingsService } from '../site/site-settings.service';
import { withLowPriority } from '../sources/connector-http.service';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory } from '../sources/source.types';
import type { ParsedBackup } from './backup-parser';
import { ImportMatcherService, type ImportOption } from './import-matcher.service';

const retentionMs = 7 * 24 * 60 * 60 * 1000;
const parseTimeoutMs = 60_000;
const candidatePageSize = 50;
const primaryCategories: Record<string, CatalogCategory> = { manga: 'manga', anime: 'anime' };

type Candidate = Prisma.ImportCandidateGetPayload<object>;

@Injectable()
export class ImportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportsService.name);
  private readonly running = new Set<string>();
  private parsing: Promise<unknown> = Promise.resolve();
  private cleanup?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorRegistryService,
    private readonly catalogItems: CatalogItemsService,
    private readonly library: LibraryService,
    private readonly matcher: ImportMatcherService,
    private readonly site: SiteSettingsService,
  ) {}

  async onModuleInit() {
    await this.prisma.importBatch.updateMany({
      where: { state: ImportState.PARSING },
      data: {
        state: ImportState.FAILED,
        error: 'The server restarted while reading this backup. Upload it again.',
      },
    });
    await this.prisma.importBatch.updateMany({
      where: { state: ImportState.APPLYING },
      data: { state: ImportState.READY },
    });
    const matching = await this.prisma.importBatch.findMany({
      where: { state: ImportState.MATCHING },
      select: { id: true },
    });
    matching.forEach(({ id }) => this.inBackground(this.match(id)));
    await this.removeExpired();
    this.cleanup = setInterval(() => this.inBackground(this.removeExpired()), 3_600_000);
    this.cleanup.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanup);
  }

  async create(userId: string, path: string) {
    let batch;
    try {
      const digest = createHash('sha256');
      for await (const chunk of createReadStream(path)) digest.update(chunk as Buffer);
      batch = await this.prisma.importBatch.create({
        data: {
          userId,
          fileDigest: digest.digest('hex'),
          expiresAt: new Date(Date.now() + retentionMs),
        },
      });
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
    this.inBackground(
      this.read(batch.id, path).then((stored) => (stored ? this.match(batch.id) : undefined)),
    );
    return this.detail(userId, batch.id);
  }

  async list(userId: string) {
    const batches = await this.prisma.importBatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return batches.map((batch) => ({
      id: batch.id,
      sourceApp: batch.sourceApp,
      state: batch.state.toLowerCase(),
      createdAt: batch.createdAt,
      appliedAt: batch.appliedAt,
    }));
  }

  async detail(userId: string, id: string) {
    const batch = await this.owned(userId, id);
    const [matches, outcomes, undecided, earlier, conflicts] = await Promise.all([
      this.prisma.importCandidate.groupBy({
        by: ['match'],
        where: { batchId: id },
        _count: true,
      }),
      this.prisma.importCandidate.groupBy({
        by: ['outcome'],
        where: { batchId: id, outcome: { not: null } },
        _count: true,
      }),
      this.prisma.importCandidate.count({
        where: { batchId: id, match: ImportMatch.SUGGESTED, decision: null },
      }),
      this.prisma.importBatch.findFirst({
        where: {
          userId,
          fileDigest: batch.fileDigest,
          appliedAt: { not: null },
          id: { not: id },
        },
        orderBy: { appliedAt: 'desc' },
        select: { appliedAt: true },
      }),
      batch.state === ImportState.READY ? this.conflictIds(userId, id) : [],
    ]);
    return {
      id: batch.id,
      sourceApp: batch.sourceApp,
      state: batch.state.toLowerCase(),
      conflictPolicy: batch.conflictPolicy.toLowerCase(),
      error: batch.error,
      createdAt: batch.createdAt,
      appliedAt: batch.appliedAt,
      expiresAt: batch.expiresAt,
      previouslyAppliedAt: earlier?.appliedAt ?? null,
      undecided,
      conflicts: conflicts.length,
      matches: Object.fromEntries(
        matches.map((group) => [group.match.toLowerCase(), group._count]),
      ),
      outcomes: Object.fromEntries(
        outcomes.map((group) => [group.outcome, group._count]),
      ),
    };
  }

  async candidates(userId: string, id: string, match: ImportMatch | 'CONFLICT', page: number) {
    await this.owned(userId, id);
    const where =
      match === 'CONFLICT'
        ? { id: { in: await this.conflictIds(userId, id) } }
        : { batchId: id, match };
    const [total, candidates] = await this.prisma.$transaction([
      this.prisma.importCandidate.count({ where }),
      this.prisma.importCandidate.findMany({
        where,
        orderBy: { position: 'asc' },
        skip: (page - 1) * candidatePageSize,
        take: candidatePageSize,
      }),
    ]);
    const chosen = candidates.flatMap((candidate) => {
      const option = this.chosenOption(candidate);
      return option ? [{ source: option.item.source, externalId: option.item.externalId }] : [];
    });
    const existing = await this.library.bySources(userId, chosen);
    return {
      page,
      totalPages: Math.max(1, Math.ceil(total / candidatePageSize)),
      totalResults: total,
      results: candidates.map((candidate) => {
        const option = this.chosenOption(candidate);
        return {
          id: candidate.id,
          kind: candidate.kind,
          title: candidate.title,
          sourceName: candidate.sourceName,
          progress: candidate.progress?.toNumber() ?? null,
          state: candidate.state.toLowerCase(),
          match: candidate.match.toLowerCase(),
          issue: candidate.issue,
          choice: candidate.choice,
          decision: candidate.decision?.toLowerCase() ?? null,
          outcome: candidate.outcome,
          options: this.options(candidate).map(({ score, item }) => ({
            score,
            source: item.source,
            externalId: item.externalId,
            category: item.category,
            title: item.title,
            releaseDate: item.releaseDate,
            posterUrl: item.posterUrl,
          })),
          existing:
            (option &&
              existing.find((entry) =>
                entry.item.sources.some(
                  (source) =>
                    source.key === option.item.source &&
                    source.externalId === option.item.externalId,
                ),
              )) ??
            null,
        };
      }),
    };
  }

  async decide(
    userId: string,
    id: string,
    candidateId: string,
    decision: ImportDecision,
    choice?: number,
  ) {
    await this.ready(userId, id);
    const candidate = await this.prisma.importCandidate.findFirst({
      where: { id: candidateId, batchId: id },
    });
    if (
      !candidate ||
      (candidate.match !== ImportMatch.EXACT && candidate.match !== ImportMatch.SUGGESTED)
    ) {
      throw new NotFoundException('Import entry not found');
    }
    const selected = choice ?? candidate.choice ?? 0;
    if (!this.options(candidate)[selected]) {
      throw new BadRequestException('Choose one of the suggested titles');
    }
    await this.prisma.importCandidate.update({
      where: { id: candidateId },
      data: { decision, choice: selected },
    });
    return this.detail(userId, id);
  }

  async acceptSuggestions(userId: string, id: string) {
    await this.ready(userId, id);
    await this.prisma.importCandidate.updateMany({
      where: { batchId: id, match: ImportMatch.SUGGESTED, decision: null },
      data: { decision: ImportDecision.ACCEPT },
    });
    return this.detail(userId, id);
  }

  async apply(userId: string, id: string, conflictPolicy: ImportConflictPolicy) {
    await this.ready(userId, id);
    const undecided = await this.prisma.importCandidate.count({
      where: { batchId: id, match: ImportMatch.SUGGESTED, decision: null },
    });
    if (undecided > 0) {
      throw new BadRequestException('Accept or skip every suggested match before applying');
    }
    const started = await this.prisma.importBatch.updateMany({
      where: { id, state: ImportState.READY },
      data: { state: ImportState.APPLYING, conflictPolicy },
    });
    if (started.count === 0) {
      throw new BadRequestException('This import is not ready for review');
    }
    this.inBackground(this.applyAccepted(userId, id, conflictPolicy));
    return this.detail(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.importBatch.delete({ where: { id } });
  }

  private async read(batchId: string, path: string) {
    try {
      const backup = await this.parse(path);
      const seen = new Set<string>();
      const rows = backup.entries.map((entry, position) => {
        const key = `${entry.kind}:${entry.mangadexId ?? entry.title.toLowerCase()}`;
        const duplicate = seen.has(key);
        seen.add(key);
        return {
          batchId,
          position,
          kind: entry.kind,
          title: entry.title,
          trackerTitles: entry.trackerTitles,
          sourceName: entry.sourceName,
          sourceUrl: entry.sourceUrl,
          mangadexId: entry.mangadexId,
          progress: entry.progress,
          state: LibraryState[entry.state.toUpperCase() as keyof typeof LibraryState],
          ...(!entry.title
            ? { match: ImportMatch.UNSUPPORTED, issue: 'no_title' }
            : duplicate
              ? { match: ImportMatch.DUPLICATE }
              : {}),
        };
      });
      await this.prisma.$transaction(async (transaction) => {
        for (let start = 0; start < rows.length; start += 1_000) {
          await transaction.importCandidate.createMany({ data: rows.slice(start, start + 1_000) });
        }
        await transaction.importBatch.update({
          where: { id: batchId },
          data: { state: ImportState.MATCHING, sourceApp: backup.app },
        });
      }, { timeout: 60_000 });
    } catch (error) {
      await this.prisma.importBatch.updateMany({
        where: { id: batchId },
        data: {
          state: ImportState.FAILED,
          error: error instanceof Error ? error.message : 'The backup could not be read',
        },
      });
      return false;
    } finally {
      await rm(path, { force: true });
    }
    return true;
  }

  private parse(path: string) {
    const turn = this.parsing.then(() => this.parseInWorker(path));
    this.parsing = Promise.allSettled([turn]);
    return turn;
  }

  private parseInWorker(path: string) {
    return new Promise<ParsedBackup>((resolve, reject) => {
      const worker = new Worker(join(__dirname, 'backup-parser.worker.js'), {
        workerData: path,
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error('Reading the backup took too long'));
      }, parseTimeoutMs);
      worker.once('message', (result: { backup?: ParsedBackup; error?: string }) => {
        clearTimeout(timer);
        void worker.terminate();
        if (result.backup) resolve(result.backup);
        else reject(new Error(result.error));
      });
      worker.once('error', (error: Error & { code?: string }) => {
        clearTimeout(timer);
        reject(
          new Error(
            error.code === 'ERR_WORKER_OUT_OF_MEMORY'
              ? 'The backup needs more memory than an import may use'
              : 'The backup could not be read',
          ),
        );
      });
    });
  }

  private async match(batchId: string) {
    if (this.running.has(batchId)) return;
    this.running.add(batchId);
    try {
      const { user } = await this.prisma.importBatch.findUniqueOrThrow({
        where: { id: batchId },
        select: { user: { select: { showAdultContent: true } } },
      });
      const adult = await this.site.adultContent(user.showAdultContent);
      for (;;) {
        const pending = await this.prisma.importCandidate.findMany({
          where: { batchId, match: ImportMatch.PENDING },
          orderBy: { position: 'asc' },
          take: 20,
        });
        if (pending.length === 0) break;
        for (const candidate of pending) {
          const found = await this.find(candidate, adult);
          const updated = await this.prisma.importCandidate.updateMany({
            where: { id: candidate.id },
            data: {
              ...found,
              options: found.options as unknown as Prisma.InputJsonValue,
              choice: found.options.length > 0 ? 0 : null,
              decision: found.match === ImportMatch.EXACT ? ImportDecision.ACCEPT : null,
            },
          });
          if (updated.count === 0) return;
        }
      }
      await this.prisma.importBatch.updateMany({
        where: { id: batchId, state: ImportState.MATCHING },
        data: { state: ImportState.READY },
      });
    } finally {
      this.running.delete(batchId);
    }
  }

  private async find(candidate: Candidate, adult: boolean) {
    try {
      this.connectors.resolve(primaryCategories[candidate.kind] ?? 'manga');
    } catch {
      return { match: ImportMatch.UNSUPPORTED, issue: 'no_connector', options: [] };
    }
    try {
      return {
        ...(await withLowPriority(() => this.matcher.match(candidate, adult))),
        issue: null,
      };
    } catch {
      return { match: ImportMatch.UNMATCHED, issue: 'lookup_failed', options: [] };
    }
  }

  private async applyAccepted(userId: string, batchId: string, policy: ImportConflictPolicy) {
    try {
      await this.applyChunks(userId, batchId, policy);
    } catch (error) {
      await this.prisma.importBatch.updateMany({
        where: { id: batchId, state: ImportState.APPLYING },
        data: {
          state: ImportState.READY,
          error: `Applying stopped: ${error instanceof Error ? error.message : 'unknown error'}. Apply again to continue.`,
        },
      });
    }
  }

  private async applyChunks(userId: string, batchId: string, policy: ImportConflictPolicy) {
    const sourceIds = new Map<string, string>();
    const applied = new Set(
      (
        await this.prisma.importCandidate.findMany({
          where: { batchId, catalogItemId: { not: null } },
          select: { catalogItemId: true },
        })
      ).map(({ catalogItemId }) => catalogItemId),
    );
    for (;;) {
      const chunk = await this.prisma.importCandidate.findMany({
        where: { batchId, decision: ImportDecision.ACCEPT, outcome: null },
        orderBy: { position: 'asc' },
        take: 100,
      });
      if (chunk.length === 0) break;
      await this.prisma.$transaction(
        async (transaction) => {
          for (const candidate of chunk) {
            const option = this.chosenOption(candidate);
            const descriptor =
              option &&
              this.connectors
                .list(option.item.category)
                .find((connector) => connector.key === option.item.source && connector.enabled);
            if (!option || !descriptor) {
              await transaction.importCandidate.update({
                where: { id: candidate.id },
                data: { outcome: 'skipped' },
              });
              continue;
            }
            let sourceId = sourceIds.get(descriptor.key);
            if (!sourceId) {
              sourceId = (await this.catalogItems.sourceRecord(transaction, descriptor)).id;
              sourceIds.set(descriptor.key, sourceId);
            }
            const item = await this.catalogItems.upsert(transaction, option.item, sourceId);
            const outcome = applied.has(item.id)
              ? 'duplicate'
              : await this.applyCandidate(transaction, {
                  batchId,
                  candidate,
                  catalogItemId: item.id,
                  option,
                  policy,
                  sourceId,
                  userId,
                });
            applied.add(item.id);
            await transaction.importCandidate.update({
              where: { id: candidate.id },
              data: { outcome, catalogItemId: item.id },
            });
          }
        },
        { timeout: 120_000 },
      );
    }
    await this.prisma.importCandidate.updateMany({
      where: { batchId, outcome: null },
      data: { outcome: 'skipped' },
    });
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { state: ImportState.APPLIED, appliedAt: new Date(), error: null },
    });
  }

  private async applyCandidate(
    transaction: Prisma.TransactionClient,
    input: {
      batchId: string;
      candidate: Candidate;
      catalogItemId: string;
      option: ImportOption;
      policy: ImportConflictPolicy;
      sourceId: string;
      userId: string;
    },
  ) {
    const { candidate, option } = input;
    const units = option.item.capabilities.progressUnits;
    const imported = candidate.progress?.toNumber() ?? null;
    const chapter = units.includes('chapter') ? imported : null;
    const episode = units.includes('episode') && imported !== null ? Math.floor(imported) : null;
    const progress = chapter ?? episode;
    const namesSupportedSource = /mangadex/i.test(candidate.sourceName ?? '');
    const reference =
      !namesSupportedSource && candidate.sourceName && candidate.sourceUrl
        ? {
            batchId: input.batchId,
            sourceName: candidate.sourceName,
            sourceUrl: candidate.sourceUrl,
          }
        : null;
    const existing = await transaction.libraryEntry.findUnique({
      where: {
        userId_catalogItemId: { userId: input.userId, catalogItemId: input.catalogItemId },
      },
    });
    if (!existing) {
      const now = new Date();
      await transaction.libraryEntry.create({
        data: {
          userId: input.userId,
          catalogItemId: input.catalogItemId,
          state: candidate.state,
          startedAt: candidate.state === LibraryState.PLANNED ? null : now,
          completedAt: candidate.state === LibraryState.COMPLETED ? now : null,
          preferredSourceId:
            namesSupportedSource && option.item.source === 'mangadex' ? input.sourceId : null,
          progressChapter: chapter,
          progressEpisode: episode,
          statusEvents: { create: { newState: candidate.state } },
          importedSources: reference ? { create: reference } : undefined,
        },
      });
      return 'added';
    }
    if (reference) {
      await transaction.importedSourceReference.upsert({
        where: {
          libraryEntryId_sourceName_sourceUrl: {
            libraryEntryId: existing.id,
            sourceName: reference.sourceName,
            sourceUrl: reference.sourceUrl,
          },
        },
        update: {},
        create: { libraryEntryId: existing.id, ...reference },
      });
    }
    const current = Number(
      (chapter !== null ? existing.progressChapter : existing.progressEpisode) ?? 0,
    );
    if (
      input.policy !== ImportConflictPolicy.KEEP_GREATER_PROGRESS ||
      progress === null ||
      progress <= current ||
      existing.state === LibraryState.COMPLETED ||
      existing.state === LibraryState.DROPPED
    ) {
      return 'kept';
    }
    await transaction.libraryEntry.update({
      where: { id: existing.id },
      data: {
        ...(chapter !== null ? { progressChapter: chapter } : { progressEpisode: episode }),
        ...(existing.state === LibraryState.PLANNED
          ? {
              state: LibraryState.IN_PROGRESS,
              startedAt: existing.startedAt ?? new Date(),
              statusEvents: {
                create: { oldState: LibraryState.PLANNED, newState: LibraryState.IN_PROGRESS },
              },
            }
          : {}),
      },
    });
    return 'updated';
  }

  private async conflictIds(userId: string, batchId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT candidate.id
      FROM import_candidates candidate
      JOIN source_records source
        ON source.key = candidate.options -> candidate.choice -> 'item' ->> 'source'
      JOIN source_entries entry
        ON entry.source_id = source.id
        AND entry.external_id = candidate.options -> candidate.choice -> 'item' ->> 'externalId'
      JOIN library_entries library
        ON library.catalog_item_id = entry.catalog_item_id
        AND library.user_id = ${userId}::uuid
      WHERE candidate.batch_id = ${batchId}::uuid
        AND candidate.match IN ('exact', 'suggested')
        AND candidate.decision IS DISTINCT FROM 'skip'
      ORDER BY candidate.position`;
    return rows.map(({ id }) => id);
  }

  private options(candidate: Candidate) {
    return candidate.options as unknown as ImportOption[];
  }

  private chosenOption(candidate: Candidate) {
    return candidate.choice === null ? undefined : this.options(candidate)[candidate.choice];
  }

  private async owned(userId: string, id: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id, userId } });
    if (!batch) {
      throw new NotFoundException('Import not found');
    }
    return batch;
  }

  private async ready(userId: string, id: string) {
    const batch = await this.owned(userId, id);
    if (batch.state !== ImportState.READY) {
      throw new BadRequestException('This import is not ready for review');
    }
    return batch;
  }

  private async removeExpired() {
    await this.prisma.importBatch.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        state: { notIn: [ImportState.PARSING, ImportState.MATCHING, ImportState.APPLYING] },
      },
    });
  }

  private inBackground(task: Promise<unknown>) {
    task.catch((error: unknown) => this.logger.error('Import task failed', error));
  }
}
