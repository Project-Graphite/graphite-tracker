CREATE TABLE "inbox_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "release_marker_id" UUID NOT NULL,
    "library_entry_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inbox_notifications_user_id_release_marker_id_key" ON "inbox_notifications"("user_id", "release_marker_id");
CREATE INDEX "inbox_notifications_user_id_created_at_idx" ON "inbox_notifications"("user_id", "created_at");
CREATE INDEX "inbox_notifications_library_entry_id_idx" ON "inbox_notifications"("library_entry_id");

ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_release_marker_id_fkey" FOREIGN KEY ("release_marker_id") REFERENCES "release_markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_library_entry_id_fkey" FOREIGN KEY ("library_entry_id") REFERENCES "library_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
