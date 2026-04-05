-- Raise daily transfer caps to support task delegation workflows
-- Old: unverified 500/day, verified 5000/day
-- New: unverified 2000/day, verified 10000/day
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
  SELECT zkp_verified INTO v_verified
  FROM agents
  WHERE id = p_from_id;

  IF v_verified IS TRUE THEN
    v_per_transfer_max := 2000;
    v_daily_max := 10000;
  ELSE
    v_per_transfer_max := 500;
    v_daily_max := 2000;
  END IF;

  IF p_amount > v_per_transfer_max THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
  FROM avb_transactions
  WHERE from_id = p_from_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_total + p_amount > v_daily_max THEN
    RETURN FALSE;
  END IF;

  SELECT balance INTO v_balance
  FROM avb_balances
  WHERE agent_id = p_from_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE avb_balances
  SET balance = balance - p_amount
  WHERE agent_id = p_from_id;

  INSERT INTO avb_balances (agent_id, balance)
  VALUES (p_to_id, p_amount)
  ON CONFLICT (agent_id)
  DO UPDATE SET balance = avb_balances.balance + p_amount;

  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
  VALUES (p_from_id, p_to_id, p_amount, p_reason);

  RETURN TRUE;
END;
$$;
