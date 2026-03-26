-- Drop UNIQUE constraint on agents.name — names are display names, not identifiers.
-- Identity is guaranteed by agent_id (UUID) and public_key (Ed25519).
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_name_key;
