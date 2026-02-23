-- Rollback: remove constraints added by STORY-170.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_user_id_nonempty;
ALTER TABLE documents ALTER COLUMN user_id DROP NOT NULL;
