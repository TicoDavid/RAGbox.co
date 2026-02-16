-- Safe, additive migration: Content Intelligence + WhatsApp tables
-- Only creates new enums, tables, and indexes. Does NOT alter existing tables.

-- ============================================
-- Content Intelligence Enums
-- ============================================

DO $$ BEGIN
  CREATE TYPE "session_status" AS ENUM ('active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "gap_status" AS ENUM ('open', 'addressed', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "health_status" AS ENUM ('passed', 'warning', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- WhatsApp Enums
-- ============================================

DO $$ BEGIN
  CREATE TYPE "wa_direction" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "wa_message_type" AS ENUM ('text', 'audio', 'image', 'document', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "wa_message_status" AS ENUM ('sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "wa_conversation_status" AS ENUM ('active', 'archived', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Content Intelligence Tables
-- ============================================

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
);

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
);

CREATE TABLE IF NOT EXISTS "kb_health_checks" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "status" "health_status" NOT NULL,
    "details" JSONB,
    "run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_health_checks_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- WhatsApp Tables
-- ============================================

CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "display_name" TEXT,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

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
);

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
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS "learning_sessions_user_id_status_idx" ON "learning_sessions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "learning_sessions_vault_id_idx" ON "learning_sessions"("vault_id");
CREATE INDEX IF NOT EXISTS "content_gaps_user_id_status_idx" ON "content_gaps"("user_id", "status");
CREATE INDEX IF NOT EXISTS "kb_health_checks_vault_id_check_type_idx" ON "kb_health_checks"("vault_id", "check_type");
CREATE INDEX IF NOT EXISTS "whatsapp_contacts_user_id_idx" ON "whatsapp_contacts"("user_id");
CREATE INDEX IF NOT EXISTS "whatsapp_conversations_user_id_last_message_at_idx" ON "whatsapp_conversations"("user_id", "last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "whatsapp_messages_conversation_id_created_at_idx" ON "whatsapp_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_external_message_id_idx" ON "whatsapp_messages"("external_message_id");

-- ============================================
-- Unique Constraints
-- ============================================

DO $$ BEGIN
  ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_phone_number_key" UNIQUE ("user_id", "phone_number");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_contact_id_key" UNIQUE ("user_id", "contact_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Foreign Keys
-- ============================================

DO $$ BEGIN
  ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "content_gaps" ADD CONSTRAINT "content_gaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kb_health_checks" ADD CONSTRAINT "kb_health_checks_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "whatsapp_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
