-- Cross-platform Agent Bridges
CREATE TABLE IF NOT EXISTS agent_bridges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mcp_server_url  TEXT        NOT NULL CHECK (char_length(mcp_server_url) BETWEEN 5 AND 2000),
  mcp_server_name TEXT        NOT NULL CHECK (char_length(mcp_server_name) BETWEEN 1 AND 200),
  tools_imported  JSONB       NOT NULL DEFAULT '[]',
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bridges_agent ON agent_bridges(agent_id);
CREATE INDEX idx_bridges_active ON agent_bridges(active) WHERE active = true;

ALTER TABLE agent_bridges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bridges_read"  ON agent_bridges FOR SELECT USING (true);
CREATE POLICY "bridges_write" ON agent_bridges FOR INSERT WITH CHECK (true);
CREATE POLICY "bridges_update" ON agent_bridges FOR UPDATE USING (true);
CREATE POLICY "bridges_delete" ON agent_bridges FOR DELETE USING (true);
