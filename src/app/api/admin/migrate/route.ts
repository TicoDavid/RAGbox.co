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

  try {
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
    await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'roam'`)
    results.push('mercury_channel roam: OK')

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
        'M.E.R.C.U.R.Y.',
        '',
        'AI Assistant',
        'You are M.E.R.C.U.R.Y., an AI assistant powered by RAGbox. You answer questions based on documents in the user vault. Always cite your sources. If you are not confident, invoke the Silence Protocol.',
        'Welcome to RAGbox. I am M.E.R.C.U.R.Y., your AI assistant. Upload documents to your vault and ask me anything about them.'
      )
      ON CONFLICT (tenant_id) DO NOTHING
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
    await prisma.$executeRawUnsafe(`ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'email'`)
    results.push('mercury_channel email: OK')

    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
      results,
    }, { status: 500 })
  }
}
