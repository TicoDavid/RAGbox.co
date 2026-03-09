-- Fix #45: KG table migrations not idempotent
-- The original 20260304_cygraph2026_knowledge_graph migration uses plain
-- CREATE TABLE / CREATE INDEX / ALTER TABLE ADD CONSTRAINT which fails on
-- re-run because the objects already exist.
--
-- This migration idempotently ensures all 5 KG tables, their indexes, and
-- foreign keys are present. Safe to run whether the original migration
-- succeeded fully, partially, or not at all.
--
-- Author: Zane Ignacio (Principal Product Engineer)
-- Date:   2026-03-08

-- ============================================
-- 1. Tables  (CREATE TABLE IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS "kg_entities" (
    "id"          TEXT NOT NULL,
    "tenant_id"   TEXT NOT NULL DEFAULT 'default',
    "name"        TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "canonical"   TEXT,
    "metadata"    JSONB,
    "merged_into" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kg_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kg_edges" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL DEFAULT 'default',
    "from_entity_id" TEXT NOT NULL,
    "to_entity_id"   TEXT NOT NULL,
    "relation_type"  TEXT NOT NULL,
    "weight"         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata"       JSONB,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kg_claims" (
    "id"                TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL DEFAULT 'default',
    "subject_entity_id" TEXT NOT NULL,
    "predicate"         TEXT NOT NULL,
    "object_value"      TEXT NOT NULL,
    "object_entity_id"  TEXT,
    "confidence"        DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status"            TEXT NOT NULL DEFAULT 'active',
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kg_provenance" (
    "id"           TEXT NOT NULL,
    "claim_id"     TEXT NOT NULL,
    "document_id"  TEXT NOT NULL,
    "chunk_id"     TEXT,
    "excerpt"      TEXT,
    "page_number"  INTEGER,
    "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_provenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kg_mentions" (
    "id"           TEXT NOT NULL,
    "entity_id"    TEXT NOT NULL,
    "document_id"  TEXT NOT NULL,
    "chunk_id"     TEXT,
    "mention_text" TEXT NOT NULL,
    "start_offset" INTEGER,
    "end_offset"   INTEGER,
    "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_mentions_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 2. Indexes  (CREATE INDEX IF NOT EXISTS)
-- ============================================

-- kg_entities
CREATE INDEX IF NOT EXISTS "kg_entities_tenant_id_entity_type_idx"
    ON "kg_entities"("tenant_id", "entity_type");
CREATE INDEX IF NOT EXISTS "kg_entities_tenant_id_name_idx"
    ON "kg_entities"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "kg_entities_merged_into_idx"
    ON "kg_entities"("merged_into");

-- kg_edges
CREATE INDEX IF NOT EXISTS "kg_edges_tenant_id_relation_type_idx"
    ON "kg_edges"("tenant_id", "relation_type");
CREATE INDEX IF NOT EXISTS "kg_edges_from_entity_id_idx"
    ON "kg_edges"("from_entity_id");
CREATE INDEX IF NOT EXISTS "kg_edges_to_entity_id_idx"
    ON "kg_edges"("to_entity_id");

-- kg_claims
CREATE INDEX IF NOT EXISTS "kg_claims_tenant_id_predicate_idx"
    ON "kg_claims"("tenant_id", "predicate");
CREATE INDEX IF NOT EXISTS "kg_claims_subject_entity_id_idx"
    ON "kg_claims"("subject_entity_id");
CREATE INDEX IF NOT EXISTS "kg_claims_status_idx"
    ON "kg_claims"("status");

-- kg_provenance
CREATE INDEX IF NOT EXISTS "kg_provenance_claim_id_idx"
    ON "kg_provenance"("claim_id");
CREATE INDEX IF NOT EXISTS "kg_provenance_document_id_idx"
    ON "kg_provenance"("document_id");

-- kg_mentions
CREATE INDEX IF NOT EXISTS "kg_mentions_entity_id_idx"
    ON "kg_mentions"("entity_id");
CREATE INDEX IF NOT EXISTS "kg_mentions_document_id_idx"
    ON "kg_mentions"("document_id");
CREATE INDEX IF NOT EXISTS "kg_mentions_document_id_entity_id_idx"
    ON "kg_mentions"("document_id", "entity_id");

-- ============================================
-- 3. Foreign Keys  (idempotent via DO $$ blocks)
--    PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS,
--    so we check pg_constraint and skip if present.
-- ============================================

-- kg_edges.from_entity_id -> kg_entities.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kg_edges_from_entity_id_fkey'
    ) THEN
        ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_from_entity_id_fkey"
            FOREIGN KEY ("from_entity_id") REFERENCES "kg_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- kg_edges.to_entity_id -> kg_entities.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kg_edges_to_entity_id_fkey'
    ) THEN
        ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_to_entity_id_fkey"
            FOREIGN KEY ("to_entity_id") REFERENCES "kg_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- kg_claims.subject_entity_id -> kg_entities.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kg_claims_subject_entity_id_fkey'
    ) THEN
        ALTER TABLE "kg_claims" ADD CONSTRAINT "kg_claims_subject_entity_id_fkey"
            FOREIGN KEY ("subject_entity_id") REFERENCES "kg_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- kg_provenance.claim_id -> kg_claims.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kg_provenance_claim_id_fkey'
    ) THEN
        ALTER TABLE "kg_provenance" ADD CONSTRAINT "kg_provenance_claim_id_fkey"
            FOREIGN KEY ("claim_id") REFERENCES "kg_claims"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- kg_mentions.entity_id -> kg_entities.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kg_mentions_entity_id_fkey'
    ) THEN
        ALTER TABLE "kg_mentions" ADD CONSTRAINT "kg_mentions_entity_id_fkey"
            FOREIGN KEY ("entity_id") REFERENCES "kg_entities"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
