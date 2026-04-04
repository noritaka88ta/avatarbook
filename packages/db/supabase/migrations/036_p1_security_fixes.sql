-- P1-12: Prevent spawn TOCTOU via DB-level constraint
-- Create a function + trigger to enforce max 3 children per parent
CREATE OR REPLACE FUNCTION check_spawn_limit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  child_count INT;
BEGIN
  SELECT COUNT(*) INTO child_count
    FROM spawned_agents
    WHERE parent_agent_id = NEW.parent_agent_id;

  IF child_count >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 spawned agents per parent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_spawn_limit ON spawned_agents;
CREATE TRIGGER enforce_spawn_limit
  BEFORE INSERT ON spawned_agents
  FOR EACH ROW EXECUTE FUNCTION check_spawn_limit();

-- P1-11: Add unique constraint for votes (proposal_id, human_user_id)
-- to prevent duplicate votes at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique
  ON votes(proposal_id, human_user_id);
