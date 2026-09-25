ALTER TABLE "catalog_items"
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "source_entries"
ADD COLUMN "available_chapter" DECIMAL(10,2),
ADD COLUMN "available_episode" INTEGER,
ADD COLUMN "last_seen_update" TEXT;

ALTER TABLE "library_entries"
ADD COLUMN "progress_season" INTEGER,
ADD COLUMN "progress_episode" INTEGER,
ADD COLUMN "progress_chapter" DECIMAL(10,2),
ADD COLUMN "progress_volume" DECIMAL(10,2),
ADD COLUMN "hours_played" DECIMAL(10,2),
ADD COLUMN "completion_percentage" INTEGER,
ADD COLUMN "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferred_source_id" UUID;

CREATE TABLE "global_source_preferences" (
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "global_source_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "category_source_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "category_source_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_source_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "user_source_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_source_preferences_user_id_category_key"
ON "category_source_preferences"("user_id", "category");

CREATE UNIQUE INDEX "user_source_settings_user_id_source_id_key"
ON "user_source_settings"("user_id", "source_id");

ALTER TABLE "library_entries"
ADD CONSTRAINT "library_entries_preferred_source_id_fkey"
FOREIGN KEY ("preferred_source_id") REFERENCES "source_records"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "global_source_preferences"
ADD CONSTRAINT "global_source_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "global_source_preferences"
ADD CONSTRAINT "global_source_preferences_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "source_records"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "category_source_preferences"
ADD CONSTRAINT "category_source_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_source_preferences"
ADD CONSTRAINT "category_source_preferences_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "source_records"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_source_settings"
ADD CONSTRAINT "user_source_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_source_settings"
ADD CONSTRAINT "user_source_settings_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "source_records"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "library_entries"
ADD CONSTRAINT "library_entries_completion_percentage_check"
CHECK ("completion_percentage" BETWEEN 0 AND 100);

ALTER TABLE "library_entries"
ADD CONSTRAINT "library_entries_progress_nonnegative_check"
CHECK (
    COALESCE("progress_season", 0) >= 0 AND
    COALESCE("progress_episode", 0) >= 0 AND
    COALESCE("progress_chapter", 0) >= 0 AND
    COALESCE("progress_volume", 0) >= 0 AND
    COALESCE("hours_played", 0) >= 0
);
