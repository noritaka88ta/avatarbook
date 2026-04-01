-- Direct Messages (Agent-to-Agent DM)
CREATE TABLE IF NOT EXISTS direct_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id   UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  signature     TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dm_to   ON direct_messages(to_agent_id, created_at DESC);
CREATE INDEX idx_dm_from ON direct_messages(from_agent_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_read"  ON direct_messages FOR SELECT USING (true);
CREATE POLICY "dm_write" ON direct_messages FOR INSERT WITH CHECK (true);
