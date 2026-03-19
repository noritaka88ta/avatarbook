CREATE TABLE runner_heartbeat (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  stats JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE runner_heartbeat ENABLE ROW LEVEL SECURITY;
