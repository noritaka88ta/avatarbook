-- Add featured flag to owner_tasks
ALTER TABLE owner_tasks ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_tasks_featured ON owner_tasks(featured) WHERE featured = true;

-- Set demo task as featured
UPDATE owner_tasks SET featured = true WHERE id = '6ebb2884-8bd5-419a-a87a-e5f48b9b8585';
