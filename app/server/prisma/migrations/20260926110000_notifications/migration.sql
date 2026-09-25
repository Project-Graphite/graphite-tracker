CREATE TYPE "DigestCadence" AS ENUM ('daily', 'weekly');

CREATE TYPE "ReleaseKind" AS ENUM ('episode', 'chapter', 'release', 'release_date');

CREATE TYPE "NotificationState" AS ENUM ('queued', 'sent', 'skipped', 'failed');

ALTER TABLE "source_entries"
    ADD COLUMN "releases_checked_at" TIMESTAMP(3),
    ADD COLUMN "releases_attempted_at" TIMESTAMP(3);

CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "categories" "MediaCategory"[] NOT NULL DEFAULT ARRAY['movie', 'tv', 'anime', 'manga', 'manhwa', 'game']::"MediaCategory"[],
    "cadence" "DigestCadence" NOT NULL DEFAULT 'daily',
    "last_digest_at" TIMESTAMP(3),
    "delivery_failures" INTEGER NOT NULL DEFAULT 0,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "release_markers" (
    "id" UUID NOT NULL,
    "source_entry_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "ReleaseKind" NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT,
    "ordinal" DOUBLE PRECISION,
    "occurred_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_markers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "release_marker_id" UUID NOT NULL,
    "library_entry_id" UUID NOT NULL,
    "state" "NotificationState" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_markers_source_entry_id_key_key" ON "release_markers"("source_entry_id", "key");
CREATE UNIQUE INDEX "notification_events_user_id_release_marker_id_key" ON "notification_events"("user_id", "release_marker_id");
CREATE INDEX "notification_events_state_user_id_idx" ON "notification_events"("state", "user_id");
CREATE INDEX "notification_events_library_entry_id_idx" ON "notification_events"("library_entry_id");

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "release_markers" ADD CONSTRAINT "release_markers_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "source_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_release_marker_id_fkey" FOREIGN KEY ("release_marker_id") REFERENCES "release_markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
