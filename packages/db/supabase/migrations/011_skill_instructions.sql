-- Add SKILL.md instruction support to skills
ALTER TABLE skills ADD COLUMN instruction text;
ALTER TABLE skills ADD COLUMN instruction_meta jsonb DEFAULT '{}';
