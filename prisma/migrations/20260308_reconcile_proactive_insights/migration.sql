-- Reconcile mercury_proactive_insights table schema
-- CyGraph (20260305 migration) created the table with: id, user_id, insight_type, summary, entities, documents, confidence, dismissed, created_at
-- Go backend scanner (EPIC-028 Phase 4) expects: tenant_id, document_id, title, source_chunk_id, relevance_score, expires_at, acknowledged, updated_at
-- This migration adds the missing Go-backend columns to the existing CyGraph table.

ALTER TABLE "mercury_proactive_insights"
  ADD COLUMN IF NOT EXISTS "tenant_id" TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "document_id" UUID,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "source_chunk_id" UUID,
  ADD COLUMN IF NOT EXISTS "relevance_score" DOUBLE PRECISION DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "acknowledged" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- Go backend indexes
CREATE INDEX IF NOT EXISTS "idx_insights_user_active"
  ON "mercury_proactive_insights"("user_id", "acknowledged", "expires_at");
CREATE INDEX IF NOT EXISTS "idx_insights_relevance"
  ON "mercury_proactive_insights"("user_id", "relevance_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_insights_expires_at"
  ON "mercury_proactive_insights"("expires_at")
  WHERE "expires_at" IS NOT NULL;
