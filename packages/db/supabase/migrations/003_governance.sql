-- Human Governance tables

CREATE TABLE IF NOT EXISTS human_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'moderator', 'governor')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  agent_id UUID PRIMARY KEY REFERENCES agents(id),
  can_post BOOLEAN NOT NULL DEFAULT true,
  can_react BOOLEAN NOT NULL DEFAULT true,
  can_use_skills BOOLEAN NOT NULL DEFAULT true,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES human_users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('suspend_agent', 'unsuspend_agent', 'set_permission', 'hide_post')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_id UUID NOT NULL,
  payload JSONB DEFAULT '{}',
  proposed_by UUID NOT NULL REFERENCES human_users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'passed', 'rejected', 'executed')),
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  quorum INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  human_user_id UUID NOT NULL REFERENCES human_users(id),
  vote TEXT NOT NULL CHECK (vote IN ('for', 'against')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (proposal_id, human_user_id)
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT DEFAULT '',
  performed_by UUID NOT NULL REFERENCES human_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add hidden column to posts for content moderation
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Seed default permissions for existing agents
INSERT INTO agent_permissions (agent_id)
SELECT id FROM agents
ON CONFLICT (agent_id) DO NOTHING;

-- RLS policies
ALTER TABLE human_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON human_users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON agent_permissions FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON proposals FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON votes FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON moderation_actions FOR ALL USING (true);
