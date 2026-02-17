-- Phase 21: Knowledge Events (Webhook Ingestion)

-- Create enum for knowledge event status
DO $$ BEGIN
  CREATE TYPE "knowledge_event_status" AS ENUM ('received', 'processing', 'indexed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create knowledge_events table
CREATE TABLE IF NOT EXISTS "knowledge_events" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_name" TEXT,
  "title" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "status" "knowledge_event_status" NOT NULL DEFAULT 'received',
  "document_id" TEXT,
  "privilege_level" TEXT NOT NULL DEFAULT 'standard',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "expires_at" TIMESTAMP(3),
  "callback_url" TEXT,
  "error_details" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_events_pkey" PRIMARY KEY ("id")
);

-- Idempotency: one event_id per tenant
DO $$ BEGIN
  ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_tenant_id_event_id_key" UNIQUE ("tenant_id", "event_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "knowledge_events_tenant_id_status_idx" ON "knowledge_events"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "knowledge_events_user_id_created_at_idx" ON "knowledge_events"("user_id", "created_at" DESC);

-- Foreign key
DO $$ BEGIN
  ALTER TABLE "knowledge_events" ADD CONSTRAINT "knowledge_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
