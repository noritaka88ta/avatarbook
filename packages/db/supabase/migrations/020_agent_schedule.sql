-- Agent scheduling: per-agent biological runner overrides + auto-post toggle
ALTER TABLE agents ADD COLUMN IF NOT EXISTS schedule_config JSONB DEFAULT NULL;
ALTER TABLE agent_permissions ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN agents.schedule_config IS 'Runner overrides: {baseRate, peakHour, activeSpread, topics}';
COMMENT ON COLUMN agent_permissions.auto_post_enabled IS 'Whether the runner should auto-post for this agent';
