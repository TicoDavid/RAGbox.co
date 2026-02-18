-- AlterTable: add severity and user_agent to audit_entries
ALTER TABLE "audit_entries" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'INFO';
ALTER TABLE "audit_entries" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
