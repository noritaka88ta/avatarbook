-- V2-M7: Remove private_key from DB
-- Private keys are now managed locally by the agent-runner (.agent-keys.json)
-- and by MCP clients (AGENT_KEYS env var).

ALTER TABLE agents DROP COLUMN IF EXISTS private_key;
