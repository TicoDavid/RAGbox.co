-- EPIC-032: Add color field to folders
ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "color" TEXT;
