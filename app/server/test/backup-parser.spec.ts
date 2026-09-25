import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BackupError, parseBackup } from '../src/imports/backup-parser';
import { backupFile, encodeBackup } from './fixtures/backup';

const mangaDexId = '11111111-2222-3333-4444-555555555555';

describe('parseBackup', () => {
  it('reads a current Mihon backup and ignores fields it does not use', () => {
    const backup = parseBackup(
      backupFile({
        backupSources: [
          { name: 'MangaDex', sourceId: '2499283573021220255' },
          { name: 'Local reader', sourceId: '7' },
        ],
        backupPreferences: [{ key: 'reader_theme' }],
        backupManga: [
          {
            source: '2499283573021220255',
            url: `/manga/${mangaDexId}`,
            title: 'Tower Story',
            author: 'Someone',
            description: 'Private notes are ignored',
            genre: ['Adventure'],
            categories: ['3'],
            lastModifiedAt: '1700000000',
            favorite: true,
            chapters: [
              { url: '/c/1', name: 'One', read: true, chapterNumber: 1 },
              { url: '/c/2', name: 'Two', read: true, bookmark: true, chapterNumber: 12.5 },
              { url: '/c/3', name: 'Three', read: false, chapterNumber: 13 },
            ],
            tracking: [
              { syncId: 2, libraryId: '9', title: 'Tower Story (Anilist)', status: 2, lastChapterRead: 12 },
            ],
          },
          { source: '7', url: '/local/notes', title: 'Local Story' },
          { source: '7', url: '/history-only', title: 'History Only', favorite: false },
        ],
      }),
    );

    expect(backup).toEqual({
      app: 'mihon',
      entries: [
        {
          kind: 'manga',
          title: 'Tower Story',
          trackerTitles: ['Tower Story (Anilist)'],
          sourceName: 'MangaDex',
          sourceUrl: `/manga/${mangaDexId}`,
          mangadexId: mangaDexId,
          progress: 12.5,
          state: 'completed',
        },
        {
          kind: 'manga',
          title: 'Local Story',
          trackerTitles: [],
          sourceName: 'Local reader',
          sourceUrl: '/local/notes',
          mangadexId: null,
          progress: null,
          state: 'planned',
        },
      ],
    });
  });

  it('reads current and legacy AniYomi anime without inferring completion', () => {
    const anime = {
      source: '42',
      url: '/anime/1',
      title: 'Graphite Days',
      seasonNumber: 1,
      episodes: [
        { url: '/e/1', seen: true, episodeNumber: 1, totalSeconds: '1400' },
        { url: '/e/2', seen: true, episodeNumber: 2 },
      ],
    };
    const current = parseBackup(
      backupFile({
        isLegacy: false,
        backupAnime: [anime],
        backupAnimeSources: [{ name: 'Stream site', sourceId: '42' }],
      }),
    );
    const legacy = parseBackup(
      backupFile({
        legacyBackupAnime: [{ ...anime, tracking: [{ syncId: 1, status: 4 }] }],
        legacyBackupAnimeSources: [{ name: 'Stream site', sourceId: '42' }],
      }),
    );

    expect(current).toEqual({
      app: 'aniyomi',
      entries: [
        {
          kind: 'anime',
          title: 'Graphite Days',
          trackerTitles: [],
          sourceName: 'Stream site',
          sourceUrl: '/anime/1',
          mangadexId: null,
          progress: 2,
          state: 'in_progress',
        },
      ],
    });
    expect(legacy.entries[0]).toMatchObject({ progress: 2, state: 'dropped' });
  });

  it('drops titles and source details longer than 300 characters', () => {
    const long = 'x'.repeat(301);
    const backup = parseBackup(
      backupFile({
        backupSources: [
          { name: long, sourceId: '7' },
          { name: 'Local reader', sourceId: '8' },
        ],
        backupManga: [
          {
            source: '7',
            url: `/${long}`,
            title: 'Tower Story',
            favorite: true,
            tracking: [{ syncId: 2, title: long }, { syncId: 2, title: 'Tower Story (Anilist)' }],
          },
          { source: '8', url: '/manga/1', title: long, favorite: true },
        ],
      }),
    );

    expect(backup.entries).toEqual([
      expect.objectContaining({
        title: 'Tower Story',
        trackerTitles: ['Tower Story (Anilist)'],
        sourceName: null,
        sourceUrl: null,
      }),
      expect.objectContaining({ title: '', sourceName: 'Local reader', sourceUrl: '/manga/1' }),
    ]);
  });

  it.each([
    ['a file that is not gzipped', Buffer.from('not a backup')],
    ['a corrupt protobuf payload', gzipSync(Buffer.from([0x0a, 0xff, 0xff, 0xff, 0xff, 0x0f]))],
    ['a nested archive', gzipSync(backupFile({ backupManga: [{ title: 'Nested' }] }))],
  ])('rejects %s', (_label, file) => {
    expect(() => parseBackup(file)).toThrow(BackupError);
  });

  it('rejects a backup over the compressed size limit', () => {
    const file = Buffer.alloc(50 * 1024 * 1024 + 1);
    file[0] = 0x1f;
    file[1] = 0x8b;

    expect(() => parseBackup(file)).toThrow('larger than 50 MiB');
  });

  it('rejects a backup that decompresses past 200 MiB', () => {
    expect(() => parseBackup(gzipSync(Buffer.alloc(201 * 1024 * 1024)))).toThrow(
      'larger than 200 MiB once decompressed',
    );
  });

  it('rejects more than 10,000 library entries', () => {
    const payload = encodeBackup({
      backupManga: Array.from({ length: 10_001 }, (_, index) => ({ title: `Title ${index}` })),
    });

    expect(() => parseBackup(gzipSync(payload))).toThrow('more than 10,000');
  });
});
