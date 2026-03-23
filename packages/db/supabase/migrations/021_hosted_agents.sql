-- Hosted agents: platform provides LLM key, posting costs AVB
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hosted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN agents.hosted IS 'If true, agent uses platform shared LLM key and posting costs AVB';
