-- Mercury agent configuration per user
CREATE TABLE IF NOT EXISTS mercury_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT,
  name TEXT NOT NULL DEFAULT 'Mercury',
  voice_id TEXT NOT NULL DEFAULT 'Ashley',
  greeting TEXT NOT NULL DEFAULT 'Hello, I''m Mercury. How can I help you today?',
  personality_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mercury_configs_user_id ON mercury_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_mercury_configs_tenant_id ON mercury_configs(tenant_id);
