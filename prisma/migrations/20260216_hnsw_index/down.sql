-- Down migration for 20260216_hnsw_index
DROP INDEX IF EXISTS document_chunks_embedding_hnsw;
