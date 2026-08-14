begin;

create table if not exists public.actor_combat_profiles (
  actor_id uuid primary key references public.actors(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  classification text not null default 'NPC',
  threat_level integer not null default 0 check (threat_level between 0 and 999),
  defense integer not null default 10 check (defense between 0 and 999),
  movement integer not null default 9 check (movement between 0 and 999),
  initiative_bonus integer not null default 0 check (initiative_bonus between -999 and 999),
  agility integer not null default 1 check (agility between 0 and 99),
  strength integer not null default 1 check (strength between 0 and 99),
  intellect integer not null default 1 check (intellect between 0 and 99),
  presence integer not null default 1 check (presence between 0 and 99),
  vigor integer not null default 1 check (vigor between 0 and 99),
  current_hp integer not null default 10 check (current_hp >= 0),
  maximum_hp integer not null default 10 check (maximum_hp > 0),
  current_pe integer not null default 0 check (current_pe >= 0),
  maximum_pe integer not null default 0 check (maximum_pe >= 0),
  current_san integer not null default 0 check (current_san >= 0),
  maximum_san integer not null default 0 check (maximum_san >= 0),
  resistances jsonb not null default '{}'::jsonb,
  skills jsonb not null default '{}'::jsonb,
  conditions text[] not null default '{}'::text[],
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_hp <= maximum_hp),
  check (current_pe <= maximum_pe),
  check (current_san <= maximum_san)
);

create table if not exists public.actor_attacks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  name text not null,
  attack_formula text not null default '1d20',
  damage_formula text not null default '1d6',
  damage_type text,
  range_text text,
  action_type text not null default 'padrao',
  description text,
  requirements text,
  additional_effects text,
  resource_kind text check (resource_kind in ('pv','pe','san')),
  resource_cost integer not null default 0 check (resource_cost >= 0),
  target_scope text not null default 'enemy' check (target_scope in ('self','ally','enemy','any')),
  target_min integer not null default 1 check (target_min >= 0),
  target_max integer not null default 1 check (target_max >= target_min and target_max <= 20),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.abilities
  add column if not exists target_scope text not null default 'any',
  add column if not exists target_min integer not null default 0,
  add column if not exists target_max integer not null default 1;

alter table public.attacks
  add column if not exists target_scope text not null default 'enemy',
  add column if not exists target_min integer not null default 1,
  add column if not exists target_max integer not null default 1;

alter table public.roll_requests
  add column if not exists request_kind text not null default 'check',
  add column if not exists character_attack_id uuid references public.attacks(id) on delete cascade,
  add column if not exists actor_attack_id uuid references public.actor_attacks(id) on delete cascade,
  add column if not exists encounter_id uuid references public.encounters(id) on delete set null,
  add column if not exists encounter_combatant_id uuid references public.encounter_combatants(id) on delete set null,
  add column if not exists target_character_ids uuid[] not null default '{}'::uuid[],
  add column if not exists target_actor_ids uuid[] not null default '{}'::uuid[],
  add column if not exists target_snapshot jsonb not null default '[]'::jsonb;

alter table public.encounter_combatants
  add column if not exists actor_id uuid references public.actors(id) on delete set null;

alter table public.encounters
  add column if not exists initiative_state text not null default 'idle',
  add column if not exists initiative_requested_at timestamptz;

alter table public.dice_rolls
  add column if not exists actor_id uuid references public.actors(id) on delete set null;

create index if not exists actor_attacks_actor_idx on public.actor_attacks(actor_id, sort_order);
create index if not exists roll_requests_combat_idx on public.roll_requests(session_id, request_kind, status, created_at desc);
create index if not exists encounter_combatants_actor_idx on public.encounter_combatants(encounter_id, actor_id);

alter table public.actor_combat_profiles enable row level security;
alter table public.actor_combat_profiles force row level security;
alter table public.actor_attacks enable row level security;
alter table public.actor_attacks force row level security;

create policy actor_combat_profiles_master on public.actor_combat_profiles for all to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy actor_attacks_master on public.actor_attacks for all to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

alter publication supabase_realtime add table public.actor_combat_profiles;
alter publication supabase_realtime add table public.actor_attacks;
alter table public.actor_combat_profiles replica identity full;
alter table public.actor_attacks replica identity full;

commit;
