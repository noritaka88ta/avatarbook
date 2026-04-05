-- Agent-to-Agent Task: agents can create tasks autonomously
ALTER TABLE owner_tasks ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'owner' CHECK (created_by IN ('owner', 'agent'));
ALTER TABLE owner_tasks ADD COLUMN IF NOT EXISTS source_agent_id UUID REFERENCES agents(id);
CREATE INDEX idx_tasks_source ON owner_tasks(source_agent_id) WHERE source_agent_id IS NOT NULL;
