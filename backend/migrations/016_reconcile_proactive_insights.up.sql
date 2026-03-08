-- 016: Reconcile mercury_proactive_insights table
-- CyGraph (Prisma 20260305) created the table with CyGraph-specific columns.
-- Go backend scanner (EPIC-028 Phase 4) requires additional columns.
-- This migration adds Go-backend columns to the existing table.

-- If the table doesn't exist at all (e.g., Go migration runs first), create it.
CREATE TABLE IF NOT EXISTS mercury_proactive_insights (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    insight_type    TEXT NOT NULL,
    summary         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns needed by both CyGraph and Go backend
ALTER TABLE mercury_proactive_insights
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS document_id UUID,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS source_chunk_id UUID,
    ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS documents TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS relevance_score DOUBLE PRECISION DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_user_dismissed
    ON mercury_proactive_insights(user_id, dismissed);
CREATE INDEX IF NOT EXISTS idx_insights_user_active
    ON mercury_proactive_insights(user_id, acknowledged, expires_at);
CREATE INDEX IF NOT EXISTS idx_insights_relevance
    ON mercury_proactive_insights(user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_insights_expires_at
    ON mercury_proactive_insights(expires_at)
    WHERE expires_at IS NOT NULL;
