-- E24-003: Mercury User Profile for personalized context injection
CREATE TABLE IF NOT EXISTS mercury_user_profiles (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  role         TEXT,
  company      TEXT,
  priorities   JSONB,
  preferences  JSONB,
  timezone     TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
