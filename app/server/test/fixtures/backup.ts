import { gzipSync } from 'node:zlib';
import { parse } from 'protobufjs';

const root = parse(`
syntax = "proto2";

message Backup {
  repeated BackupManga backupManga = 1;
  repeated BackupAnime legacyBackupAnime = 3;
  repeated BackupSource backupSources = 101;
  repeated BackupSource legacyBackupAnimeSources = 103;
  repeated BackupPreference backupPreferences = 104;
  optional bool isLegacy = 500;
  repeated BackupAnime backupAnime = 501;
  repeated BackupSource backupAnimeSources = 503;
}

message BackupManga {
  optional int64 source = 1;
  optional string url = 2;
  optional string title = 3;
  optional string author = 5;
  optional string description = 6;
  repeated string genre = 7;
  repeated BackupChapter chapters = 16;
  repeated int64 categories = 17;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100;
  optional int64 lastModifiedAt = 106;
}

message BackupAnime {
  optional int64 source = 1;
  optional string url = 2;
  optional string title = 3;
  repeated BackupEpisode episodes = 16;
  repeated BackupTracking tracking = 18;
  optional bool favorite = 100;
  optional double seasonNumber = 505;
}

message BackupChapter {
  optional string url = 1;
  optional string name = 2;
  optional bool read = 4;
  optional bool bookmark = 5;
  optional float chapterNumber = 9;
}

message BackupEpisode {
  optional string url = 1;
  optional bool seen = 4;
  optional float episodeNumber = 9;
  optional int64 totalSeconds = 16;
}

message BackupTracking {
  optional int32 syncId = 1;
  optional int64 libraryId = 2;
  optional string trackingUrl = 4;
  optional string title = 5;
  optional float lastChapterRead = 6;
  optional int32 status = 9;
}

message BackupSource {
  optional string name = 1;
  optional int64 sourceId = 2;
}

message BackupPreference {
  optional string key = 1;
}
`).root;

const backupType = root.lookupType('Backup');

export function encodeBackup(backup: Record<string, unknown>) {
  return Buffer.from(backupType.encode(backupType.fromObject(backup)).finish());
}

export function backupFile(backup: Record<string, unknown>) {
  return gzipSync(encodeBackup(backup));
}
