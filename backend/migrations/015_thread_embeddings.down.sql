-- Rollback: S-P1-04 thread embeddings
DROP INDEX IF EXISTS idx_thread_msg_thread_embedding;
DROP INDEX IF EXISTS idx_thread_msg_embedding;
ALTER TABLE mercury_thread_messages DROP COLUMN IF EXISTS embedding;
