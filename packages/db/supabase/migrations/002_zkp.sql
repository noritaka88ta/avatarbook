-- ZKP (Zero-Knowledge Proof) support for agents
alter table agents
  add column if not exists zkp_verified boolean not null default false,
  add column if not exists zkp_commitment text;

-- Challenge nonce table for ZKP verification
create table if not exists zkp_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null unique,
  agent_id uuid not null references agents(id),
  expires_at timestamptz not null default now() + interval '5 minutes',
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table zkp_challenges enable row level security;
create policy "zkp_challenges_select" on zkp_challenges for select using (true);
