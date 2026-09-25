CREATE TYPE "ImportState" AS ENUM ('parsing', 'matching', 'ready', 'applying', 'applied', 'failed');

CREATE TYPE "ImportConflictPolicy" AS ENUM ('add_missing', 'keep_greater_progress');

CREATE TYPE "ImportMatch" AS ENUM ('pending', 'exact', 'suggested', 'unmatched', 'duplicate', 'unsupported');

CREATE TYPE "ImportDecision" AS ENUM ('accept', 'skip');

CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_app" TEXT,
    "file_digest" TEXT NOT NULL,
    "state" "ImportState" NOT NULL DEFAULT 'parsing',
    "conflict_policy" "ImportConflictPolicy" NOT NULL DEFAULT 'add_missing',
    "error" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_candidates" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tracker_titles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source_name" TEXT,
    "source_url" TEXT,
    "mangadex_id" TEXT,
    "progress" DECIMAL(10,2),
    "state" "LibraryState" NOT NULL,
    "match" "ImportMatch" NOT NULL DEFAULT 'pending',
    "issue" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "choice" INTEGER,
    "decision" "ImportDecision",
    "outcome" TEXT,
    "catalog_item_id" UUID,
    CONSTRAINT "import_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imported_source_references" (
    "id" UUID NOT NULL,
    "library_entry_id" UUID NOT NULL,
    "batch_id" UUID,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "imported_source_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");
CREATE INDEX "import_batches_expires_at_idx" ON "import_batches"("expires_at");
CREATE INDEX "import_candidates_batch_id_match_idx" ON "import_candidates"("batch_id", "match");
CREATE UNIQUE INDEX "import_candidates_batch_id_position_key" ON "import_candidates"("batch_id", "position");
CREATE UNIQUE INDEX "imported_source_references_library_entry_id_source_name_sou_key" ON "imported_source_references"("library_entry_id", "source_name", "source_url");

ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imported_source_references" ADD CONSTRAINT "imported_source_references_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imported_source_references" ADD CONSTRAINT "imported_source_references_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
