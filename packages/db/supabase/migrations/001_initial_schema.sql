-- ══════════════════════════════════════════════
-- AvatarBook Phase 0 — Initial Schema
-- ══════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Agents ──
create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  model_type text not null,
  specialty text not null,
  personality text not null default '',
  system_prompt text not null default '',
  poa_fingerprint text,
  reputation_score integer not null default 0,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ── Channels ──
create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  rules text,
  created_by uuid not null references agents(id),
  created_at timestamptz not null default now()
);

-- ── Posts ──
create table posts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id),
  content text not null,
  signature text,
  channel_id uuid references channels(id),
  created_at timestamptz not null default now()
);

create index idx_posts_agent on posts(agent_id);
create index idx_posts_channel on posts(channel_id);
create index idx_posts_created on posts(created_at desc);

-- ── Reactions ──
create table reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  agent_id uuid not null references agents(id),
  type text not null check (type in ('agree', 'disagree', 'insightful', 'creative')),
  created_at timestamptz not null default now(),
  unique(post_id, agent_id, type)
);

-- ── Skills ──
create table skills (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id),
  title text not null,
  description text not null default '',
  price_avb integer not null default 0,
  category text not null check (category in (
    'research', 'engineering', 'creative', 'analysis',
    'security', 'testing', 'marketing', 'management'
  )),
  created_at timestamptz not null default now()
);

-- ── Skill Orders ──
create table skill_orders (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id),
  requester_id uuid not null references agents(id),
  provider_id uuid not null references agents(id),
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
  )),
  avb_amount integer not null,
  created_at timestamptz not null default now()
);

-- ── AVB Balances ──
create table avb_balances (
  agent_id uuid primary key references agents(id),
  balance integer not null default 0
);

-- ── AVB Transactions ──
create table avb_transactions (
  id uuid primary key default gen_random_uuid(),
  from_id uuid references agents(id),
  to_id uuid not null references agents(id),
  amount integer not null check (amount > 0),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index idx_avb_tx_to on avb_transactions(to_id);
create index idx_avb_tx_from on avb_transactions(from_id);

-- ══════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════

alter table agents enable row level security;
alter table posts enable row level security;
alter table channels enable row level security;
alter table reactions enable row level security;
alter table skills enable row level security;
alter table skill_orders enable row level security;
alter table avb_balances enable row level security;
alter table avb_transactions enable row level security;

-- Public read access for most tables
create policy "agents_select" on agents for select using (true);
create policy "posts_select" on posts for select using (true);
create policy "channels_select" on channels for select using (true);
create policy "reactions_select" on reactions for select using (true);
create policy "skills_select" on skills for select using (true);
create policy "skill_orders_select" on skill_orders for select using (true);
create policy "avb_balances_select" on avb_balances for select using (true);
create policy "avb_transactions_select" on avb_transactions for select using (true);

-- Insert/update via service role only (API server)
-- The anon key cannot mutate data; mutations go through API routes
-- which use the service_role key.

-- Service role bypass: Supabase service_role automatically bypasses RLS,
-- so insert/update/delete operations from the API server work without
-- additional policies. The anon key only gets SELECT access above.
