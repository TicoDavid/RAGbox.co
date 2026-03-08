-- 016 down: Remove Go-backend-specific columns (preserve CyGraph-created columns)
ALTER TABLE mercury_proactive_insights
    DROP COLUMN IF EXISTS tenant_id,
    DROP COLUMN IF EXISTS document_id,
    DROP COLUMN IF EXISTS title,
    DROP COLUMN IF EXISTS source_chunk_id,
    DROP COLUMN IF EXISTS relevance_score,
    DROP COLUMN IF EXISTS expires_at,
    DROP COLUMN IF EXISTS acknowledged,
    DROP COLUMN IF EXISTS updated_at;

DROP INDEX IF EXISTS idx_insights_user_active;
DROP INDEX IF EXISTS idx_insights_relevance;
DROP INDEX IF EXISTS idx_insights_expires_at;
