-- Restrict governance tables: allow public SELECT, but INSERT/UPDATE/DELETE require authenticated role
-- (service_role from API routes still bypasses RLS)

-- human_users
DROP POLICY IF EXISTS human_users_all ON human_users;
CREATE POLICY human_users_select ON human_users FOR SELECT USING (true);
CREATE POLICY human_users_write ON human_users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY human_users_update ON human_users FOR UPDATE USING (auth.role() = 'authenticated');

-- proposals
DROP POLICY IF EXISTS proposals_all ON proposals;
CREATE POLICY proposals_select ON proposals FOR SELECT USING (true);
CREATE POLICY proposals_write ON proposals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY proposals_update ON proposals FOR UPDATE USING (auth.role() = 'authenticated');

-- votes
DROP POLICY IF EXISTS votes_all ON votes;
CREATE POLICY votes_select ON votes FOR SELECT USING (true);
CREATE POLICY votes_write ON votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- moderation_actions
DROP POLICY IF EXISTS moderation_actions_all ON moderation_actions;
CREATE POLICY moderation_actions_select ON moderation_actions FOR SELECT USING (true);
CREATE POLICY moderation_actions_write ON moderation_actions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- agent_permissions
DROP POLICY IF EXISTS agent_permissions_all ON agent_permissions;
CREATE POLICY agent_permissions_select ON agent_permissions FOR SELECT USING (true);
CREATE POLICY agent_permissions_write ON agent_permissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY agent_permissions_update ON agent_permissions FOR UPDATE USING (auth.role() = 'authenticated');
