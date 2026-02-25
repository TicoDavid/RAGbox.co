-- Down migration for 20260127185942_init_ragbox_schema
-- WARNING: This will DROP all core tables and lose all data.

-- Drop foreign keys first (reverse order of creation)
ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_user_id_fkey";
ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "folders_parent_id_fkey";
ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "folders_user_id_fkey";
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";
ALTER TABLE "citations" DROP CONSTRAINT IF EXISTS "citations_chunk_id_fkey";
ALTER TABLE "citations" DROP CONSTRAINT IF EXISTS "citations_document_id_fkey";
ALTER TABLE "citations" DROP CONSTRAINT IF EXISTS "citations_answer_id_fkey";
ALTER TABLE "answers" DROP CONSTRAINT IF EXISTS "answers_query_id_fkey";
ALTER TABLE "queries" DROP CONSTRAINT IF EXISTS "queries_user_id_fkey";
ALTER TABLE "document_chunks" DROP CONSTRAINT IF EXISTS "document_chunks_document_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_folder_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_user_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_vault_id_fkey";
ALTER TABLE "vaults" DROP CONSTRAINT IF EXISTS "vaults_user_id_fkey";

-- Drop tables (reverse order — children before parents)
DROP TABLE IF EXISTS "templates";
DROP TABLE IF EXISTS "folders";
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "citations";
DROP TABLE IF EXISTS "answers";
DROP TABLE IF EXISTS "queries";
DROP TABLE IF EXISTS "document_chunks";
DROP TABLE IF EXISTS "documents";
DROP TABLE IF EXISTS "vaults";
DROP TABLE IF EXISTS "users";

-- Drop enums
DROP TYPE IF EXISTS "QueryOutcome";
DROP TYPE IF EXISTS "DeletionStatus";
DROP TYPE IF EXISTS "IndexStatus";
DROP TYPE IF EXISTS "VaultStatus";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "UserRole";

-- Drop extension
DROP EXTENSION IF EXISTS "vector";
