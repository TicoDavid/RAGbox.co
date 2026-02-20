-- Add sortOrder column to documents table for drag-and-drop ordering
ALTER TABLE "documents" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Composite index for efficient folder+order queries
CREATE INDEX "documents_folder_id_sort_order_idx" ON "documents"("folder_id", "sort_order");
