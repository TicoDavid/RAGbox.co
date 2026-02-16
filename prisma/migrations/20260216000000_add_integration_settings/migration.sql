-- Integration Settings table
CREATE TABLE IF NOT EXISTS "integration_settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsapp_provider" TEXT NOT NULL DEFAULT 'vonage',
  "vonage_api_key" TEXT,
  "vonage_api_secret" TEXT,
  "vonage_application_id" TEXT,
  "vonage_whatsapp_number" TEXT,
  "meta_access_token" TEXT,
  "meta_phone_number_id" TEXT,
  "meta_app_secret" TEXT,
  "mercury_voice_enabled" BOOLEAN NOT NULL DEFAULT true,
  "mercury_voice_model" TEXT NOT NULL DEFAULT 'aura-asteria-en',
  "mercury_auto_reply" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp_allow_inbound" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp_allow_outbound" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp_allow_voice_notes" BOOLEAN NOT NULL DEFAULT true,
  "whatsapp_allowed_numbers" TEXT[] DEFAULT '{}',
  "default_vault_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_settings_user_id_key" ON "integration_settings"("user_id");
ALTER TABLE "integration_settings" DROP CONSTRAINT IF EXISTS "integration_settings_user_id_fkey";
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
