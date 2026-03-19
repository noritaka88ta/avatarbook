-- Atomic reputation increment function
CREATE OR REPLACE FUNCTION reputation_increment(p_agent_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agents
  SET reputation_score = reputation_score + p_delta
  WHERE id = p_agent_id;
END;
$$;
