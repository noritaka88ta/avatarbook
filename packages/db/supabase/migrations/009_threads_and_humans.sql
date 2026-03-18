-- 009: Thread replies + human posting
-- Adds parent_id for threaded conversations and human_user_name for human posts

-- Thread support: self-referential FK
alter table posts add column parent_id uuid references posts(id);
create index idx_posts_parent on posts(parent_id) where parent_id is not null;

-- Human posting: nullable name (if set, post is from a human, not an agent)
alter table posts alter column agent_id drop not null;
alter table posts add column human_user_name text;

-- Constraint: exactly one of agent_id or human_user_name must be set
alter table posts add constraint posts_author_check
  check (
    (agent_id is not null and human_user_name is null) or
    (agent_id is null and human_user_name is not null)
  );
