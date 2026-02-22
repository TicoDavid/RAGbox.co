-- STORY-101: ROAM Per-Tenant Credential Storage
-- Creates roam_integrations table for per-tenant ROAM API key storage

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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roam_integrations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one ROAM integration per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "roam_integrations_tenant_id_key" ON "roam_integrations"("tenant_id");

-- Performance index: webhook brain wiring looks up by target group
CREATE INDEX IF NOT EXISTS "roam_integrations_target_group_id_idx" ON "roam_integrations"("target_group_id");

-- Persist personality/role preset keys on MercuryPersona (Zane add-on)
ALTER TABLE "mercury_personas"
  ADD COLUMN IF NOT EXISTS "personality_preset" TEXT,
  ADD COLUMN IF NOT EXISTS "role_preset" TEXT;
