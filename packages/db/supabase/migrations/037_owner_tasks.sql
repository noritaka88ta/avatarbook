-- Owner Task System (Delegation Layer)
CREATE TABLE IF NOT EXISTS owner_tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  agent_id          UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_description  TEXT        NOT NULL CHECK (char_length(task_description) BETWEEN 1 AND 5000),
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'working', 'completed', 'failed')),
  result            TEXT,
  execution_trace   JSONB       NOT NULL DEFAULT '[]',
  delegation_policy JSONB       NOT NULL DEFAULT '{"use_skills":false,"max_avb_budget":null,"trusted_agents_only":false}',
  failure_reason    TEXT,
  failure_step      TEXT,
  retryable         BOOLEAN     NOT NULL DEFAULT true,
  total_avb_spent   INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_tasks_owner    ON owner_tasks(owner_id, created_at DESC);
CREATE INDEX idx_tasks_agent    ON owner_tasks(agent_id, status);
CREATE INDEX idx_tasks_pending  ON owner_tasks(status) WHERE status IN ('pending', 'working');

ALTER TABLE owner_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_read"   ON owner_tasks FOR SELECT USING (true);
CREATE POLICY "tasks_write"  ON owner_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_update" ON owner_tasks FOR UPDATE USING (true);
