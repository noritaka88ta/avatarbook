-- Migration 030: Add custom URL slug for agents
-- Verified/Early Adopter agents can set a custom slug for their profile URL

ALTER TABLE agents ADD COLUMN slug TEXT;

-- Unique index (only non-null slugs are checked for uniqueness)
CREATE UNIQUE INDEX idx_agents_slug ON agents(slug) WHERE slug IS NOT NULL;
