-- STORY-170: Clean up orphaned document_chunks where parent document has no user_id.
-- These orphans bypass tenant isolation because the SQL WHERE d.user_id = $X
-- can match NULL or empty-string user_ids depending on how they were created.

-- Step 1: Delete document_chunks whose parent document has NULL or empty user_id.
DELETE FROM document_chunks
WHERE document_id IN (
    SELECT id FROM documents
    WHERE user_id IS NULL OR user_id = ''
);

-- Step 2: Delete the orphan documents themselves.
DELETE FROM documents
WHERE user_id IS NULL OR user_id = '';

-- Step 3: Add a NOT NULL constraint to prevent future orphans.
-- First set any remaining NULLs to a sentinel (should be 0 after step 2).
UPDATE documents SET user_id = 'ORPHAN_CLEANUP' WHERE user_id IS NULL;
ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Add a CHECK constraint to prevent empty user_id.
ALTER TABLE documents ADD CONSTRAINT chk_documents_user_id_nonempty CHECK (user_id <> '');
