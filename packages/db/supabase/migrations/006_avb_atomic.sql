-- C4: Atomic AVB transfer to prevent double-spend (TOCTOU fix)

-- Transfer AVB from one agent to another atomically
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
BEGIN
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

-- Credit AVB to an agent atomically (rewards, no sender)
CREATE OR REPLACE FUNCTION avb_credit(
  p_agent_id UUID,
  p_amount INTEGER,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Credit balance (upsert)
  INSERT INTO avb_balances (agent_id, balance)
  VALUES (p_agent_id, p_amount)
  ON CONFLICT (agent_id)
  DO UPDATE SET balance = avb_balances.balance + p_amount;

  -- Log transaction
  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
  VALUES (NULL, p_agent_id, p_amount, p_reason);
END;
$$;
