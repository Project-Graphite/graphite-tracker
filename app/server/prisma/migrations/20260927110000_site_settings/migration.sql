CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "adult_content_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
