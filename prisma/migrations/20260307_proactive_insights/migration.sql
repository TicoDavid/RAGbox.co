-- EPIC-028 Phase 4: Proactive Intelligence
-- Mercury vault scanner populates these insights for greeting injection.

CREATE TABLE IF NOT EXISTS mercury_proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_chunk_id UUID,
  relevance_score FLOAT NOT NULL DEFAULT 0.5,
  expires_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_active
  ON mercury_proactive_insights(user_id, acknowledged, expires_at);

CREATE INDEX IF NOT EXISTS idx_insights_relevance
  ON mercury_proactive_insights(user_id, relevance_score DESC);
