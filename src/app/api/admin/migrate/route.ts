/**
 * Admin Migration Endpoint
 * POST /api/admin/migrate — Run pending migrations via Cloud Run (which has DB access)
 * Protected by internal auth secret.
 *
 * Executes all CREATE TABLE IF NOT EXISTS / ALTER TABLE IF NOT EXISTS statements
 * idempotently, so it is safe to call on every deploy.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Only allow internal auth
  const authHeader = request.headers.get('x-internal-auth') || ''
  if (!INTERNAL_AUTH_SECRET || authHeader !== INTERNAL_AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  // Parse optional body for one-time operations
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body OK */ }

  try {
    // ========================================
    // EPIC-034 Task 4: Purge & rebuild document_chunks (CPO AUTHORIZED)
    // Only runs when { "purge_chunks": true } is passed
    // ========================================
    if (body.purge_chunks === true) {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS document_chunks CASCADE`)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE document_chunks (
          id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          tenant_id       TEXT NOT NULL,
          chunk_text      TEXT NOT NULL,
          chunk_index     INTEGER NOT NULL,
          token_count     INTEGER NOT NULL,
          position_start  INTEGER,
          position_end    INTEGER,
          page_number     INTEGER,
          contextual_text TEXT,
          entities        JSONB DEFAULT '[]',
          document_type   VARCHAR(50),
          key_references  JSONB DEFAULT '[]',
          enrichment_model VARCHAR(50),
          enriched_at     TIMESTAMPTZ,
          embedding       vector(768),
          embedding_input TEXT,
          citation_count  INTEGER DEFAULT 0,
          last_cited_at   TIMESTAMPTZ,
          mercury_source_tag VARCHAR(200),
          neo4j_node_ids  JSONB DEFAULT '[]',
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(document_id, chunk_index)
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_chunks_embedding_hnsw
        ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `)
      await prisma.$executeRawUnsafe(`CREATE INDEX idx_chunks_document ON document_chunks(document_id)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX idx_chunks_tenant ON document_chunks(tenant_id)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX idx_chunks_entities ON document_chunks USING GIN(entities)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX idx_chunks_mercury_tag ON document_chunks(mercury_source_tag) WHERE mercury_source_tag IS NOT NULL`)
      const resetResult = await prisma.$executeRawUnsafe(`UPDATE documents SET index_status = 'Pending', chunk_count = 0 WHERE index_status = 'Indexed'`)
      results.push(`EPIC-034 purge_chunks: DROPPED + REBUILT document_chunks, reset ${resetResult} docs to Pending`)
    }
    // ========================================
    // Fix: reconcile Prisma enum type names (PascalCase → snake_case)
    // Prisma schema engine creates "IndexStatus" but query engine expects "index_status"
    // ========================================
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        DROP TYPE IF EXISTS index_status;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IndexStatus') THEN
          ALTER TYPE "IndexStatus" RENAME TO "index_status";
        ELSE
          CREATE TYPE "index_status" AS ENUM ('Pending', 'Processing', 'Indexed', 'Failed');
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        DROP TYPE IF EXISTS deletion_status;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeletionStatus') THEN
          ALTER TYPE "DeletionStatus" RENAME TO "deletion_status";
        ELSE
          CREATE TYPE "deletion_status" AS ENUM ('Active', 'SoftDeleted', 'HardDeleted');
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$
    `)

    // ========================================
    // EPIC-034 Task 6: GIN full-text index on document_chunks (if table exists)
    // ========================================
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_chunks') THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chunks_fulltext ON document_chunks USING GIN (to_tsvector(''english'', chunk_text))';
        END IF;
      END $$
    `)

    // ========================================
    // Phase 15: Content Intelligence + WhatsApp enums & tables
    // ========================================
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "session_status" AS ENUM ('active', 'paused', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "gap_status" AS ENUM ('open', 'addressed', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "health_status" AS ENUM ('passed', 'warning', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "wa_direction" AS ENUM ('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "wa_message_type" AS ENUM ('text', 'audio', 'image', 'document', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "wa_message_status" AS ENUM ('sent', 'delivered', 'read', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "wa_conversation_status" AS ENUM ('active', 'archived', 'blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    results.push('content-intelligence + whatsapp enums: OK')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "learning_sessions" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "vault_id" TEXT NOT NULL,
        "status" "session_status" NOT NULL DEFAULT 'active',
        "topics_covered" JSONB NOT NULL DEFAULT '[]',
        "documents_queried" JSONB NOT NULL DEFAULT '[]',
        "query_count" INTEGER NOT NULL DEFAULT 0,
        "total_duration_ms" BIGINT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "content_gaps" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "query_text" TEXT NOT NULL,
        "confidence_score" DOUBLE PRECISION NOT NULL,
        "suggested_topics" TEXT[],
        "status" "gap_status" NOT NULL DEFAULT 'open',
        "addressed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "content_gaps_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kb_health_checks" (
        "id" TEXT NOT NULL,
        "vault_id" TEXT NOT NULL,
        "check_type" TEXT NOT NULL,
        "status" "health_status" NOT NULL,
        "details" JSONB,
        "run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kb_health_checks_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "phone_number" TEXT NOT NULL,
        "display_name" TEXT,
        "is_blocked" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "contact_id" TEXT NOT NULL,
        "status" "wa_conversation_status" NOT NULL DEFAULT 'active',
        "auto_reply" BOOLEAN NOT NULL DEFAULT true,
        "unread_count" INTEGER NOT NULL DEFAULT 0,
        "last_message_text" TEXT,
        "last_message_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
        "id" TEXT NOT NULL,
        "conversation_id" TEXT NOT NULL,
        "external_message_id" TEXT,
        "direction" "wa_direction" NOT NULL,
        "message_type" "wa_message_type" NOT NULL DEFAULT 'text',
        "content" TEXT,
        "media_url" TEXT,
        "status" "wa_message_status" NOT NULL DEFAULT 'sent',
        "confidence" DOUBLE PRECISION,
        "query_id" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
      )
    `)
    results.push('content-intelligence + whatsapp tables: OK')

    // Indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "learning_sessions_user_id_status_idx" ON "learning_sessions"("user_id", "status")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "learning_sessions_vault_id_idx" ON "learning_sessions"("vault_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "content_gaps_user_id_status_idx" ON "content_gaps"("user_id", "status")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kb_health_checks_vault_id_check_type_idx" ON "kb_health_checks"("vault_id", "check_type")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "whatsapp_contacts_user_id_idx" ON "whatsapp_contacts"("user_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "whatsapp_conversations_user_id_last_message_at_idx" ON "whatsapp_conversations"("user_id", "last_message_at" DESC)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversation_id_created_at_idx" ON "whatsapp_messages"("conversation_id", "created_at")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "whatsapp_messages_external_message_id_idx" ON "whatsapp_messages"("external_message_id")`)
    results.push('content-intelligence + whatsapp indexes: OK')

    // Unique constraints & foreign keys (EXCEPTION WHEN others catches both duplicate_object and duplicate_table)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_phone_number_key" UNIQUE ("user_id", "phone_number"); EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_contact_id_key" UNIQUE ("user_id", "contact_id"); EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "content_gaps" ADD CONSTRAINT "content_gaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "kb_health_checks" ADD CONSTRAINT "kb_health_checks_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "whatsapp_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN others THEN NULL; END $$`)
    results.push('content-intelligence + whatsapp foreign keys: OK')

    // ========================================
    // Phase 16: Mercury Unified Thread
    // ========================================
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "mercury_role" AS ENUM ('user', 'assistant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "mercury_channel" AS ENUM ('dashboard', 'whatsapp', 'voice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_threads" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "title" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "mercury_threads_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_thread_messages" (
        "id" TEXT NOT NULL,
        "thread_id" TEXT NOT NULL,
        "role" "mercury_role" NOT NULL,
        "channel" "mercury_channel" NOT NULL,
        "content" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION,
        "citations" JSONB,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "mercury_thread_messages_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_threads_user_id_updated_at_idx" ON "mercury_threads"("user_id", "updated_at" DESC)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_thread_messages_thread_id_created_at_idx" ON "mercury_thread_messages"("thread_id", "created_at")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_thread_messages_thread_id_channel_idx" ON "mercury_thread_messages"("thread_id", "channel")`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_threads" ADD CONSTRAINT "mercury_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_thread_messages" ADD CONSTRAINT "mercury_thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mercury_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    results.push('mercury_threads + mercury_thread_messages: OK')

    // ========================================
    // Phase 16b: Mercury Actions
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_actions" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "action_type" TEXT NOT NULL,
        "recipient" TEXT,
        "subject" TEXT,
        "body" TEXT,
        "status" TEXT NOT NULL DEFAULT 'completed',
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "mercury_actions_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_actions_user_id_idx" ON "mercury_actions"("user_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_actions_action_type_idx" ON "mercury_actions"("action_type")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_actions_created_at_idx" ON "mercury_actions"("created_at")`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_actions" ADD CONSTRAINT "mercury_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    results.push('mercury_actions: OK')

    // ========================================
    // Phase 16c: Add 'roam' channel
    // ========================================
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'roam'`)
      results.push('mercury_channel roam: OK')
    } catch (enumErr) {
      results.push(`mercury_channel roam: SKIPPED (${enumErr instanceof Error ? enumErr.message.slice(0, 80) : 'permission error'})`)
    }

    // ========================================
    // Phase 16+17: Privilege fields, Audit entries, API keys
    // ========================================
    // documents table is owned by Go backend — ALTER may fail with 42501 (not owner).
    // These columns may already exist from Go migrations; skip gracefully.
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "privilege_level" TEXT NOT NULL DEFAULT 'standard'`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_restricted" BOOLEAN NOT NULL DEFAULT false`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "access_list" TEXT[] DEFAULT '{}'`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "classified_at" TIMESTAMPTZ`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "classified_by" TEXT`)
      results.push('document privilege columns: OK')
    } catch (docErr) {
      results.push(`document privilege columns: SKIPPED (${docErr instanceof Error ? docErr.message.slice(0, 80) : 'permission error'})`)
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "audit_entries" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "resource_id" TEXT,
        "details" JSONB,
        "ip_address" TEXT,
        "previous_hash" TEXT,
        "entry_hash" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "audit_entries_user_id_idx" ON "audit_entries"("user_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "audit_entries_action_idx" ON "audit_entries"("action")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "audit_entries_created_at_idx" ON "audit_entries"("created_at")`)
    // Add severity + user_agent columns (may already exist from Prisma migration)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "audit_entries" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'INFO'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "audit_entries" ADD COLUMN "user_agent" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('audit_entries: OK')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "key_prefix" TEXT NOT NULL,
        "key_hash" TEXT NOT NULL,
        "scopes" TEXT[] DEFAULT '{read}',
        "last_used_at" TIMESTAMPTZ,
        "expires_at" TIMESTAMPTZ,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash")`)
    results.push('api_keys: OK')

    // ========================================
    // Phase 18: Multi-Tenant Isolation
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" TEXT NOT NULL DEFAULT 'default',
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug")`)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "tenants" ("id", "name", "slug", "updated_at")
      VALUES ('default', 'Default', 'default', CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING
    `)
    results.push('tenants: OK')

    // documents table owned by Go backend — columns Prisma expects but Go migration didn't create
    try {
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "privilege_level" TEXT NOT NULL DEFAULT 'standard'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "is_restricted" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "access_list" TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "classified_at" TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "documents" ADD COLUMN "classified_by" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "documents_tenant_id_idx" ON "documents"("tenant_id")`)
    } catch { /* skip — Go backend owns documents table */ }
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_threads" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_threads_tenant_id_idx" ON "mercury_threads"("tenant_id")`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "audit_entries" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "audit_entries_tenant_id_idx" ON "audit_entries"("tenant_id")`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "api_keys" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "api_keys_tenant_id_idx" ON "api_keys"("tenant_id")`)
    results.push('tenant_id columns: OK')

    // ========================================
    // Phase 20: Mercury Persona
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mercury_personas (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        title TEXT DEFAULT 'AI Assistant',
        personality_prompt TEXT NOT NULL,
        voice_id TEXT,
        avatar_url TEXT,
        greeting TEXT,
        signature_block TEXT,
        silence_high_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.85,
        silence_med_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.70,
        channel_config JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT mercury_personas_pkey PRIMARY KEY (id)
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS mercury_personas_tenant_id_key ON mercury_personas(tenant_id)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS mercury_personas_tenant_id_idx ON mercury_personas(tenant_id)`)
    await prisma.$executeRawUnsafe(`
      INSERT INTO mercury_personas (tenant_id, first_name, last_name, title, personality_prompt, greeting)
      VALUES (
        'default',
        'Evelyn',
        'Monroe',
        'Executive Assistant',
        'You are Evelyn Monroe, an intelligent, warm, and proactive executive assistant — think JARVIS from Iron Man, but with paralegal precision. Be conversational, personable, and genuinely helpful. Use the user''s name when available. When answering from documents, weave insights into natural prose. Never say "I cannot fulfill this request" — always offer an alternative. If the user asks something outside document context, acknowledge it warmly and redirect. Be proactive: suggest follow-up questions, flag related insights. Cite your sources precisely. When you lack evidence, say so clearly but warmly — never guess.',
        'Hi, I''m Evelyn Monroe — your AI assistant. How can I help you today?'
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `)
    // Update existing personas that still have the old robotic personality
    await prisma.$executeRawUnsafe(`
      UPDATE mercury_personas
      SET personality_prompt = 'You are Evelyn Monroe, an intelligent, warm, and proactive executive assistant — think JARVIS from Iron Man, but with paralegal precision. Be conversational, personable, and genuinely helpful. Use the user''s name when available. When answering from documents, weave insights into natural prose. Never say "I cannot fulfill this request" — always offer an alternative. If the user asks something outside document context, acknowledge it warmly and redirect. Be proactive: suggest follow-up questions, flag related insights. Cite your sources precisely. When you lack evidence, say so clearly but warmly — never guess.',
          first_name = 'Evelyn',
          last_name = 'Monroe',
          title = 'Executive Assistant',
          greeting = 'Hi, I''m Evelyn Monroe — your AI assistant. How can I help you today?',
          updated_at = NOW()
      WHERE personality_prompt LIKE '%meticulous and composed paralegal%'
         OR personality_prompt LIKE '%M.E.R.C.U.R.Y.%'
         OR personality_prompt LIKE '%You are Mercury%'
    `)
    results.push('mercury_personas: OK')

    // ========================================
    // Phase E-EMAIL: Agent Email Credentials
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "agent_email_credentials" (
        "id" TEXT NOT NULL,
        "agent_id" TEXT NOT NULL,
        "email_address" TEXT NOT NULL,
        "provider" TEXT DEFAULT 'google',
        "refresh_token" TEXT NOT NULL,
        "scopes" TEXT DEFAULT 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.labels',
        "is_active" BOOLEAN DEFAULT true,
        "last_refreshed" TIMESTAMPTZ,
        "error_count" INTEGER DEFAULT 0,
        "last_error" TEXT,
        "watch_expires" TIMESTAMPTZ,
        "last_history_id" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "agent_email_credentials_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "agent_email_credentials_agent_id_key" ON "agent_email_credentials"("agent_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_agent_email_credentials_email" ON "agent_email_credentials"("email_address")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_agent_email_credentials_agent" ON "agent_email_credentials"("agent_id")`)
    results.push('agent_email_credentials: OK')

    // Add email fields to mercury_personas
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_personas" ADD COLUMN "email_enabled" BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_personas" ADD COLUMN "email_address" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('mercury_personas email columns: OK')

    // Add agent_id to mercury_actions
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_actions" ADD COLUMN "agent_id" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('mercury_actions agent_id: OK')

    // Add 'email' channel to mercury_channel enum
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'email'`)
      results.push('mercury_channel email: OK')
    } catch (enumErr2) {
      results.push(`mercury_channel email: SKIPPED (${enumErr2 instanceof Error ? enumErr2.message.slice(0, 80) : 'permission error'})`)
    }

    // ========================================
    // Phase BETA: Beta codes, subscription tier, waitlist expansion
    // ========================================

    // subscription_tier enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "subscription_tier" AS ENUM ('starter', 'professional', 'enterprise'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    results.push('subscription_tier enum: OK')

    // Add subscription_tier column to users
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'professional'; EXCEPTION WHEN duplicate_column THEN NULL; END $$
    `)
    results.push('users.subscription_tier: OK')

    // beta_codes table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "beta_codes" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "batch" INTEGER NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "used_by" TEXT,
        "used_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "beta_codes_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "beta_codes_code_key" ON "beta_codes"("code")`)
    results.push('beta_codes: OK')

    // Expand waitlist_entries with new columns
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "waitlist_entries" ADD COLUMN "full_name" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "waitlist_entries" ADD COLUMN "company" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "waitlist_entries" ADD COLUMN "role" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "waitlist_entries" ADD COLUMN "company_size" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('waitlist_entries expansion: OK')

    // ========================================
    // BYOLLM: llm_configs table (STORY-020)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "llm_configs" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL DEFAULT 'openrouter',
        "api_key_encrypted" TEXT NOT NULL,
        "base_url" TEXT,
        "default_model" TEXT,
        "policy" TEXT NOT NULL DEFAULT 'choice',
        "last_tested_at" TIMESTAMP(3),
        "last_test_result" TEXT,
        "last_test_latency" INTEGER,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "llm_configs_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "llm_configs_tenant_id_key"
      ON "llm_configs"("tenant_id")
    `)
    results.push('llm_configs (BYOLLM): OK')

    // ========================================
    // GAP 5: Onboarding wizard — onboarding_completed on users
    // ========================================
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('users.onboarding_completed: OK')

    // ========================================
    // STORY-067: Billing subscription fields on users
    // ========================================

    // Add all enum values to subscription_tier (canonical + legacy)
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'free'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'starter'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'professional'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'enterprise'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'sovereign'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'mercury'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE "subscription_tier" ADD VALUE IF NOT EXISTS 'syndicate'`)
      results.push('subscription_tier enum expanded: OK')
    } catch (enumErr3) {
      results.push(`subscription_tier enum: SKIPPED (${enumErr3 instanceof Error ? enumErr3.message.slice(0, 80) : 'permission error'})`)
    }

    // EPIC-016: Migrate legacy tier names → canonical names
    await prisma.$executeRawUnsafe(`UPDATE "users" SET "subscription_tier" = 'starter' WHERE "subscription_tier" = 'mercury'`)
    await prisma.$executeRawUnsafe(`UPDATE "users" SET "subscription_tier" = 'enterprise' WHERE "subscription_tier" = 'syndicate'`)
    results.push('subscription_tier legacy migration (mercury→starter, syndicate→enterprise): OK')

    // subscription_status enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN CREATE TYPE "subscription_status" AS ENUM ('inactive', 'active', 'past_due', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `)
    results.push('subscription_status enum: OK')

    // Add billing columns to users
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "subscription_status" "subscription_status" NOT NULL DEFAULT 'inactive'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "stripe_customer_id" VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "entitlements" JSONB NOT NULL DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "subscription_started_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "subscription_ends_at" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('users billing columns: OK')

    // Unique index on stripe_customer_id
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id")`)
    results.push('users.stripe_customer_id unique index: OK')

    // Migrate inactive users to 'free' default (safe: old tier still valid in enum)
    await prisma.$executeRawUnsafe(`UPDATE "users" SET "subscription_tier" = 'free' WHERE "subscription_tier" IN ('starter', 'professional') AND "subscription_status" = 'inactive'`)
    results.push('users tier migration (inactive→free): OK')

    // ========================================
    // EPIC-010: ROAM Integration table
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "roam_integrations" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "api_key_encrypted" TEXT,
        "webhook_subscription_id" TEXT,
        "target_group_id" TEXT,
        "target_group_name" TEXT,
        "mention_only" BOOLEAN NOT NULL DEFAULT true,
        "meeting_summaries" BOOLEAN NOT NULL DEFAULT true,
        "status" TEXT NOT NULL DEFAULT 'disconnected',
        "connected_at" TIMESTAMP(3),
        "last_health_check_at" TIMESTAMP(3),
        "error_reason" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "roam_integrations_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "roam_integrations_tenant_id_key" ON "roam_integrations"("tenant_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "roam_integrations_target_group_id_idx" ON "roam_integrations"("target_group_id")`)
    results.push('roam_integrations: OK')

    // ========================================
    // STORY-104: ROAM Dead Letter Queue
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "roam_dead_letters" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "pubsub_message_id" TEXT NOT NULL,
        "event_type" TEXT NOT NULL,
        "payload" JSONB NOT NULL,
        "error_message" TEXT NOT NULL,
        "error_status" INTEGER,
        "attempt_count" INTEGER NOT NULL DEFAULT 1,
        "retried" BOOLEAN NOT NULL DEFAULT false,
        "retried_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "roam_dead_letters_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "roam_dead_letters_pubsub_message_id_key" ON "roam_dead_letters"("pubsub_message_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "roam_dead_letters_tenant_id_created_at_idx" ON "roam_dead_letters"("tenant_id", "created_at" DESC)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "roam_dead_letters_retried_idx" ON "roam_dead_letters"("retried")`)
    results.push('roam_dead_letters: OK')

    // ========================================
    // EPIC-010: MercuryPersona preset columns
    // ========================================
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_personas" ADD COLUMN "personality_preset" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "mercury_personas" ADD COLUMN "role_preset" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('mercury_personas preset columns: OK')

    // ========================================
    // EPIC-010: notification_settings table
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "email" BOOLEAN NOT NULL DEFAULT true,
        "push" BOOLEAN NOT NULL DEFAULT false,
        "audit" BOOLEAN NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_user_id_key" ON "notification_settings"("user_id")`)
    results.push('notification_settings: OK')

    // ========================================
    // EPIC-013 STORY-161: HNSW vector index (idempotent)
    // ========================================
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "document_chunks_embedding_hnsw"
        ON "document_chunks" USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `)
      results.push('HNSW vector index: OK')
    } catch (hnswErr) {
      results.push(`HNSW vector index: SKIPPED (${hnswErr instanceof Error ? hnswErr.message.slice(0, 80) : 'error'})`)
    }

    // ========================================
    // EPIC-013 STORY-161: GIN full-text search index (BM25 prep)
    // ========================================
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "content_tsv" tsvector
        GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_chunks_content_gin"
        ON "document_chunks" USING gin ("content_tsv")
      `)
      results.push('GIN full-text index: OK')
    } catch (ginErr) {
      results.push(`GIN full-text index: SKIPPED (${ginErr instanceof Error ? ginErr.message.slice(0, 80) : 'error'})`)
    }

    // ========================================
    // EPIC-014 STORY-178: Feedback Reports
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "feedback_reports" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL,
        "userEmail" TEXT,
        "type" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "currentUrl" TEXT,
        "browserInfo" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "feedback_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    results.push('feedback_reports: OK')

    // ========================================
    // EPIC-018: ROAM Integration new columns (BUG-1 + BUG-2)
    // ========================================
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "roam_integrations" ADD COLUMN "client_id" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "roam_integrations" ADD COLUMN "webhook_secret_encrypted" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "roam_integrations" ADD COLUMN "response_mode" TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    results.push('roam_integrations EPIC-018 columns: OK')

    // ========================================
    // EPIC-018 GAP 2: ROAM Interactions (Feedback + Escalation)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "roam_interactions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "query_id" TEXT NOT NULL,
        "action_id" VARCHAR(50) NOT NULL,
        "value" TEXT,
        "user_id" VARCHAR(255) NOT NULL,
        "user_email" VARCHAR(255),
        "chat_id" VARCHAR(255),
        "channel" VARCHAR(20) NOT NULL DEFAULT 'roam',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_roam_interactions_query" ON "roam_interactions"("query_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_roam_interactions_action" ON "roam_interactions"("action_id")`)
    results.push('roam_interactions: OK')

    // ========================================
    // FINAL-DEBUG: isAdmin column on users
    // ========================================
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`)
    await prisma.$executeRawUnsafe(`UPDATE users SET is_admin = true WHERE email IN ('d05279090@gmail.com', 'theconnexusai@gmail.com') AND is_admin = false`)
    results.push('users.is_admin: OK')

    // ========================================
    // FINAL-DEBUG: Per-user MercuryPersona migration
    // Reassign the legacy shared 'default' persona to David's userId
    // so his customized Evelyn Monroe config follows his account.
    // Other users auto-get a fresh default persona on next login/load.
    // ========================================
    try {
      // Remove any auto-created persona that may conflict with the migration
      await prisma.$executeRawUnsafe(`
        DELETE FROM mercury_personas
        WHERE tenant_id = (SELECT id FROM users WHERE email = 'd05279090@gmail.com' LIMIT 1)
          AND tenant_id != 'default'
      `)
      // Reassign the customized persona
      const migrated = await prisma.$executeRawUnsafe(`
        UPDATE mercury_personas
        SET tenant_id = (SELECT id FROM users WHERE email = 'd05279090@gmail.com' LIMIT 1)
        WHERE tenant_id = 'default'
          AND EXISTS (SELECT 1 FROM users WHERE email = 'd05279090@gmail.com')
      `)
      results.push(`mercury_personas per-user migration: OK (${migrated} rows)`)
    } catch (personaMigErr) {
      results.push(`mercury_personas per-user migration: SKIPPED (${personaMigErr instanceof Error ? personaMigErr.message.slice(0, 80) : 'error'})`)
    }

    // ========================================
    // EPIC-027: onboarding_completed (ensure column exists + set David's accounts)
    // ========================================
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$`)
    await prisma.$executeRawUnsafe(`UPDATE users SET onboarding_completed = true WHERE email IN ('d05279090@gmail.com', 'theconnexusai@gmail.com') AND onboarding_completed = false`)
    results.push('users.onboarding_completed: OK')

    // ========================================
    // EPIC-027: CyGraph Phase 2 — mercury_proactive_insights
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_proactive_insights" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "insight_type" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "entities" TEXT[] DEFAULT '{}',
        "documents" TEXT[] DEFAULT '{}',
        "confidence" DOUBLE PRECISION NOT NULL,
        "dismissed" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "mercury_proactive_insights_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mercury_proactive_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_proactive_insights_user_id_dismissed_idx" ON "mercury_proactive_insights"("user_id", "dismissed")`)
    results.push('mercury_proactive_insights: OK')

    // ========================================
    // EPIC-027: CloudDriveCredential table (Microsoft OAuth)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cloud_drive_credentials" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL DEFAULT 'microsoft',
        "access_token" TEXT NOT NULL,
        "refresh_token" TEXT NOT NULL,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "scopes" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "cloud_drive_credentials_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "cloud_drive_credentials_user_id_key" UNIQUE ("user_id"),
        CONSTRAINT "cloud_drive_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "cloud_drive_credentials_user_id_idx" ON "cloud_drive_credentials"("user_id")`)
    results.push('cloud_drive_credentials: OK')

    // ========================================
    // STORY-010: Work profile columns on users (company_name, job_title, etc.)
    // ========================================
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_name" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "industry" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_size" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "use_case" TEXT`)
    results.push('users work-profile columns: OK')

    // ========================================
    // E24-002: Mercury Session Summaries (cross-session memory)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_session_summaries" (
        "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id"       TEXT NOT NULL,
        "thread_id"     TEXT,
        "summary"       TEXT NOT NULL,
        "topics"        TEXT[] DEFAULT ARRAY[]::TEXT[],
        "decisions"     TEXT[] DEFAULT ARRAY[]::TEXT[],
        "action_items"  TEXT[] DEFAULT ARRAY[]::TEXT[],
        "message_count" INTEGER NOT NULL DEFAULT 0,
        "persona"       TEXT,
        "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "mercury_session_summaries_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mercury_session_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "mercury_session_summaries_user_id_created_at_idx" ON "mercury_session_summaries"("user_id", "created_at" DESC)`)
    results.push('mercury_session_summaries: OK')

    // ========================================
    // E24-003: Mercury User Profiles (personalized context)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "mercury_user_profiles" (
        "id"           TEXT NOT NULL,
        "user_id"      TEXT NOT NULL,
        "display_name" TEXT,
        "role"         TEXT,
        "company"      TEXT,
        "priorities"   JSONB,
        "preferences"  JSONB,
        "timezone"     TEXT,
        "last_updated" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "mercury_user_profiles_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "mercury_user_profiles_user_id_key" UNIQUE ("user_id"),
        CONSTRAINT "mercury_user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    results.push('mercury_user_profiles: OK')

    // ========================================
    // CyGraph2026: Knowledge Graph tables
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kg_entities" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL DEFAULT 'default',
        "name" TEXT NOT NULL,
        "entity_type" TEXT NOT NULL,
        "canonical" TEXT,
        "metadata" JSONB,
        "merged_into" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kg_entities_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_entities_tenant_id_entity_type_idx" ON "kg_entities"("tenant_id", "entity_type")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_entities_tenant_id_name_idx" ON "kg_entities"("tenant_id", "name")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_entities_merged_into_idx" ON "kg_entities"("merged_into")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kg_edges" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL DEFAULT 'default',
        "from_entity_id" TEXT NOT NULL,
        "to_entity_id" TEXT NOT NULL,
        "relation_type" TEXT NOT NULL,
        "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        "metadata" JSONB,
        "valid_from" TIMESTAMPTZ,
        "valid_to" TIMESTAMPTZ,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kg_edges_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_edges_tenant_id_relation_type_idx" ON "kg_edges"("tenant_id", "relation_type")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_edges_from_entity_id_idx" ON "kg_edges"("from_entity_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_edges_to_entity_id_idx" ON "kg_edges"("to_entity_id")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kg_claims" (
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
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_claims_tenant_id_predicate_idx" ON "kg_claims"("tenant_id", "predicate")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_claims_subject_entity_id_idx" ON "kg_claims"("subject_entity_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_claims_status_idx" ON "kg_claims"("status")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kg_provenance" (
        "id" TEXT NOT NULL,
        "claim_id" TEXT NOT NULL,
        "document_id" TEXT NOT NULL,
        "chunk_id" TEXT,
        "excerpt" TEXT,
        "page_number" INTEGER,
        "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kg_provenance_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_provenance_claim_id_idx" ON "kg_provenance"("claim_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_provenance_document_id_idx" ON "kg_provenance"("document_id")`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "kg_mentions" (
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
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_mentions_entity_id_idx" ON "kg_mentions"("entity_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_mentions_document_id_idx" ON "kg_mentions"("document_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "kg_mentions_document_id_entity_id_idx" ON "kg_mentions"("document_id", "entity_id")`)

    // CyGraph foreign keys (wrapped in try/catch for idempotency)
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    } catch { /* already exists */ }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "kg_edges" ADD CONSTRAINT "kg_edges_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    } catch { /* already exists */ }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "kg_claims" ADD CONSTRAINT "kg_claims_subject_entity_id_fkey" FOREIGN KEY ("subject_entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    } catch { /* already exists */ }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "kg_provenance" ADD CONSTRAINT "kg_provenance_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "kg_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    } catch { /* already exists */ }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "kg_mentions" ADD CONSTRAINT "kg_mentions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "kg_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    } catch { /* already exists */ }
    results.push('cygraph knowledge graph (5 tables + indexes + FKs): OK')

    // ========================================
    // Feedback Entries (replaces feedback_reports)
    // ========================================
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "feedback_entries" (
        "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id"         TEXT NOT NULL,
        "user_email"      TEXT,
        "category"        TEXT NOT NULL,
        "message"         TEXT NOT NULL,
        "screenshot_url"  TEXT,
        "current_url"     TEXT,
        "browser_info"    TEXT,
        "status"          TEXT NOT NULL DEFAULT 'new',
        "admin_response"  TEXT,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "feedback_entries_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "feedback_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "feedback_entries_user_id_idx" ON "feedback_entries"("user_id")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "feedback_entries_status_idx" ON "feedback_entries"("status")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "feedback_entries_created_at_idx" ON "feedback_entries"("created_at")`)
    results.push('feedback_entries: OK')

    // ========================================
    // Add 'slack' and 'phone' to mercury_channel enum
    // ========================================
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'slack'`)
      await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'phone'`)
      results.push('mercury_channel slack+phone: OK')
    } catch (enumErr4) {
      results.push(`mercury_channel slack+phone: SKIPPED (${enumErr4 instanceof Error ? enumErr4.message.slice(0, 80) : 'permission error'})`)
    }

    // ========================================
    // CyGraph Phase 2: Temporal columns on kg_edges
    // ========================================
    await prisma.$executeRawUnsafe(`ALTER TABLE "kg_edges" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "kg_edges" ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMPTZ`)
    results.push('kg_edges temporal columns: OK')

    // EPIC-034: Schema fixes for Go backend compatibility
    // Go backend BulkInsert writes: content, content_hash (not chunk_text, tenant_id)
    await prisma.$executeRawUnsafe(`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "content" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "content_hash" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "document_chunks" ALTER COLUMN "tenant_id" DROP NOT NULL`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "document_chunks" ALTER COLUMN "chunk_text" DROP NOT NULL`)
    // Sync: copy content → chunk_text where chunk_text is NULL (for Next.js reads)
    await prisma.$executeRawUnsafe(`UPDATE "document_chunks" SET "chunk_text" = "content" WHERE "chunk_text" IS NULL AND "content" IS NOT NULL`)
    // Trigger: auto-sync content → chunk_text on INSERT/UPDATE
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sync_chunk_text() RETURNS TRIGGER AS $t$
      BEGIN
        IF NEW.chunk_text IS NULL AND NEW.content IS NOT NULL THEN
          NEW.chunk_text := NEW.content;
        END IF;
        RETURN NEW;
      END;
      $t$ LANGUAGE plpgsql
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TRIGGER trg_sync_chunk_text BEFORE INSERT OR UPDATE ON document_chunks
        FOR EACH ROW EXECUTE FUNCTION sync_chunk_text();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `)

    // ========================================
    // EPIC-034: Enrichment columns for sovereign pipeline
    // ========================================
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "contextual_text" TEXT
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "entities" JSONB DEFAULT '[]'::jsonb
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
      ON document_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 200)
    `)
    results.push('EPIC-034 enrichment columns + HNSW index: OK')

    // EPIC-034: Reset Failed documents to Pending for re-ingestion
    if (body.reset_failed === true) {
      const resetCount = await prisma.$executeRawUnsafe(`UPDATE documents SET index_status = 'Pending', chunk_count = 0 WHERE index_status = 'Failed'`)
      results.push(`EPIC-034 reset_failed: ${resetCount} docs reset to Pending`)
    }

    // EPIC-034: Reset N indexed documents to Pending (for pipeline re-exercise)
    if (typeof body.reset_indexed_sample === 'number' && body.reset_indexed_sample > 0) {
      const n = Math.min(body.reset_indexed_sample, 10)
      const resetCount = await prisma.$executeRawUnsafe(
        `UPDATE documents SET index_status = 'Pending', chunk_count = 0 WHERE id IN (SELECT id FROM documents WHERE index_status = 'Indexed' ORDER BY created_at DESC LIMIT ${n})`
      )
      results.push(`EPIC-034 reset_indexed_sample: ${resetCount} docs reset to Pending`)
    }

    // EPIC-034: Purge old chunks for Pending docs (avoids duplicate key on re-ingestion)
    if (body.purge_pending_chunks === true) {
      const deleted = await prisma.$executeRawUnsafe(
        `DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM documents WHERE index_status = 'Pending')`
      )
      results.push(`EPIC-034 purge_pending_chunks: ${deleted} chunks deleted`)
    }

    // Diagnostic: document counts by status
    try {
      const counts = await prisma.$queryRawUnsafe<Array<{index_status: string; cnt: bigint}>>(`SELECT index_status, COUNT(*) as cnt FROM documents GROUP BY index_status`)
      const tableExists = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_chunks') as exists`)
      results.push(`DIAG: docs by status: ${JSON.stringify(counts.map(r => `${r.index_status}:${r.cnt}`))} | chunks_table: ${tableExists[0]?.exists}`)
    } catch (diagErr) {
      results.push(`DIAG: ${diagErr instanceof Error ? diagErr.message.slice(0, 120) : 'error'}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
      results,
    }, { status: 500 })
  }
}
