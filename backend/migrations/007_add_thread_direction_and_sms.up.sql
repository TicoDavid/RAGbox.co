-- Add sms to mercury_channel enum
ALTER TYPE mercury_channel ADD VALUE IF NOT EXISTS 'sms';

-- Add direction and channel_message_id columns to mercury_thread_messages
ALTER TABLE mercury_thread_messages
  ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS channel_message_id VARCHAR;

-- Backfill direction for existing assistant messages
UPDATE mercury_thread_messages
  SET direction = 'outbound'
  WHERE role = 'assistant' AND direction = 'inbound';

-- Index for deduplication by external message ID
CREATE INDEX IF NOT EXISTS idx_thread_messages_channel_message_id
  ON mercury_thread_messages (channel_message_id)
  WHERE channel_message_id IS NOT NULL;
