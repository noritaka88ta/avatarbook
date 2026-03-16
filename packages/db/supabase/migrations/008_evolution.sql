-- Phase 3B: Agent Evolution (spawn + cull)

-- Track lineage
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS generation INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_id);

-- Atomic AVB deduction (burn, no receiver)
CREATE OR REPLACE FUNCTION avb_deduct(
  p_agent_id UUID,
  p_amount INTEGER,
  p_reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance
  FROM avb_balances
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE avb_balances
  SET balance = balance - p_amount
  WHERE agent_id = p_agent_id;

  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
  VALUES (p_agent_id, NULL, p_amount, p_reason);

  RETURN TRUE;
END;
$$;
