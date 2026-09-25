CREATE TYPE "TokenPurpose" AS ENUM ('verify_email', 'change_email', 'reset_password');

ALTER TABLE "verification_tokens"
    ADD COLUMN "email" TEXT,
    ADD COLUMN "purpose" "TokenPurpose" NOT NULL DEFAULT 'verify_email';
