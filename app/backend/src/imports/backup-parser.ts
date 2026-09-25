import { gunzipSync } from 'node:zlib';
import { parse } from 'protobufjs';

export const maxBackupBytes = 50 * 1024 * 1024;
const maxDecompressedBytes = 200 * 1024 * 1024;
const maxEntries = 10_000;
const maxTextLength = 300;

export type ImportedState = 'planned' | 'in_progress' | 'completed' | 'dropped';

export interface BackupEntry {
  kind: 'manga' | 'anime';
  title: string;
  trackerTitles: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  mangadexId: string | null;
  progress: number | null;
  state: ImportedState;
}

export interface ParsedBackup {
  app: 'mihon' | 'aniyomi';
  entries: BackupEntry[];
}

export class BackupError extends Error {}

const root = parse(`
syntax = "proto2";

message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupAnime legacyBackupAnime = 3;
  repeated BackupSource backupSources = 101;
  repeated BackupSource legacyBackupAnimeSources = 103;
  repeated BackupAnime backupAnime = 501;
  repeated BackupSource backupAnimeSources = 503;
}

message BackupManga {
  optional int64 source = 1;
  optional string url = 2;
  optional string title = 3;
  repeated BackupProgress chapters = 16;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100 [default = true];
}

message BackupAnime {
  optional int64 source = 1;
  optional string url = 2;
  optional string title = 3;
  repeated BackupProgress episodes = 16;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100 [default = true];
}

message BackupProgress {
  optional bool done = 4;
  optional float number = 9;
}

message BackupTracking {
  optional int32 syncId = 1;
  optional string title = 5;
  optional float lastRead = 6;
  optional int32 status = 9;
}

message BackupSource {
  optional string name = 1;
  optional int64 sourceId = 2;
}
`).root;
const backupType = root.lookupType('Backup');

interface DecodedProgress {
  done: boolean;
  number: number;
}

interface DecodedTracking {
  syncId: number;
  title: string;
  lastRead: number;
  status: number;
}

interface DecodedTitle {
  source: string;
  url: string;
  title: string;
  chapters?: DecodedProgress[];
  episodes?: DecodedProgress[];
  tracking: DecodedTracking[];
  favorite: boolean;
}

interface DecodedSource {
  name: string;
  sourceId: string;
}

interface DecodedBackup {
  backupManga: DecodedTitle[];
  legacyBackupAnime: DecodedTitle[];
  backupSources: DecodedSource[];
  legacyBackupAnimeSources: DecodedSource[];
  backupAnime: DecodedTitle[];
  backupAnimeSources: DecodedSource[];
}

const reading = { 1: 'in_progress', 2: 'completed', 3: 'in_progress', 4: 'dropped' } as const;
const trackerStates: Record<BackupEntry['kind'], Record<number, Record<number, ImportedState>>> = {
  manga: {
    1: { ...reading, 6: 'planned', 7: 'completed' },
    2: { ...reading, 5: 'planned', 6: 'completed' },
    3: { ...reading, 5: 'planned' },
    4: { ...reading, 5: 'planned', 6: 'completed' },
    5: { 1: 'planned', 2: 'completed', 3: 'in_progress', 4: 'in_progress', 5: 'dropped' },
    7: { 0: 'in_progress', 1: 'planned', 2: 'completed', 3: 'dropped', 4: 'in_progress' },
  },
  anime: {
    1: { 11: 'in_progress', 2: 'completed', 3: 'in_progress', 4: 'dropped', 16: 'planned', 17: 'completed' },
    2: { 11: 'in_progress', 2: 'completed', 3: 'in_progress', 4: 'dropped', 15: 'planned', 16: 'completed' },
    3: { 11: 'in_progress', 2: 'completed', 3: 'in_progress', 4: 'dropped', 15: 'planned' },
    4: { ...reading, 5: 'planned', 6: 'completed' },
    5: { 1: 'planned', 2: 'completed', 3: 'in_progress', 4: 'in_progress', 5: 'dropped' },
    101: { 1: 'in_progress', 2: 'completed', 3: 'in_progress', 4: 'dropped', 5: 'planned' },
  },
};

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseBackup(file: Buffer): ParsedBackup {
  if (file.length > maxBackupBytes) {
    throw new BackupError('The backup is larger than 50 MiB');
  }
  if (file[0] !== 0x1f || file[1] !== 0x8b) {
    throw new BackupError('This is not a gzipped Mihon or AniYomi backup');
  }
  let payload: Buffer;
  try {
    payload = gunzipSync(file, { maxOutputLength: maxDecompressedBytes });
  } catch (error) {
    throw new BackupError(
      error instanceof RangeError
        ? 'The backup is larger than 200 MiB once decompressed'
        : 'The backup could not be decompressed',
    );
  }
  const signature = payload.subarray(0, 4).toString('hex');
  if (signature.startsWith('1f8b') || signature === '504b0304' || signature === '377abcaf') {
    throw new BackupError('The backup contains another archive');
  }
  let backup: DecodedBackup;
  try {
    backup = backupType.toObject(backupType.decode(payload), {
      arrays: true,
      defaults: true,
      longs: String,
    }) as DecodedBackup;
  } catch {
    throw new BackupError('The backup is corrupt or is not a Mihon or AniYomi backup');
  }
  const sources = new Map(
    [
      ...backup.backupSources,
      ...backup.legacyBackupAnimeSources,
      ...backup.backupAnimeSources,
    ].map((source) => [source.sourceId, source.name]),
  );
  const titles = [
    ...backup.backupManga.map((title) => ({ kind: 'manga' as const, title })),
    ...[...backup.legacyBackupAnime, ...backup.backupAnime].map((title) => ({
      kind: 'anime' as const,
      title,
    })),
  ].filter(({ title }) => title.favorite);
  if (titles.length > maxEntries) {
    throw new BackupError('The backup has more than 10,000 library entries');
  }
  return {
    app:
      backup.legacyBackupAnime.length > 0 || backup.backupAnime.length > 0
        ? 'aniyomi'
        : 'mihon',
    entries: titles.map(({ kind, title }) => entry(kind, title, sources.get(title.source))),
  };
}

function entry(
  kind: BackupEntry['kind'],
  title: DecodedTitle,
  sourceName: string | undefined,
): BackupEntry {
  const progress = Math.max(
    0,
    ...(title.chapters ?? title.episodes ?? [])
      .filter((item) => item.done)
      .map((item) => item.number),
    ...title.tracking.map((tracking) => tracking.lastRead),
  );
  const trackedState = title.tracking
    .map((tracking) => trackerStates[kind][tracking.syncId]?.[tracking.status])
    .find(Boolean);
  const isMangaDex =
    kind === 'manga' &&
    (/mangadex/i.test(sourceName ?? '') || /mangadex\.org/i.test(title.url));
  const name = bounded(title.title.trim());
  return {
    kind,
    title: name,
    trackerTitles: [
      ...new Set(
        title.tracking
          .map((tracking) => bounded(tracking.title.trim()))
          .filter((trackerTitle) => trackerTitle && trackerTitle !== name),
      ),
    ],
    sourceName: bounded(sourceName ?? '') || null,
    sourceUrl: bounded(title.url) || null,
    mangadexId: isMangaDex ? (title.url.match(uuid)?.[0].toLowerCase() ?? null) : null,
    progress: progress > 0 ? Math.min(Math.round(progress * 100) / 100, 99_999_999) : null,
    state: trackedState ?? (progress > 0 ? 'in_progress' : 'planned'),
  };
}

function bounded(value: string) {
  return value.length > maxTextLength ? '' : value;
}
