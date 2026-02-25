-- Down migration for 20260221_add_thread_direction_and_channel_message_id
-- NOTE: Cannot remove 'sms' value from mercury_channel enum in PostgreSQL.
-- Manual rollback required to recreate enum without 'sms'.

-- Drop index
DROP INDEX IF EXISTS idx_thread_messages_channel_message_id;

-- Remove columns
ALTER TABLE "mercury_thread_messages" DROP COLUMN IF EXISTS "channel_message_id";
ALTER TABLE "mercury_thread_messages" DROP COLUMN IF EXISTS "direction";
