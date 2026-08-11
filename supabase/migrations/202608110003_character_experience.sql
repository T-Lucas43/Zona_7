begin;

alter table public.characters
  add column if not exists pronouns text,
  add column if not exists identification_color text not null default '#b52532',
  add column if not exists short_description text,
  add column if not exists tagline text,
  add column if not exists character_state text not null default 'active',
  add column if not exists block_value integer,
  add column if not exists dodge_value integer,
  add column if not exists pe_per_turn integer not null default 2,
  add column if not exists published_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id);

alter table public.character_abilities drop constraint if exists character_abilities_state_check;
alter table public.character_abilities add constraint character_abilities_state_check
  check (state in ('sealed','masked','discovered','unlocked','altered','disabled','lost'));
alter table public.character_abilities
  add column if not exists sort_order integer not null default 0,
  add column if not exists unlock_rule jsonb not null default '{}'::jsonb,
  add column if not exists approval_required boolean not null default false,
  add column if not exists silent_reveal boolean not null default false,
  add column if not exists active_version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.abilities
  add column if not exists stable_key text,
  add column if not exists masked_name text,
  add column if not exists sealed_hint text,
  add column if not exists origin_text text,
  add column if not exists element text,
  add column if not exists category text,
  add column if not exists frequency text,
  add column if not exists target_text text,
  add column if not exists area_text text,
  add column if not exists resistance_test text,
  add column if not exists difficulty_formula text,
  add column if not exists success_effect text,
  add column if not exists failure_effect text,
  add column if not exists partial_effect text,
  add column if not exists paranormal_consequence text,
  add column if not exists unlock_trigger text,
  add column if not exists automatic_use_allowed boolean not null default false,
  add column if not exists icon_name text,
  add column if not exists color text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id);
create unique index if not exists abilities_campaign_stable_key on public.abilities(campaign_id, stable_key) where stable_key is not null and deleted_at is null;

alter table public.character_skills
  add column if not exists related_attribute text,
  add column if not exists training_degree text not null default 'destreinado',
  add column if not exists base_bonus integer not null default 0,
  add column if not exists temporary_bonus integer not null default 0,
  add column if not exists notes text,
  add column if not exists visibility text not null default 'owner_only',
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists version integer not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists deleted_at timestamptz;

alter table public.attacks
  add column if not exists category text not null default 'attack',
  add column if not exists action_type text,
  add column if not exists critical_text text,
  add column if not exists current_ammunition integer,
  add column if not exists maximum_ammunition integer,
  add column if not exists description text,
  add column if not exists requirements text,
  add column if not exists additional_effects text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists version integer not null default 1,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists deleted_at timestamptz;

alter table public.custom_meter_definitions
  add column if not exists color text not null default '#8f74c8',
  add column if not exists icon_name text,
  add column if not exists increase_triggers text,
  add column if not exists decrease_triggers text,
  add column if not exists automation_enabled boolean not null default false,
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

create table public.character_attribute_values (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  attribute_key text not null check (attribute_key in ('agi','for','int','pre','vig')),
  base_value integer not null default 1,
  permanent_modifier integer not null default 0,
  temporary_modifier integer not null default 0,
  gm_note text,
  change_source text,
  visibility text not null default 'owner_only',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (character_id, attribute_key)
);

create table public.character_weaknesses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  name text not null,
  narrative_description text not null,
  trigger_text text,
  test_formula text,
  difficulty integer,
  mechanical_effect text not null,
  duration_text text,
  ending_condition text,
  meter_effect integer,
  visibility text not null default 'gm_only',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz,
  unique (character_id, name)
);

create table public.character_meter_stages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  meter_definition_id uuid not null references public.custom_meter_definitions(id) on delete cascade,
  stage_value integer not null,
  name text not null,
  description text not null,
  mechanical_effect text,
  visibility text not null default 'owner_only',
  unique (meter_definition_id, stage_value)
);

create table public.character_meter_history (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  meter_definition_id uuid not null references public.custom_meter_definitions(id) on delete cascade,
  before_value integer not null,
  after_value integer not null,
  reason text not null,
  player_visible_reason text,
  changed_by uuid not null references public.profiles(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.character_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  note_type text not null,
  title text not null,
  body text not null,
  visibility text not null default 'gm_only',
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz
);

create table public.resource_transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  resource text not null check (resource in ('pv','pe','san')),
  operation text not null,
  before_value integer not null,
  delta integer not null,
  after_value integer not null,
  before_maximum integer not null,
  after_maximum integer not null,
  reason text not null,
  source text not null,
  actor_user_id uuid not null references public.profiles(id),
  audit_event_id uuid references public.audit_events(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.ability_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  change_reason text not null,
  is_template_version boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (ability_id, version_number)
);

create table public.ability_unlock_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_ability_id uuid not null references public.character_abilities(id) on delete cascade,
  previous_state text not null,
  new_state text not null,
  reason text not null,
  message text,
  silent boolean not null default false,
  actor_user_id uuid not null references public.profiles(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_user_id uuid references public.profiles(id),
  asset_type text not null check (asset_type in ('portrait','token','map','handout','image','audio','video','document')),
  title text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  width integer,
  height integer,
  crop_data jsonb not null default '{}'::jsonb,
  focal_point jsonb not null default '{}'::jsonb,
  visibility text not null default 'gm_only',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

create table public.actors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  name text not null,
  actor_type text not null check (actor_type in ('player_character','npc','entity','environment','threat','narrator')),
  public_description text,
  gm_description text,
  color text not null default '#b52532',
  default_mode text not null default 'manual',
  state text not null default 'active',
  visibility text not null default 'campaign',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (campaign_id, name)
);

create table public.actor_controllers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  control_level text not null check (control_level in ('owner','full','move','speak','view')),
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (actor_id, user_id)
);

create table public.actor_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  source_actor_id uuid not null references public.actors(id) on delete cascade,
  target_actor_id uuid not null references public.actors(id) on delete cascade,
  link_type text not null,
  description text,
  mechanics jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  unique (source_actor_id, target_actor_id, link_type)
);

create table public.actor_media (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  purpose text not null,
  is_primary boolean not null default false,
  unique (actor_id, media_asset_id, purpose)
);

create table public.synergy_tags (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  color text,
  unique (campaign_id, key)
);

create table public.entity_synergy_tags (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  synergy_tag_id uuid not null references public.synergy_tags(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  unique (synergy_tag_id, entity_type, entity_id)
);

create table public.game_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  name text not null,
  description text,
  scene_type text not null default 'map',
  state text not null default 'draft' check (state in ('draft','published','active','archived')),
  map_asset_id uuid references public.media_assets(id) on delete set null,
  grid_type text not null default 'square',
  grid_size integer not null default 64,
  distance_per_cell numeric(8,2) not null default 1.5,
  width integer not null default 1920,
  height integer not null default 1080,
  background_color text not null default '#07090b',
  fog_enabled boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  deleted_at timestamptz
);

create table public.scene_layers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.game_scenes(id) on delete cascade,
  name text not null,
  layer_type text not null,
  position integer not null default 0,
  visibility text not null default 'gm_only',
  is_locked boolean not null default false,
  is_visible boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  unique (scene_id, name)
);

create table public.scene_tokens (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.game_scenes(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  label text not null,
  x numeric(10,4) not null default 0.5 check (x between 0 and 1),
  y numeric(10,4) not null default 0.5 check (y between 0 and 1),
  size numeric(8,3) not null default 1,
  rotation numeric(8,3) not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  elevation integer not null default 0,
  token_state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (scene_id, actor_id)
);

create table public.token_movements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.game_scenes(id) on delete cascade,
  token_id uuid not null references public.scene_tokens(id) on delete cascade,
  from_x numeric(10,4) not null,
  from_y numeric(10,4) not null,
  to_x numeric(10,4) not null,
  to_y numeric(10,4) not null,
  moved_by uuid not null references public.profiles(id),
  reason text not null,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.collective_displays (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  scene_id uuid references public.game_scenes(id) on delete set null,
  mode text not null default 'cast' check (mode in ('cast','map','combat','cinematic')),
  settings jsonb not null default '{}'::jsonb,
  access_token_hash text,
  state text not null default 'inactive',
  updated_at timestamptz not null default now(),
  unique (campaign_id, session_id)
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  current_scene_id uuid references public.game_scenes(id) on delete set null,
  current_script_run_id uuid,
  sequence_number bigint not null default 0,
  state text not null default 'preparing',
  snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.live_session_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  sequence_number bigint not null,
  event_type text not null,
  audience jsonb not null default '{"kind":"party"}'::jsonb,
  payload_version integer not null default 1,
  protected_payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  server_timestamp timestamptz not null default now(),
  effective_at timestamptz not null default now(),
  idempotency_key uuid not null unique,
  unique (live_session_id, sequence_number)
);

create table public.live_event_receipts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_id uuid not null references public.live_session_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  received_at timestamptz,
  acknowledged_at timestamptz,
  client_latency_ms integer,
  unique (event_id, user_id)
);

create table public.script_packages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  state text not null default 'draft' check (state in ('draft','published','archived')),
  current_version_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (campaign_id, slug)
);

create table public.script_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_package_id uuid not null references public.script_packages(id) on delete cascade,
  version_number integer not null,
  schema_version integer not null default 1,
  canonical_document jsonb not null,
  source_format text not null,
  source_hash text not null,
  state text not null default 'draft' check (state in ('draft','validated','published','superseded')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (script_package_id, version_number),
  unique (script_package_id, source_hash)
);
alter table public.script_packages add constraint script_packages_current_version_fk foreign key (current_version_id) references public.script_versions(id) on delete set null;

create table public.script_imports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_package_id uuid references public.script_packages(id) on delete cascade,
  file_name text not null,
  source_format text not null,
  status text not null default 'uploaded',
  detected_encoding text,
  raw_storage_path text,
  normalized_document jsonb,
  imported_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.script_import_issues (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_import_id uuid not null references public.script_imports(id) on delete cascade,
  severity text not null check (severity in ('info','warning','error')),
  code text not null,
  message text not null,
  location jsonb,
  resolved_at timestamptz
);

create table public.script_nodes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id) on delete cascade,
  stable_key text not null,
  node_type text not null,
  title text not null,
  public_content jsonb not null default '{}'::jsonb,
  gm_content jsonb not null default '{}'::jsonb,
  position jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  unique (script_version_id, stable_key)
);

create table public.script_edges (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id) on delete cascade,
  source_node_id uuid not null references public.script_nodes(id) on delete cascade,
  target_node_id uuid not null references public.script_nodes(id) on delete cascade,
  edge_type text not null default 'next',
  condition_tree jsonb,
  label text,
  sort_order integer not null default 0
);

create table public.script_variables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id) on delete cascade,
  key text not null,
  value_type text not null,
  default_value jsonb,
  visibility text not null default 'gm_only',
  unique (script_version_id, key)
);

create table public.script_references (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id) on delete cascade,
  reference_key text not null,
  reference_type text not null,
  entity_id uuid,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  required boolean not null default true,
  status text not null default 'missing',
  unique (script_version_id, reference_key)
);

create table public.script_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_version_id uuid not null references public.script_versions(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  current_node_id uuid references public.script_nodes(id) on delete set null,
  status text not null default 'preparing' check (status in ('preparing','running','paused','improvising','completed','cancelled')),
  sequence_number bigint not null default 0,
  started_by uuid references public.profiles(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.live_sessions add constraint live_sessions_script_run_fk foreign key (current_script_run_id) references public.script_runs(id) on delete set null;

create table public.script_run_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_run_id uuid not null references public.script_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  status text not null default 'connected',
  unique (script_run_id, user_id)
);

create table public.script_run_state (
  script_run_id uuid primary key references public.script_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  variables jsonb not null default '{}'::jsonb,
  consumed_actions jsonb not null default '[]'::jsonb,
  current_snapshot jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.script_run_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_run_id uuid not null references public.script_runs(id) on delete cascade,
  sequence_number bigint not null,
  event_type text not null,
  audience jsonb not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique (script_run_id, sequence_number)
);

create table public.script_action_executions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_run_id uuid not null references public.script_runs(id) on delete cascade,
  script_node_id uuid not null references public.script_nodes(id) on delete cascade,
  action_instance_id uuid not null unique,
  action_type text not null,
  protected_input jsonb not null,
  status text not null default 'prepared' check (status in ('prepared','confirmed','executed','failed','cancelled','compensated')),
  result jsonb,
  error_message text,
  confirmed_by uuid references public.profiles(id),
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.script_choices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_run_id uuid not null references public.script_runs(id) on delete cascade,
  script_node_id uuid not null references public.script_nodes(id) on delete cascade,
  prompt text not null,
  options jsonb not null,
  resolution_rule text not null default 'master',
  closes_at timestamptz,
  status text not null default 'open',
  resolved_option_key text,
  resolved_at timestamptz
);

create table public.script_choice_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_choice_id uuid not null references public.script_choices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_key text,
  free_text text,
  version integer not null default 1,
  server_timestamp timestamptz not null default now(),
  unique (script_choice_id, user_id)
);

create table public.script_checkpoints (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  script_run_id uuid not null references public.script_runs(id) on delete cascade,
  name text not null,
  sequence_number bigint not null,
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

do $$
declare target text;
begin
  foreach target in array array[
    'character_attribute_values','character_weaknesses','character_meter_stages','character_meter_history','character_notes',
    'resource_transactions','ability_versions','ability_unlock_events','media_assets','actors','actor_controllers','actor_links','actor_media',
    'synergy_tags','entity_synergy_tags','game_scenes','scene_layers','scene_tokens','token_movements','collective_displays',
    'live_sessions','live_session_events','live_event_receipts','script_packages','script_versions','script_imports','script_import_issues',
    'script_nodes','script_edges','script_variables','script_references','script_runs','script_run_participants','script_run_state',
    'script_run_events','script_action_executions','script_choices','script_choice_responses','script_checkpoints'
  ] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_campaign_role(campaign_id, array[''campaign_owner'',''game_master'',''co_master''])) with check (public.has_campaign_role(campaign_id, array[''campaign_owner'',''game_master'',''co_master'']))', target || '_master', target);
  end loop;
end $$;

create policy character_attribute_values_owner_read on public.character_attribute_values for select to authenticated
using (public.is_character_owner(character_id));
create policy character_weaknesses_owner_read on public.character_weaknesses for select to authenticated
using (public.is_character_owner(character_id) and visibility in ('public','campaign','selected','owner_only'));
create policy character_meter_stages_member_read on public.character_meter_stages for select to authenticated
using (public.is_campaign_member(campaign_id) and visibility <> 'gm_only');
create policy character_meter_history_owner_read on public.character_meter_history for select to authenticated
using (public.is_character_owner(character_id) and player_visible_reason is not null);
create policy character_notes_owner_read on public.character_notes for select to authenticated
using (public.is_character_owner(character_id) and visibility in ('public','campaign','selected','owner_only'));
create policy resource_transactions_owner_read on public.resource_transactions for select to authenticated
using (public.is_character_owner(character_id));
create policy media_assets_member_read on public.media_assets for select to authenticated
using (public.is_campaign_member(campaign_id) and visibility <> 'gm_only' and deleted_at is null);
create policy actors_member_read on public.actors for select to authenticated
using (public.is_campaign_member(campaign_id) and visibility <> 'gm_only' and deleted_at is null);
create policy actor_media_member_read on public.actor_media for select to authenticated
using (public.is_campaign_member(campaign_id));
create policy synergy_tags_member_read on public.synergy_tags for select to authenticated
using (public.is_campaign_member(campaign_id));
create policy entity_synergy_tags_member_read on public.entity_synergy_tags for select to authenticated
using (public.is_campaign_member(campaign_id));
create policy game_scenes_member_read on public.game_scenes for select to authenticated
using (public.is_campaign_member(campaign_id) and state in ('published','active') and deleted_at is null);
create policy scene_layers_member_read on public.scene_layers for select to authenticated
using (public.is_campaign_member(campaign_id) and visibility <> 'gm_only' and is_visible);
create policy scene_tokens_member_read on public.scene_tokens for select to authenticated
using (public.is_campaign_member(campaign_id) and visible);
create policy collective_displays_member_read on public.collective_displays for select to authenticated
using (public.is_campaign_member(campaign_id));
create policy live_sessions_member_read on public.live_sessions for select to authenticated
using (public.is_campaign_member(campaign_id));
create policy live_session_events_audience_read on public.live_session_events for select to authenticated
using (
  public.is_campaign_member(campaign_id) and (
    audience ->> 'kind' in ('public','party')
    or (audience ->> 'kind' = 'user' and (audience -> 'userIds') ? auth.uid()::text)
  )
);
create policy live_event_receipts_own on public.live_event_receipts for select to authenticated using (user_id = auth.uid());
create policy live_event_receipts_own_update on public.live_event_receipts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy script_run_participants_own on public.script_run_participants for select to authenticated using (user_id = auth.uid());
create policy script_choices_participant on public.script_choices for select to authenticated
using (exists (select 1 from public.script_run_participants p where p.script_run_id = script_choices.script_run_id and p.user_id = auth.uid()));
create policy script_choice_responses_own on public.script_choice_responses for select to authenticated using (user_id = auth.uid());
create policy script_choice_responses_create on public.script_choice_responses for insert to authenticated with check (user_id = auth.uid());

create or replace function public.mutate_character_meter(
  p_character_id uuid, p_delta integer, p_target_value integer, p_reason text,
  p_player_visible_reason text, p_actor_user_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_meter public.character_meter_values%rowtype; v_definition public.custom_meter_definitions%rowtype; v_after integer; v_history uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_meter from public.character_meter_values where character_id = p_character_id for update;
  if v_meter.id is null then raise exception 'Medidor não encontrado'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(v_meter.campaign_id, array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select id into v_history from public.character_meter_history where idempotency_key = p_idempotency_key;
  if v_history is not null then return jsonb_build_object('historyId',v_history,'duplicate',true); end if;
  select * into v_definition from public.custom_meter_definitions where id = v_meter.meter_definition_id;
  v_after := greatest(v_definition.minimum, least(v_definition.maximum, coalesce(p_target_value, v_meter.current_value + p_delta)));
  update public.character_meter_values set current_value=v_after,version=version+1,updated_at=now() where id=v_meter.id;
  insert into public.character_meter_history(campaign_id,character_id,meter_definition_id,before_value,after_value,reason,player_visible_reason,changed_by,idempotency_key)
  values(v_meter.campaign_id,p_character_id,v_meter.meter_definition_id,v_meter.current_value,v_after,p_reason,p_player_visible_reason,p_actor_user_id,p_idempotency_key) returning id into v_history;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values(v_meter.campaign_id,p_actor_user_id,'character_meter',v_meter.id,'meter_changed','owner_only',jsonb_build_object('value',v_meter.current_value),jsonb_build_object('value',v_after),jsonb_build_object('reason',p_reason),gen_random_uuid());
  return jsonb_build_object('historyId',v_history,'before',v_meter.current_value,'after',v_after,'duplicate',false);
end $$;

create or replace function public.move_scene_token(
  p_token_id uuid, p_x numeric, p_y numeric, p_reason text, p_actor_user_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token public.scene_tokens%rowtype; v_movement uuid;
begin
  if p_x < 0 or p_x > 1 or p_y < 0 or p_y > 1 then raise exception 'Posição fora do mapa'; end if;
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_token from public.scene_tokens where id=p_token_id for update;
  if v_token.id is null then raise exception 'Token não encontrado'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(v_token.campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select id into v_movement from public.token_movements where idempotency_key=p_idempotency_key;
  if v_movement is not null then return jsonb_build_object('movementId',v_movement,'duplicate',true); end if;
  update public.scene_tokens set x=p_x,y=p_y,version=version+1,updated_at=now() where id=p_token_id;
  insert into public.token_movements(campaign_id,scene_id,token_id,from_x,from_y,to_x,to_y,moved_by,reason,idempotency_key)
  values(v_token.campaign_id,v_token.scene_id,p_token_id,v_token.x,v_token.y,p_x,p_y,p_actor_user_id,p_reason,p_idempotency_key) returning id into v_movement;
  return jsonb_build_object('movementId',v_movement,'x',p_x,'y',p_y,'duplicate',false);
end $$;

create or replace function public.update_character_identity(
  p_character_id uuid, p_expected_version integer, p_name text, p_codename text, p_origin text,
  p_class_name text, p_path_name text, p_nex integer, p_narrative_status text, p_team_role text,
  p_defense integer, p_movement numeric, p_main_dc integer, p_reason text, p_actor_user_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_character public.characters%rowtype; v_event uuid; v_version integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select id into v_event from public.audit_events where idempotency_key=p_idempotency_key;
  if v_event is not null then return jsonb_build_object('eventId',v_event,'duplicate',true); end if;
  select * into v_character from public.characters where id=p_character_id and deleted_at is null for update;
  if v_character.id is null then raise exception 'Personagem não encontrado'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(v_character.campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  if v_character.version <> p_expected_version then raise exception 'A ficha foi alterada em outro dispositivo'; end if;
  if char_length(trim(p_name)) < 2 or p_nex < 0 or p_nex > 100 or p_defense < 0 or p_movement < 0 then raise exception 'Valores inválidos'; end if;
  update public.characters set name=trim(p_name),codename=nullif(trim(p_codename),''),origin=nullif(trim(p_origin),''),class_name=nullif(trim(p_class_name),''),path_name=nullif(trim(p_path_name),''),nex=p_nex,narrative_status=nullif(trim(p_narrative_status),''),team_role=nullif(trim(p_team_role),''),defense=p_defense,movement=p_movement,main_dc=p_main_dc,version=version+1,updated_by=p_actor_user_id,updated_at=now() where id=p_character_id returning version into v_version;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values(v_character.campaign_id,p_actor_user_id,'character',p_character_id,'character_identity_updated','owner_only',to_jsonb(v_character)-'player_private_history'-'portrait_path',jsonb_build_object('name',p_name,'codename',p_codename,'origin',p_origin,'className',p_class_name,'pathName',p_path_name,'nex',p_nex,'status',p_narrative_status,'teamRole',p_team_role,'defense',p_defense,'movement',p_movement,'mainDc',p_main_dc,'version',v_version),jsonb_build_object('reason',p_reason),p_idempotency_key) returning id into v_event;
  return jsonb_build_object('eventId',v_event,'version',v_version,'duplicate',false);
end $$;

create or replace function public.control_script_run(
  p_campaign_id uuid, p_actor_user_id uuid, p_action text, p_script_package_id uuid default null,
  p_run_id uuid default null, p_target_stable_key text default null,
  p_reason text default 'Controle manual do mestre', p_idempotency_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_package public.script_packages%rowtype;
  v_version public.script_versions%rowtype;
  v_run public.script_runs%rowtype;
  v_node public.script_nodes%rowtype;
  v_session_id uuid;
  v_run_id uuid;
  v_sequence bigint;
  v_live_id uuid;
  v_live_sequence bigint;
  v_status text;
  v_current_stable text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  if p_action not in ('start','advance','pause','resume','improvise','complete') then raise exception 'Ação de roteiro inválida'; end if;

  select script_run_id into v_run_id from public.script_run_events where idempotency_key=p_idempotency_key;
  if v_run_id is not null then
    select * into v_run from public.script_runs where id=v_run_id;
    select stable_key into v_current_stable from public.script_nodes where id=v_run.current_node_id;
    return jsonb_build_object('runId',v_run.id,'status',v_run.status,'sequence',v_run.sequence_number,'currentNodeKey',v_current_stable,'duplicate',true);
  end if;

  if p_action='start' then
    select * into v_package from public.script_packages where id=p_script_package_id and campaign_id=p_campaign_id and state='published' and deleted_at is null for update;
    if v_package.id is null or v_package.current_version_id is null then raise exception 'Publique o roteiro antes de executá-lo'; end if;
    select * into v_version from public.script_versions where id=v_package.current_version_id and state='published';
    select * into v_node from public.script_nodes where script_version_id=v_version.id and stable_key=coalesce(v_version.canonical_document->>'startNodeId',v_version.canonical_document->>'start');
    if v_node.id is null then raise exception 'Nó inicial não encontrado'; end if;
    select id into v_session_id from public.sessions where campaign_id=p_campaign_id and status not in ('ended','archived') order by created_at desc limit 1;
    if v_session_id is null then raise exception 'Crie uma sessão antes de executar o roteiro'; end if;
    insert into public.script_runs(campaign_id,script_version_id,session_id,current_node_id,status,sequence_number,started_by,started_at)
    values(p_campaign_id,v_version.id,v_session_id,v_node.id,'running',1,p_actor_user_id,now()) returning * into v_run;
    insert into public.script_run_state(script_run_id,campaign_id,variables,current_snapshot)
    values(v_run.id,p_campaign_id,coalesce(v_version.canonical_document->'variables','{}'::jsonb),jsonb_build_object('currentNodeKey',v_node.stable_key,'status','running'));
    v_run_id := v_run.id; v_sequence := 1; v_status := 'running'; v_current_stable := v_node.stable_key;
  else
    select * into v_run from public.script_runs where id=p_run_id and campaign_id=p_campaign_id for update;
    if v_run.id is null then raise exception 'Execução não encontrada'; end if;
    v_run_id := v_run.id; v_session_id := v_run.session_id; v_status := v_run.status;
    select stable_key into v_current_stable from public.script_nodes where id=v_run.current_node_id;
    if p_action='advance' then
      if p_target_stable_key is null then raise exception 'Escolha o próximo nó'; end if;
      select target.* into v_node from public.script_edges edge
      join public.script_nodes target on target.id=edge.target_node_id
      where edge.source_node_id=v_run.current_node_id and target.stable_key=p_target_stable_key limit 1;
      if v_node.id is null then raise exception 'O destino não pertence a uma saída válida do nó atual'; end if;
      v_current_stable := v_node.stable_key;
      update public.script_runs set current_node_id=v_node.id,status='running',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run;
      v_status := 'running';
    elsif p_action='pause' then
      if v_run.status not in ('running','improvising') then raise exception 'A execução não pode ser pausada neste estado'; end if;
      update public.script_runs set status='paused',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run; v_status := 'paused';
    elsif p_action='resume' then
      if v_run.status not in ('paused','improvising') then raise exception 'A execução não está pausada'; end if;
      update public.script_runs set status='running',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run; v_status := 'running';
    elsif p_action='improvise' then
      update public.script_runs set status='improvising',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run; v_status := 'improvising';
    elsif p_action='complete' then
      update public.script_runs set status='completed',sequence_number=sequence_number+1,ended_at=now() where id=v_run.id returning * into v_run; v_status := 'completed';
    end if;
    v_sequence := v_run.sequence_number;
    update public.script_run_state set current_snapshot=jsonb_build_object('currentNodeKey',v_current_stable,'status',v_status,'lastAction',p_action,'reason',p_reason),version=version+1,updated_at=now() where script_run_id=v_run.id;
  end if;

  insert into public.script_run_events(campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key)
  values(p_campaign_id,v_run_id,v_sequence,'script_'||p_action,'{"kind":"party"}'::jsonb,jsonb_build_object('currentNodeKey',v_current_stable,'status',v_status,'reason',p_reason),p_actor_user_id,p_idempotency_key);
  insert into public.live_sessions as current_live(campaign_id,session_id,current_script_run_id,sequence_number,state,snapshot,started_at,updated_at)
  values(p_campaign_id,v_session_id,v_run_id,1,v_status,jsonb_build_object('scriptRunId',v_run_id,'currentNodeKey',v_current_stable,'status',v_status),now(),now())
  on conflict(session_id) do update set current_script_run_id=excluded.current_script_run_id,sequence_number=current_live.sequence_number+1,state=excluded.state,snapshot=excluded.snapshot,updated_at=now()
  returning id,sequence_number into v_live_id,v_live_sequence;
  insert into public.live_session_events(campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key)
  values(p_campaign_id,v_live_id,v_live_sequence,'script_'||p_action,'{"kind":"party"}'::jsonb,jsonb_build_object('scriptRunId',v_run_id,'currentNodeKey',v_current_stable,'status',v_status),p_actor_user_id,p_idempotency_key);
  return jsonb_build_object('runId',v_run_id,'status',v_status,'sequence',v_sequence,'currentNodeKey',v_current_stable,'duplicate',false);
end $$;

revoke all on function public.mutate_character_meter(uuid,integer,integer,text,text,uuid,uuid) from public;
revoke all on function public.move_scene_token(uuid,numeric,numeric,text,uuid,uuid) from public;
revoke all on function public.update_character_identity(uuid,integer,text,text,text,text,text,integer,text,text,integer,numeric,integer,text,uuid,uuid) from public;
revoke all on function public.control_script_run(uuid,uuid,text,uuid,uuid,text,text,uuid) from public;
grant execute on function public.mutate_character_meter(uuid,integer,integer,text,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.move_scene_token(uuid,numeric,numeric,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.update_character_identity(uuid,integer,text,text,text,text,text,integer,text,text,integer,numeric,integer,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.control_script_run(uuid,uuid,text,uuid,uuid,text,text,uuid) to authenticated, service_role;

do $$
declare target text;
begin
  foreach target in array array[
    'character_attribute_values','character_weaknesses','character_meter_stages','character_meter_history','character_notes','resource_transactions',
    'ability_versions','ability_unlock_events','media_assets','actors','actor_controllers','actor_links','actor_media','synergy_tags','entity_synergy_tags',
    'game_scenes','scene_layers','scene_tokens','token_movements','collective_displays','live_sessions','live_session_events','live_event_receipts',
    'script_packages','script_versions','script_imports','script_import_issues','script_nodes','script_edges','script_variables','script_references',
    'script_runs','script_run_participants','script_run_state','script_run_events','script_action_executions','script_choices','script_choice_responses','script_checkpoints'
  ] loop execute format('grant select,insert,update,delete on public.%I to authenticated, service_role',target); end loop;
end $$;

alter publication supabase_realtime add table public.scene_tokens;
alter publication supabase_realtime add table public.live_session_events;
alter publication supabase_realtime add table public.script_choice_responses;

commit;
