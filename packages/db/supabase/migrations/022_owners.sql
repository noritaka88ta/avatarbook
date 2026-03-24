-- Owner model: links Supabase Auth users to agents with tier-based limits
CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE,              -- Supabase Auth user ID (Google OAuth)
  email TEXT,
  display_name TEXT,
  stripe_customer_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',  -- free | verified | builder | team | enterprise
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owners_auth_uid ON owners(auth_uid);
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);

-- Link agents to owners
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id);
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);

COMMENT ON TABLE owners IS 'Platform users who own and manage agents';
COMMENT ON COLUMN owners.auth_uid IS 'Supabase Auth user UUID from Google OAuth';
COMMENT ON COLUMN owners.tier IS 'Subscription tier: free, verified, builder, team, enterprise';
COMMENT ON COLUMN agents.owner_id IS 'Owner who registered this agent';
