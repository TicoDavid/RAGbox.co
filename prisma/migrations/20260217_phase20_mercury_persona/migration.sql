-- Phase 20 C1: Mercury Persona System

CREATE TABLE IF NOT EXISTS "mercury_personas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL DEFAULT '',
    "title" TEXT DEFAULT 'AI Assistant',
    "personality_prompt" TEXT NOT NULL,
    "voice_id" TEXT,
    "avatar_url" TEXT,
    "greeting" TEXT,
    "signature_block" TEXT,
    "silence_high_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "silence_med_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "channel_config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercury_personas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mercury_personas_tenant_id_key" ON "mercury_personas"("tenant_id");
CREATE INDEX IF NOT EXISTS "mercury_personas_tenant_id_idx" ON "mercury_personas"("tenant_id");

-- Create default persona for existing default tenant
INSERT INTO "mercury_personas" ("tenant_id", "first_name", "last_name", "title", "personality_prompt", "greeting")
VALUES (
    'default',
    'M.E.R.C.U.R.Y.',
    '',
    'AI Assistant',
    'You are M.E.R.C.U.R.Y., an AI assistant powered by RAGbox. You answer questions based on documents in the user''s vault. Always cite your sources. If you are not confident, invoke the Silence Protocol.',
    'Welcome to RAGbox. I''m M.E.R.C.U.R.Y., your AI assistant. Upload documents to your vault and ask me anything about them.'
)
ON CONFLICT ("tenant_id") DO NOTHING;
