-- STORY-104: ROAM Connection Health + Dead Letter Queue
-- Adds health monitoring fields to roam_integrations and creates DLQ table

-- Add health fields to roam_integrations
ALTER TABLE "roam_integrations"
  ADD COLUMN IF NOT EXISTS "last_health_check_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "error_reason" TEXT;

-- Create dead letter queue table
CREATE TABLE IF NOT EXISTS "roam_dead_letters" (
  "id"                TEXT        NOT NULL,
  "tenant_id"         TEXT        NOT NULL,
  "pubsub_message_id" TEXT        NOT NULL,
  "event_type"        TEXT        NOT NULL,
  "payload"           JSONB       NOT NULL,
  "error_message"     TEXT        NOT NULL,
  "error_status"      INTEGER,
  "attempt_count"     INTEGER     NOT NULL DEFAULT 1,
  "retried"           BOOLEAN     NOT NULL DEFAULT false,
  "retried_at"        TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "roam_dead_letters_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "roam_dead_letters_pubsub_message_id_key"
  ON "roam_dead_letters" ("pubsub_message_id");

CREATE INDEX IF NOT EXISTS "roam_dead_letters_tenant_id_created_at_idx"
  ON "roam_dead_letters" ("tenant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "roam_dead_letters_retried_idx"
  ON "roam_dead_letters" ("retried");
