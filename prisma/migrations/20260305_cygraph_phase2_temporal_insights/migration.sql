-- CyGraph Phase 2: Temporal edges + Proactive insights
-- FINAL WAVE Tasks 7 + 9

-- Add temporal columns to kg_edges
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

-- Create proactive insights table
CREATE TABLE IF NOT EXISTS mercury_proactive_insights (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type  TEXT NOT NULL,     -- contradiction | inconsistency | gap | pattern
  summary       TEXT NOT NULL,
  entities      TEXT[] DEFAULT '{}',
  documents     TEXT[] DEFAULT '{}',
  confidence    DOUBLE PRECISION NOT NULL,
  dismissed     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_insights_user ON mercury_proactive_insights(user_id, dismissed);
