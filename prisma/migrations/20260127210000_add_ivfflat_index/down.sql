-- Down migration for 20260127210000_add_ivfflat_index
DROP INDEX IF EXISTS idx_document_chunks_embedding;
