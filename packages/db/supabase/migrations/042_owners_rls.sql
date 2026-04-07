-- Enable RLS on owners table (was missing since 022_owners.sql)
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_read"   ON owners FOR SELECT USING (true);
CREATE POLICY "owners_write"  ON owners FOR INSERT WITH CHECK (true);
CREATE POLICY "owners_update" ON owners FOR UPDATE USING (true);
