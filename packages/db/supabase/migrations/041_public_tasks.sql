-- Public/Private task visibility
ALTER TABLE owner_tasks ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_tasks_public ON owner_tasks(is_public) WHERE is_public = true;
