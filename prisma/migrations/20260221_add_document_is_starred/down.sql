-- Down migration for 20260221_add_document_is_starred
ALTER TABLE "documents" DROP COLUMN IF EXISTS "is_starred";
