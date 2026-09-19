CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "MediaCategory" AS ENUM ('movie', 'tv', 'anime', 'manga', 'manhwa', 'game');

CREATE TYPE "LibraryState" AS ENUM ('planned', 'in_progress', 'completed', 'dropped');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "bio" TEXT,
    "verified_at" TIMESTAMP(3),
    "time_zone" TEXT NOT NULL DEFAULT 'Etc/UTC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_privacy" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "show_library" BOOLEAN NOT NULL DEFAULT false,
    "show_activity" BOOLEAN NOT NULL DEFAULT false,
    "show_ratings" BOOLEAN NOT NULL DEFAULT false,
    "show_reviews" BOOLEAN NOT NULL DEFAULT false,
    "show_statistics" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "profile_privacy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_items" (
    "id" UUID NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "canonical_title" TEXT NOT NULL,
    "alternate_titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synopsis" TEXT,
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "release_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_records" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "categories" "MediaCategory"[],
    "languages" TEXT[],
    "capabilities" TEXT[],
    "attribution" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_entries" (
    "id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "canonical_url" TEXT,
    "language" TEXT,
    "source_title" TEXT NOT NULL,
    "last_refreshed_at" TIMESTAMP(3),
    CONSTRAINT "source_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "state" "LibraryState" NOT NULL DEFAULT 'planned',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "library_status_events" (
    "id" UUID NOT NULL,
    "library_entry_id" UUID NOT NULL,
    "old_state" "LibraryState",
    "new_state" "LibraryState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_status_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");
CREATE UNIQUE INDEX "profile_privacy_user_id_key" ON "profile_privacy"("user_id");
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");
CREATE INDEX "verification_tokens_user_id_idx" ON "verification_tokens"("user_id");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");
CREATE INDEX "catalog_items_category_canonical_title_idx" ON "catalog_items"("category", "canonical_title");
CREATE UNIQUE INDEX "source_records_key_key" ON "source_records"("key");
CREATE INDEX "source_entries_catalog_item_id_idx" ON "source_entries"("catalog_item_id");
CREATE UNIQUE INDEX "source_entries_source_id_external_id_key" ON "source_entries"("source_id", "external_id");
CREATE INDEX "library_entries_user_id_state_idx" ON "library_entries"("user_id", "state");
CREATE UNIQUE INDEX "library_entries_user_id_catalog_item_id_key" ON "library_entries"("user_id", "catalog_item_id");
CREATE INDEX "library_status_events_library_entry_id_created_at_idx" ON "library_status_events"("library_entry_id", "created_at");

ALTER TABLE "profile_privacy" ADD CONSTRAINT "profile_privacy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "source_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "library_status_events" ADD CONSTRAINT "library_status_events_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
