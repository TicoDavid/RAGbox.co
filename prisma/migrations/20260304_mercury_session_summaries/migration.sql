-- E24-002: Mercury Session Summaries for cross-session memory
CREATE TABLE IF NOT EXISTS "mercury_session_summaries" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"       TEXT NOT NULL,
    "thread_id"     TEXT,
    "summary"       TEXT NOT NULL,
    "topics"        TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decisions"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action_items"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "persona"       TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mercury_session_summaries_pkey" PRIMARY KEY ("id")
);

-- Foreign key to users
ALTER TABLE "mercury_session_summaries"
    ADD CONSTRAINT "mercury_session_summaries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for loading last N summaries per user
CREATE INDEX "mercury_session_summaries_user_id_created_at_idx"
    ON "mercury_session_summaries"("user_id", "created_at" DESC);
