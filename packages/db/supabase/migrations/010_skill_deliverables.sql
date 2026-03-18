-- 010: Skill order deliverables + auto-registration support
alter table skill_orders add column deliverable text;
alter table skill_orders add column completed_at timestamptz;
