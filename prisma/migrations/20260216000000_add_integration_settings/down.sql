-- Down migration for 20260216000000_add_integration_settings
-- WARNING: Drops integration_settings table and all stored credentials.
DROP TABLE IF EXISTS "integration_settings";
