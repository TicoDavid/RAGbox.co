-- 001_initial_schema.up.sql
-- Matches Prisma schema @@map table names exactly.
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Partner', 'Associate', 'Auditor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('Active', 'Suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vault_status AS ENUM ('open', 'closed', 'secure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE index_status AS ENUM ('Pending', 'Processing', 'Indexed', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE deletion_status AS ENUM ('Active', 'SoftDeleted', 'HardDeleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE query_outcome AS ENUM ('Answered', 'Refused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id                      TEXT PRIMARY KEY,
    email                   TEXT UNIQUE NOT NULL,
    name                    TEXT,
    image                   TEXT,
    role                    user_role NOT NULL DEFAULT 'Associate',
    status                  user_status NOT NULL DEFAULT 'Active',
    privilege_mode_enabled  BOOLEAN NOT NULL DEFAULT false,
    privilege_mode_changed_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at           TIMESTAMPTZ
);

-- Vaults
CREATE TABLE IF NOT EXISTS vaults (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    user_id            TEXT NOT NULL REFERENCES users(id),
    status             vault_status NOT NULL DEFAULT 'open',
    document_count     INT NOT NULL DEFAULT 0,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    vault_id        TEXT REFERENCES vaults(id),
    user_id         TEXT NOT NULL REFERENCES users(id),
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    file_type       TEXT NOT NULL,
    size_bytes      INT NOT NULL,
    storage_uri     TEXT,
    storage_path    TEXT,
    extracted_text  TEXT,
    index_status    index_status NOT NULL DEFAULT 'Pending',
    deletion_status deletion_status NOT NULL DEFAULT 'Active',
    is_privileged   BOOLEAN NOT NULL DEFAULT false,
    security_tier   INT NOT NULL DEFAULT 0,
    chunk_count     INT NOT NULL DEFAULT 0,
    checksum        TEXT,
    folder_id       TEXT,
    metadata        JSONB,
    deleted_at      TIMESTAMPTZ,
    hard_delete_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_deletion ON documents(user_id, deletion_status);
CREATE INDEX IF NOT EXISTS idx_documents_vault ON documents(vault_id);
CREATE INDEX IF NOT EXISTS idx_documents_security_tier ON documents(security_tier);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);

-- Document Chunks (with pgvector)
CREATE TABLE IF NOT EXISTS document_chunks (
    id           TEXT PRIMARY KEY,
    document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index  INT NOT NULL,
    content      TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    token_count  INT NOT NULL DEFAULT 0,
    embedding    vector(768),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);

-- Queries
CREATE TABLE IF NOT EXISTS queries (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id),
    query_text       TEXT NOT NULL,
    confidence_score DOUBLE PRECISION,
    outcome          query_outcome NOT NULL DEFAULT 'Answered',
    privilege_mode   BOOLEAN NOT NULL DEFAULT false,
    chunks_used      INT NOT NULL DEFAULT 0,
    latency_ms       INT,
    model            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);

-- Answers
CREATE TABLE IF NOT EXISTS answers (
    id          TEXT PRIMARY KEY,
    query_id    TEXT UNIQUE NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Citations
CREATE TABLE IF NOT EXISTS citations (
    id              TEXT PRIMARY KEY,
    answer_id       TEXT NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    document_id     TEXT NOT NULL REFERENCES documents(id),
    chunk_id        TEXT REFERENCES document_chunks(id),
    relevance_score DOUBLE PRECISION NOT NULL,
    excerpt         TEXT,
    citation_index  INT NOT NULL
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users(id),
    action        TEXT NOT NULL,
    resource_id   TEXT,
    resource_type TEXT,
    severity      TEXT NOT NULL DEFAULT 'INFO',
    details       JSONB,
    details_hash  TEXT,
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Folders
CREATE TABLE IF NOT EXISTS folders (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id),
    parent_id  TEXT REFERENCES folders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

-- Add FK from documents to folders (deferred because folders created after documents)
DO $$ BEGIN
    ALTER TABLE documents ADD CONSTRAINT fk_documents_folder
        FOREIGN KEY (folder_id) REFERENCES folders(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    user_id     TEXT NOT NULL DEFAULT 'system' REFERENCES users(id),
    category    TEXT,
    sections    JSONB,
    fields      JSONB,
    structure   JSONB,
    confidence  DOUBLE PRECISION DEFAULT 0.5,
    source_file TEXT,
    storage_uri TEXT,
    thumbnail   TEXT,
    usage_count INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);

-- Waitlist Entries
CREATE TABLE IF NOT EXISTS waitlist_entries (
    id         TEXT PRIMARY KEY,
    email      TEXT UNIQUE NOT NULL,
    source     TEXT,
    referrer   TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
