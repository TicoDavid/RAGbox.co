-- Feedback Entries (replaces old feedback_reports table)
-- Drop old table if it exists (schema was never deployed with old shape)
DROP TABLE IF EXISTS "feedback_reports";

CREATE TABLE "feedback_entries" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"         TEXT NOT NULL,
    "user_email"      TEXT,
    "category"        TEXT NOT NULL,
    "message"         TEXT NOT NULL,
    "screenshot_url"  TEXT,
    "current_url"     TEXT,
    "browser_info"    TEXT,
    "status"          TEXT NOT NULL DEFAULT 'new',
    "admin_response"  TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "feedback_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_entries_user_id_idx" ON "feedback_entries"("user_id");
CREATE INDEX "feedback_entries_status_idx" ON "feedback_entries"("status");
CREATE INDEX "feedback_entries_created_at_idx" ON "feedback_entries"("created_at");

ALTER TABLE "feedback_entries"
    ADD CONSTRAINT "feedback_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
