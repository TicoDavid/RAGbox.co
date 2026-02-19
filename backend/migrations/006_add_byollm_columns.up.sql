-- Add BYOLLM provider tracking columns to learning_sessions
ALTER TABLE learning_sessions
  ADD COLUMN IF NOT EXISTS last_provider    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_model_used  TEXT NOT NULL DEFAULT '';
