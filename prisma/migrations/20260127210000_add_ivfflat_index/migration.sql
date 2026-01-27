-- Add IVFFlat index on document_chunks.embedding for faster cosine similarity search
-- IVFFlat requires at least some data to build the index, but it works with empty tables too
-- lists = 100 is a good starting point; tune based on row count (sqrt(n) is a common heuristic)

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
