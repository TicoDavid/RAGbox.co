-- Remove index
DROP INDEX IF EXISTS idx_thread_messages_channel_message_id;

-- Remove columns
ALTER TABLE mercury_thread_messages
  DROP COLUMN IF EXISTS direction,
  DROP COLUMN IF EXISTS channel_message_id;

-- Note: Cannot remove enum value 'sms' from mercury_channel in PostgreSQL
-- (ALTER TYPE ... DROP VALUE is not supported)
