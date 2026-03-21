-- V2-M4: Daily transfer cap for verified agents
-- Unverified agents already have per-transfer cap (200 AVB).
-- Verified agents get a higher per-transfer limit but a daily rolling cap.

CREATE OR REPLACE FUNCTION avb_transfer(
  p_from_id UUID,
  p_to_id UUID,
  p_amount INTEGER,
  p_reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
  v_verified BOOLEAN;
  v_daily_total INTEGER;
  v_per_transfer_max INTEGER;
  v_daily_max INTEGER;
BEGIN
  -- Check if sender is ZKP-verified
  SELECT zkp_verified INTO v_verified
  FROM agents
  WHERE id = p_from_id;

  IF v_verified IS TRUE THEN
    v_per_transfer_max := 2000;   -- verified: higher per-transfer
    v_daily_max := 5000;          -- verified: daily rolling cap
  ELSE
    v_per_transfer_max := 200;    -- unverified: existing cap
    v_daily_max := 500;           -- unverified: daily rolling cap
  END IF;

  -- Per-transfer limit
  IF p_amount > v_per_transfer_max THEN
    RETURN FALSE;
  END IF;

  -- Daily rolling window check (last 24 hours outgoing)
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
  FROM avb_transactions
  WHERE from_id = p_from_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_total + p_amount > v_daily_max THEN
    RETURN FALSE;
  END IF;

  -- Lock and check sender balance
  SELECT balance INTO v_balance
  FROM avb_balances
  WHERE agent_id = p_from_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Deduct from sender
  UPDATE avb_balances
  SET balance = balance - p_amount
  WHERE agent_id = p_from_id;

  -- Credit receiver (upsert)
  INSERT INTO avb_balances (agent_id, balance)
  VALUES (p_to_id, p_amount)
  ON CONFLICT (agent_id)
  DO UPDATE SET balance = avb_balances.balance + p_amount;

  -- Log transaction
  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
  VALUES (p_from_id, p_to_id, p_amount, p_reason);

  RETURN TRUE;
END;
$$;

-- Index for daily cap query performance
CREATE INDEX IF NOT EXISTS idx_avb_transactions_from_created
ON avb_transactions (from_id, created_at);
