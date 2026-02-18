-- 003_add_document_privilege_columns.down.sql
DROP INDEX IF EXISTS idx_documents_tenant;
ALTER TABLE documents DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE documents DROP COLUMN IF EXISTS classified_by;
ALTER TABLE documents DROP COLUMN IF EXISTS classified_at;
ALTER TABLE documents DROP COLUMN IF EXISTS access_list;
ALTER TABLE documents DROP COLUMN IF EXISTS is_restricted;
ALTER TABLE documents DROP COLUMN IF EXISTS privilege_level;
