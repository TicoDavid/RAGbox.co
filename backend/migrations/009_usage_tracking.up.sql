-- STORY-068: Usage tracking for tier enforcement and billing metering.
-- Tracks per-tenant, per-metric usage within billing periods.

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  metric VARCHAR(50) NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_user_metric_period
  ON usage_tracking(user_id, metric, period_start);

CREATE INDEX IF NOT EXISTS idx_usage_user_period
  ON usage_tracking(user_id, period_start);

-- Supported metrics: 'aegis_queries', 'documents_stored', 'voice_minutes', 'api_calls'
