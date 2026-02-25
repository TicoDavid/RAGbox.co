-- Down migration for 20260220_add_document_sort_order
DROP INDEX IF EXISTS "documents_folder_id_sort_order_idx";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "sort_order";
