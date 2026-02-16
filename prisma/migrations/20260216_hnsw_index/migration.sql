-- HNSW index on document_chunks embedding column for fast vector search
-- text-embedding-004 produces 768-dimensional vectors
-- Using cosine distance (vector_cosine_ops) to match the Go backend's similarity search

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
