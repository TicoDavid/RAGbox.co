-- S-P1-04: Thread-to-Vault RAG — embed Mercury thread messages for total memory recall
-- Adds embedding column + IVFFlat index for similarity search on conversation messages.

ALTER TABLE mercury_thread_messages
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- IVFFlat index for cosine similarity search
-- lists=100 is suitable for up to ~100K messages per user
CREATE INDEX IF NOT EXISTS idx_thread_msg_embedding
  ON mercury_thread_messages
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Composite index for user-scoped thread search
CREATE INDEX IF NOT EXISTS idx_thread_msg_thread_embedding
  ON mercury_thread_messages (thread_id)
  WHERE embedding IS NOT NULL;
