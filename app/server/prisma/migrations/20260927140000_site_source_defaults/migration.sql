CREATE TABLE "site_source_defaults" (
    "category" "MediaCategory" NOT NULL,
    "source_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_source_defaults_pkey" PRIMARY KEY ("category")
);

ALTER TABLE "site_source_defaults"
ADD CONSTRAINT "site_source_defaults_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "source_records"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
