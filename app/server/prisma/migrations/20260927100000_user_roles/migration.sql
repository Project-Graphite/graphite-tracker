CREATE TYPE "UserRole" AS ENUM ('member', 'admin', 'system_manager');

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'member';

UPDATE "users" SET "role" = 'admin' WHERE "is_admin";

ALTER TABLE "users" DROP COLUMN "is_admin";
