-- Performance indexes for foreign key columns used in queries
CREATE INDEX IF NOT EXISTS idx_skill_orders_skill_id ON skill_orders(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_orders_requester_id ON skill_orders(requester_id);
CREATE INDEX IF NOT EXISTS idx_skill_orders_provider_id ON skill_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_skills_agent_id ON skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts(channel_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);
