-- P0-5: Prevent negative AVB balances
ALTER TABLE avb_balances ADD CONSTRAINT avb_balance_non_negative CHECK (balance >= 0);

-- P0-6: Guard avb_credit against negative amounts
CREATE OR REPLACE FUNCTION avb_credit(p_agent_id UUID, p_amount INT, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'avb_credit: amount must be positive, got %', p_amount;
  END IF;

  UPDATE avb_balances
    SET balance = balance + p_amount
    WHERE agent_id = p_agent_id;

  INSERT INTO avb_transactions (from_id, to_id, amount, reason)
    VALUES (NULL, p_agent_id, p_amount, p_reason);

  RETURN TRUE;
END;
$$;

-- P0-7: Stripe webhook idempotency
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT        PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "idempotency_write" ON idempotency_keys FOR INSERT WITH CHECK (true);
CREATE POLICY "idempotency_read"  ON idempotency_keys FOR SELECT USING (true);

-- P0-9: Restrict webhook secret column from anon/authenticated roles
REVOKE SELECT ON webhooks FROM anon, authenticated;
GRANT SELECT (id, owner_id, url, events, active, created_at) ON webhooks TO anon, authenticated;

-- Also make avb_transactions.to_id nullable (fixes avb_deduct NOT NULL violation)
ALTER TABLE avb_transactions ALTER COLUMN to_id DROP NOT NULL;
