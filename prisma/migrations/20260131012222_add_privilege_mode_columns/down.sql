-- Down migration for 20260131012222_add_privilege_mode_columns
-- WARNING: Dropping waitlist_entries loses all waitlist data.

-- Drop waitlist_entries table
DROP TABLE IF EXISTS "waitlist_entries";

-- Remove columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "privilege_mode_changed_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "privilege_mode_enabled";

-- Recreate the IVFFlat index that was dropped in the up migration
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
