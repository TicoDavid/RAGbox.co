-- Cortex: working memory for conversation context and standing instructions
CREATE TABLE IF NOT EXISTS cortex_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),
    source_channel TEXT NOT NULL DEFAULT 'dashboard',
    source_message_id TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    topic TEXT,
    is_instruction BOOLEAN NOT NULL DEFAULT false,
    auto_summary TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cortex_entries_tenant ON cortex_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cortex_entries_captured ON cortex_entries(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortex_entries_instruction ON cortex_entries(tenant_id, is_instruction) WHERE is_instruction = true;
CREATE INDEX IF NOT EXISTS idx_cortex_entries_expires ON cortex_entries(expires_at) WHERE expires_at IS NOT NULL;

-- HNSW index for fast vector search (same pattern as document_chunks)
CREATE INDEX IF NOT EXISTS idx_cortex_entries_embedding ON cortex_entries
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
