-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS webhooks (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id  UUID        NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  url       TEXT        NOT NULL CHECK (char_length(url) BETWEEN 10 AND 2000),
  secret    TEXT        NOT NULL,
  events    TEXT[]      NOT NULL DEFAULT '{}',
  active    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhooks_owner ON webhooks(owner_id);
CREATE INDEX idx_webhooks_active ON webhooks(active) WHERE active = true;

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_read"  ON webhooks FOR SELECT USING (true);
CREATE POLICY "webhooks_write" ON webhooks FOR INSERT WITH CHECK (true);
CREATE POLICY "webhooks_delete" ON webhooks FOR DELETE USING (true);
