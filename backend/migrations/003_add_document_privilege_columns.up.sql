-- 003_add_document_privilege_columns.up.sql
-- Adds privilege and tenant columns to documents table.
-- These columns were previously managed by the frontend migration
-- but must run from the Go backend because it owns the documents table.
-- Idempotent: safe to run multiple times.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'privilege_level'
    ) THEN
        ALTER TABLE documents ADD COLUMN privilege_level TEXT NOT NULL DEFAULT 'standard';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'is_restricted'
    ) THEN
        ALTER TABLE documents ADD COLUMN is_restricted BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'access_list'
    ) THEN
        ALTER TABLE documents ADD COLUMN access_list TEXT[] DEFAULT '{}';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'classified_at'
    ) THEN
        ALTER TABLE documents ADD COLUMN classified_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'classified_by'
    ) THEN
        ALTER TABLE documents ADD COLUMN classified_by TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- Index for tenant isolation queries
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
