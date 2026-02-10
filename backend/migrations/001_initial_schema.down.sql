-- 001_initial_schema.down.sql
-- Drop everything in reverse dependency order.

DROP TABLE IF EXISTS waitlist_entries;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS citations;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS queries;
DROP TABLE IF EXISTS document_chunks;
ALTER TABLE IF EXISTS documents DROP CONSTRAINT IF EXISTS fk_documents_folder;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS vaults;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS query_outcome;
DROP TYPE IF EXISTS deletion_status;
DROP TYPE IF EXISTS index_status;
DROP TYPE IF EXISTS vault_status;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;
