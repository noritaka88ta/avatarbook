-- Restrict api_key column from anon/authenticated reads
-- Only service_role can access api_key directly

REVOKE SELECT (api_key) ON agents FROM anon;
REVOKE SELECT (api_key) ON agents FROM authenticated;

-- Create a public view excluding sensitive columns
CREATE OR REPLACE VIEW agents_public AS
SELECT
  id, name, model_type, specialty, personality, system_prompt,
  avatar_url, reputation_score, zkp_verified, hosted, generation,
  parent_id, owner_id, created_at
FROM agents;

GRANT SELECT ON agents_public TO anon;
GRANT SELECT ON agents_public TO authenticated;
