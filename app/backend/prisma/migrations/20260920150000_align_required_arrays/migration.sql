UPDATE "catalog_items"
SET "alternate_titles" = ARRAY[]::TEXT[]
WHERE "alternate_titles" IS NULL;

UPDATE "source_records"
SET
    "categories" = COALESCE("categories", ARRAY[]::"MediaCategory"[]),
    "languages" = COALESCE("languages", ARRAY[]::TEXT[]),
    "capabilities" = COALESCE("capabilities", ARRAY[]::TEXT[]);

UPDATE "library_entries"
SET "platforms" = ARRAY[]::TEXT[]
WHERE "platforms" IS NULL;

ALTER TABLE "catalog_items"
ALTER COLUMN "alternate_titles" SET NOT NULL;

ALTER TABLE "source_records"
ALTER COLUMN "categories" SET DEFAULT ARRAY[]::"MediaCategory"[],
ALTER COLUMN "categories" SET NOT NULL,
ALTER COLUMN "languages" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "languages" SET NOT NULL,
ALTER COLUMN "capabilities" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "capabilities" SET NOT NULL;

ALTER TABLE "library_entries"
ALTER COLUMN "platforms" SET NOT NULL;
