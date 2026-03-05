-- CyGraph2026 — Knowledge Graph Tables (Q3 VERITAS Prep)
-- Empty tables, zero data risk. Schema-only migration.
-- Author: Dr. Insane (QA Certification Lead)
-- Date: 2026-03-04

-- ============================================
-- kg_entities — Knowledge graph nodes
-- ============================================
CREATE TABLE "kg_entities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "canonical" TEXT,
    "metadata" JSONB,
    "merged_into" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kg_entities_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- kg_edges — Relationships between entities
-- ============================================
CREATE TABLE "kg_edges" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "from_entity_id" TEXT NOT NULL,
    "to_entity_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_edges_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- kg_claims — Factual claims from documents
-- ============================================
CREATE TABLE "kg_claims" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "subject_entity_id" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object_value" TEXT NOT NULL,
    "object_entity_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_claims_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- kg_provenance — Source tracking for claims
-- ============================================
CREATE TABLE "kg_provenance" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_id" TEXT,
    "excerpt" TEXT,
    "page_number" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_provenance_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- kg_mentions — Entity mentions in documents
-- ============================================
CREATE TABLE "kg_mentions" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_id" TEXT,
    "mention_text" TEXT NOT NULL,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kg_mentions_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- Indexes
-- ============================================

-- kg_entities
CREATE INDEX "kg_entities_tenant_id_entity_type_idx" ON "kg_entities"("tenant_id", "entity_type");
CREATE INDEX "kg_entities_tenant_id_name_idx" ON "kg_entities"("tenant_id", "name");
CREATE INDEX "kg_entities_merged_into_idx" ON "kg_entities"("merged_into");

-- kg_edges
CREATE INDEX "kg_edges_tenant_id_relation_type_idx" ON "kg_edges"("tenant_id", "relation_type");
CREATE INDEX "kg_edges_from_entity_id_idx" ON "kg_edges"("from_entity_id");
CREATE INDEX "kg_edges_to_entity_id_idx" ON "kg_edges"("to_entity_id");

-- kg_claims
CREATE INDEX "kg_claims_tenant_id_predicate_idx" ON "kg_claims"("tenant_id", "predicate");
CREATE INDEX "kg_claims_subject_entity_id_idx" ON "kg_claims"("subject_entity_id");
CREATE INDEX "kg_claims_status_idx" ON "kg_claims"("status");

-- kg_provenance
CREATE INDEX "kg_provenance_claim_id_idx" ON "kg_provenance"("claim_id");
CREATE INDEX "kg_provenance_document_id_idx" ON "kg_provenance"("document_id");

-- kg_mentions
CREATE INDEX "kg_mentions_entity_id_idx" ON "kg_mentions"("entity_id");
CREATE INDEX "kg_mentions_document_id_idx" ON "kg_mentions"("document_id");
CREATE INDEX "kg_mentions_document_id_entity_id_idx" ON "kg_mentions"("document_id", "entity_id");

-- ============================================
-- Foreign Keys
-- ============================================

-- kg_edges → kg_entities
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_from_entity_id_fkey"
    FOREIGN KEY ("from_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_to_entity_id_fkey"
    FOREIGN KEY ("to_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- kg_claims → kg_entities
ALTER TABLE "kg_claims" ADD CONSTRAINT "kg_claims_subject_entity_id_fkey"
    FOREIGN KEY ("subject_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- kg_provenance → kg_claims
ALTER TABLE "kg_provenance" ADD CONSTRAINT "kg_provenance_claim_id_fkey"
    FOREIGN KEY ("claim_id") REFERENCES "kg_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- kg_mentions → kg_entities
ALTER TABLE "kg_mentions" ADD CONSTRAINT "kg_mentions_entity_id_fkey"
    FOREIGN KEY ("entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
