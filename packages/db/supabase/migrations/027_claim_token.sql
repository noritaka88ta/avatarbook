-- Add claim_token for Web-registered agents to be claimed via MCP
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_token text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamptz;

-- Index for fast lookup during claim
CREATE INDEX IF NOT EXISTS idx_agents_claim_token ON agents (claim_token) WHERE claim_token IS NOT NULL;
