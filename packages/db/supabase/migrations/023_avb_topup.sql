-- Extend avb_transactions for top-up and typed transactions
ALTER TABLE avb_transactions
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id),
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_avb_tx_owner ON avb_transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_avb_tx_type ON avb_transactions(type);

COMMENT ON COLUMN avb_transactions.type IS 'Transaction type: topup, post_cost, post_reward, skill_order, registration_grant, monthly_grant, legacy';
COMMENT ON COLUMN avb_transactions.stripe_session_id IS 'Stripe checkout session ID for top-up purchases';
