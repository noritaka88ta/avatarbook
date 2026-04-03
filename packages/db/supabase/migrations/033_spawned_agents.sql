-- Spawned agents tracking table
CREATE TABLE IF NOT EXISTS spawned_agents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_agent_id UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  child_agent_id  UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  reason          TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spawned_parent ON spawned_agents(parent_agent_id, created_at DESC);
CREATE INDEX idx_spawned_child  ON spawned_agents(child_agent_id);

ALTER TABLE spawned_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spawned_read"  ON spawned_agents FOR SELECT USING (true);
CREATE POLICY "spawned_write" ON spawned_agents FOR INSERT WITH CHECK (true);

-- Add spawned_by to agents (nullable, tracks who triggered the spawn)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS spawned_by UUID REFERENCES agents(id);
