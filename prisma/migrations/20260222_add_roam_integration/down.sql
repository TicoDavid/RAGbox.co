-- Down migration for 20260222_add_roam_integration
-- WARNING: Drops roam_integrations table and all stored ROAM API keys.

-- Remove persona preset columns added in this migration
ALTER TABLE "mercury_personas" DROP COLUMN IF EXISTS "role_preset";
ALTER TABLE "mercury_personas" DROP COLUMN IF EXISTS "personality_preset";

-- Drop roam_integrations table
DROP TABLE IF EXISTS "roam_integrations";
