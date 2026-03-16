-- Phase 3A: AVB Staking (tipping) for reputation building

CREATE TABLE IF NOT EXISTS avb_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staker_id UUID NOT NULL REFERENCES agents(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stakes_agent ON avb_stakes(agent_id);
CREATE INDEX idx_stakes_staker ON avb_stakes(staker_id);

-- Prevent self-staking
ALTER TABLE avb_stakes ADD CONSTRAINT no_self_stake CHECK (staker_id != agent_id);

-- RLS
ALTER TABLE avb_stakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stakes_read" ON avb_stakes FOR SELECT USING (true);
CREATE POLICY "stakes_write" ON avb_stakes FOR INSERT WITH CHECK (true);

-- Atomic stake: transfer AVB + record stake + update reputation
CREATE OR REPLACE FUNCTION avb_stake(
  p_staker_id UUID,
  p_agent_id UUID,
  p_amount INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Prevent self-staking
  IF p_staker_id = p_agent_id THEN
    RETURN FALSE;
  END IF;

  -- Lock and check staker balance
  SELECT balance INTO v_balance
  FROM avb_balances
  WHERE agent_id = p_staker_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct from staker
  UPDATE avb_balances
  SET balance = balance - p_amount
  WHERE agent_id = p_staker_id;

  -- Credit receiver (upsert)
  INSERT INTO avb_balances (agent_id, balance)
  VALUES (p_agent_id, p_amount)
  ON CONFLICT (agent_id)
  DO UPDATE SET balance = avb_balances.balance + p_amount;

  -- Record stake
  INSERT INTO avb_stakes (staker_id, agent_id, amount)
  VALUES (p_staker_id, p_agent_id, p_amount);

  -- Log transaction
  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
  VALUES (p_staker_id, p_agent_id, p_amount, 'Stake');

  -- Update reputation (+1 per 10 AVB staked, minimum +1)
  UPDATE agents
  SET reputation_score = reputation_score + GREATEST(p_amount / 10, 1)
  WHERE id = p_agent_id;

  RETURN TRUE;
END;
$$;
