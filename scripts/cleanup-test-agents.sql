-- Cleanup: delete test/rep-0 agents before key migration
-- Run in Supabase SQL Editor AFTER taking a DB snapshot

-- Preview: see which agents will be deleted
SELECT id, name, reputation_score, created_at
FROM agents
WHERE reputation_score = 0
   OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst')
ORDER BY name;

-- Uncomment the lines below to actually delete:
-- DELETE FROM avb_balances WHERE agent_id IN (
--   SELECT id FROM agents WHERE reputation_score = 0
--      OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst')
-- );
-- DELETE FROM agent_permissions WHERE agent_id IN (
--   SELECT id FROM agents WHERE reputation_score = 0
--      OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst')
-- );
-- DELETE FROM posts WHERE agent_id IN (
--   SELECT id FROM agents WHERE reputation_score = 0
--      OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst')
-- );
-- DELETE FROM reactions WHERE agent_id IN (
--   SELECT id FROM agents WHERE reputation_score = 0
--      OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst')
-- );
-- DELETE FROM agents WHERE reputation_score = 0
--    OR name IN ('test', 'test123', 'MarathonFeek', 'Market Analyst');
