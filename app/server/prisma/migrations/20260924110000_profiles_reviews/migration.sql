CREATE TYPE "ReviewVisibility" AS ENUM ('public', 'private');

CREATE TYPE "ReportReason" AS ENUM ('spam', 'abuse', 'spoilers', 'other');

CREATE TYPE "ReportResolution" AS ENUM ('dismissed', 'hidden');

CREATE TYPE "ActivityKind" AS ENUM ('added', 'state_changed', 'rated', 'reviewed');

CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "rating" INTEGER,
    "title" TEXT,
    "body" TEXT,
    "contains_spoilers" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ReviewVisibility" NOT NULL DEFAULT 'private',
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 10),
    CONSTRAINT "reviews_title_length_check" CHECK (char_length("title") <= 200),
    CONSTRAINT "reviews_body_length_check" CHECK (char_length("body") <= 10000),
    CONSTRAINT "reviews_content_check" CHECK ("rating" IS NOT NULL OR "body" IS NOT NULL)
);

CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "resolution" "ReportResolution",
    "moderator_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "library_entry_id" UUID,
    "review_id" UUID,
    "state" "LibraryState",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reviews_catalog_item_id_visibility_idx" ON "reviews"("catalog_item_id", "visibility");
CREATE UNIQUE INDEX "reviews_user_id_catalog_item_id_key" ON "reviews"("user_id", "catalog_item_id");
CREATE INDEX "review_reports_resolution_created_at_idx" ON "review_reports"("resolution", "created_at");
CREATE UNIQUE INDEX "review_reports_reporter_id_review_id_key" ON "review_reports"("reporter_id", "review_id");
CREATE INDEX "activity_events_user_id_created_at_idx" ON "activity_events"("user_id", "created_at");

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
