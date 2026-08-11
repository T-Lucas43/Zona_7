begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  avatar_path text,
  must_change_password boolean not null default false,
  platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sound_enabled boolean not null default true,
  motion_enabled boolean not null default true,
  high_contrast boolean not null default false,
  notifications_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Belem',
  updated_at timestamptz not null default now()
);

create table public.rule_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  defaults jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  rule_profile_id uuid references public.rule_profiles(id),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique,
  system_code text not null,
  language_code text not null default 'pt-BR',
  timezone text not null default 'America/Belem',
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  public_premise text,
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.campaign_secrets (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  gm_notes text,
  secrets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('campaign_owner','game_master','co_master','player','spectator')),
  status text not null default 'active' check (status in ('invited','active','suspended','left')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create table public.campaign_permissions (
  id uuid primary key default gen_random_uuid(),
  campaign_member_id uuid not null references public.campaign_members(id) on delete cascade,
  permission text not null,
  allowed boolean not null default false,
  unique (campaign_member_id, permission)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  email citext not null,
  display_name text not null,
  role text not null default 'player' check (role in ('game_master','co_master','player','spectator')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.campaign_rule_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  zero_hp_mode text not null default 'dying' check (zero_hp_mode in ('dead','dying','unconscious','custom')),
  zero_sanity_mode text not null default 'absorbed_by_zone' check (zero_sanity_mode in ('absorbed_by_zone','insane','controlled_by_master','custom')),
  pressure integer not null default 0 check (pressure between 0 and 7),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.character_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  nex integer not null default 0 check (nex between 0 and 100),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  template_id uuid references public.character_templates(id),
  name text not null,
  codename text,
  portrait_path text,
  origin text,
  class_name text,
  path_name text,
  nex integer not null default 0 check (nex between 0 and 100),
  narrative_status text,
  team_role text,
  affinities text[] not null default '{}',
  public_history text,
  player_private_history text,
  defense integer not null default 10,
  movement numeric(8,2) not null default 9,
  main_dc integer,
  is_npc boolean not null default false,
  visibility text not null default 'selected' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.character_secrets (
  character_id uuid primary key references public.characters(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  gm_notes text,
  weaknesses text[],
  secret_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.character_owners (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (character_id, user_id)
);

create table public.character_attributes (
  character_id uuid primary key references public.characters(id) on delete cascade,
  agility integer not null default 1,
  strength integer not null default 1,
  intellect integer not null default 1,
  presence integer not null default 1,
  vigor integer not null default 1,
  fortitude integer not null default 0,
  reflexes integer not null default 0,
  willpower integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.character_resources (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  resource text not null check (resource in ('pv','pe','san')),
  current_value integer not null check (current_value >= 0),
  maximum_value integer not null check (maximum_value >= 0),
  temporary_value integer not null default 0 check (temporary_value >= 0),
  allow_overflow boolean not null default false,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  unique (character_id, resource),
  check (allow_overflow or current_value <= maximum_value)
);

create table public.character_skills (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  name text not null,
  bonus integer not null default 0,
  trained boolean not null default false,
  formula text,
  unique (character_id, name)
);

create table public.attacks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  name text not null,
  attack_formula text not null,
  damage_formula text not null,
  damage_type text,
  range_text text,
  visibility text not null default 'owner_only' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.abilities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  public_description text,
  action_type text not null,
  costs jsonb not null default '{}'::jsonb,
  range_text text,
  duration_text text,
  usage_limit jsonb,
  requirements jsonb not null default '{}'::jsonb,
  test_formula text,
  difficulty integer,
  effects jsonb not null default '[]'::jsonb,
  meter_triggers jsonb not null default '[]'::jsonb,
  recommended_nex integer not null default 0,
  version integer not null default 1,
  visibility text not null default 'gm_only' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.ability_secrets (
  ability_id uuid primary key references public.abilities(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  gm_description text,
  protected_rules jsonb not null default '{}'::jsonb
);

create table public.character_abilities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  state text not null default 'sealed' check (state in ('sealed','discovered','unlocked','altered','disabled')),
  public_override text,
  structured_override jsonb,
  unlocked_at timestamptz,
  unlocked_by uuid references public.profiles(id),
  usage_counters jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  unique (character_id, ability_id)
);

create table public.custom_meter_definitions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  minimum integer not null default 0,
  maximum integer not null default 5,
  stages jsonb not null,
  rules jsonb not null default '{}'::jsonb,
  check (minimum < maximum)
);

create table public.character_meter_values (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  meter_definition_id uuid not null references public.custom_meter_definitions(id) on delete cascade,
  current_value integer not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (character_id, meter_definition_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  description text,
  category text,
  weight numeric(10,2),
  mechanical_effect jsonb,
  visibility text not null default 'campaign' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.item_secrets (
  item_id uuid primary key references public.items(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  secret_description text,
  protected_data jsonb not null default '{}'::jsonb
);

create table public.character_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity integer not null default 1 check (quantity >= 0),
  charges integer check (charges >= 0),
  ammunition integer check (ammunition >= 0),
  state text,
  version integer not null default 1,
  unique (character_id, item_id)
);

create table public.condition_definitions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  description text,
  effects jsonb not null default '{}'::jsonb,
  default_visibility text not null default 'campaign' check (default_visibility in ('public','campaign','selected','owner_only','gm_only')),
  unique (campaign_id, name)
);

create table public.character_conditions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  condition_definition_id uuid not null references public.condition_definitions(id),
  source text,
  duration_unit text check (duration_unit in ('turn','round','scene','session','permanent')),
  remaining integer check (remaining is null or remaining >= 0),
  visibility text not null default 'campaign' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  applied_by uuid references public.profiles(id),
  applied_at timestamptz not null default now(),
  removed_at timestamptz,
  version integer not null default 1
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','open','active','paused','ended','archived')),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  current_scene_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  title text not null,
  status text not null default 'pending' check (status in ('pending','active','completed','skipped')),
  position integer not null default 0,
  gm_notes text,
  public_summary text,
  started_at timestamptz,
  ended_at timestamptz
);

alter table public.sessions add constraint sessions_current_scene_fk foreign key (current_scene_id) references public.session_scenes(id) on delete set null;

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  status text not null default 'offline' check (status in ('offline','online','reconnecting')),
  last_seen_at timestamptz,
  unique (session_id, user_id)
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  round integer not null default 0 check (round >= 0),
  current_turn_position integer,
  gm_notes text,
  difficulty_adjustments jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.encounter_combatants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  display_name text not null,
  kind text not null check (kind in ('character','ally','npc','enemy')),
  initiative integer,
  position integer not null default 0,
  current_hp integer,
  maximum_hp integer,
  hidden_hp boolean not null default false,
  visible_state text,
  actions_state jsonb not null default '{}'::jsonb,
  private_notes text,
  version integer not null default 1
);

create table public.roll_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  character_id uuid references public.characters(id) on delete cascade,
  skill_or_attribute text not null,
  difficulty integer,
  context text not null,
  visibility text not null check (visibility in ('session','player_master','master','hidden')),
  consequences jsonb,
  status text not null default 'pending' check (status in ('pending','answered','expired','revoked')),
  expires_at timestamptz,
  answered_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  roll_request_id uuid references public.roll_requests(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  user_id uuid not null references public.profiles(id),
  formula text not null,
  rolls integer[] not null,
  kept_indexes integer[] not null,
  modifier integer not null default 0,
  total integer not null,
  purpose text not null,
  visibility text not null check (visibility in ('session','player_master','master','hidden')),
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  apparent_sender_name text not null,
  format text not null,
  visibility text not null check (visibility in ('selected','gm_only')),
  status text not null default 'created' check (status in ('created','scheduled','sent','delivered','opened','answered','expired','revoked')),
  spoiler_safe_preview text not null default 'Nova mensagem da Zona 7',
  send_at timestamptz,
  expires_at timestamptz,
  view_limit integer,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.message_sender_profiles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  sender_type text not null check (sender_type in ('master','system','npc','entity','unknown','custom')),
  avatar_path text,
  visual_style jsonb not null default '{}'::jsonb,
  notification_label text not null default 'Nova mensagem da Zona 7',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, name)
);

create table public.message_sender_secrets (
  message_id uuid primary key references public.messages(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  real_sender_user_id uuid not null references public.profiles(id)
);

create table public.message_contents (
  message_id uuid primary key references public.messages(id) on delete cascade,
  body text,
  storage_path text,
  mime_type text,
  choice_options jsonb,
  protected_payload jsonb not null default '{}'::jsonb
);

create table public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  opened_at timestamptz,
  view_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','delivered','opened','answered','expired','revoked')),
  unique (message_id, user_id)
);

create table public.message_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  response_type text not null,
  protected_body text,
  structured_response jsonb,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table public.scheduled_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  event_type text not null,
  trigger_type text not null,
  due_at timestamptz,
  trigger_data jsonb not null default '{}'::jsonb,
  protected_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed','cancelled')),
  attempts integer not null default 0,
  idempotency_key uuid not null unique,
  processed_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.handouts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  type text not null,
  state text not null default 'hidden' check (state in ('hidden','discovered','shared','corrupted')),
  visibility text not null default 'gm_only' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  public_excerpt text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.handout_contents (
  handout_id uuid primary key references public.handouts(id) on delete cascade,
  protected_text text,
  storage_path text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create table public.handout_access (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  handout_id uuid not null references public.handouts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  access_level text not null default 'read' check (access_level in ('preview','read','share')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  check (num_nonnulls(user_id, character_id) = 1)
);

create table public.resource_threshold_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  resource text not null check (resource in ('pv','pe','san')),
  key text not null,
  label text not null,
  percent numeric(5,2) not null check (percent between 0 and 100),
  severity text not null check (severity in ('warning','critical','zero')),
  enabled boolean not null default true,
  unique (campaign_id, key)
);

create table public.resource_threshold_states (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  rule_id uuid not null references public.resource_threshold_rules(id) on delete cascade,
  armed boolean not null default true,
  last_crossed_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id),
  unique (character_id, rule_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  type text not null,
  title text not null,
  safe_preview text not null,
  protected_payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  encounter_id uuid references public.encounters(id) on delete set null,
  actor_user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  visibility text not null default 'gm_only' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key uuid unique,
  compensates_event_id uuid references public.audit_events(id),
  created_at timestamptz not null default now()
);

create table public.threat_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  challenge_rating integer not null,
  defense integer not null,
  maximum_hp integer not null,
  movement numeric(8,2) not null,
  abilities jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  visibility text not null default 'gm_only' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  created_at timestamptz not null default now()
);

create table public.campaign_custom_fields (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entity_type text not null check (entity_type in ('character','ability','item','session','encounter','message','handout')),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null,
  input_type text not null check (input_type in ('text','textarea','number','boolean','select','multiselect','date','datetime','url','color')),
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  default_value jsonb,
  visibility text not null default 'campaign' check (visibility in ('public','campaign','selected','owner_only','gm_only')),
  editable_by_roles text[] not null default array['campaign_owner','game_master'],
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, entity_type, field_key)
);

create table public.campaign_ui_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  labels jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{"accent":"#b52532","energy":"#4b9be8"}'::jsonb,
  navigation jsonb not null default '[]'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index campaign_members_user_idx on public.campaign_members(user_id, status);
create index invitations_campaign_status_idx on public.invitations(campaign_id, status, expires_at);
create index characters_campaign_idx on public.characters(campaign_id) where deleted_at is null;
create index character_resources_campaign_idx on public.character_resources(campaign_id, character_id);
create index character_abilities_character_idx on public.character_abilities(character_id, state);
create index sessions_campaign_status_idx on public.sessions(campaign_id, status, scheduled_at);
create index encounters_session_status_idx on public.encounters(session_id, status);
create index dice_rolls_session_created_idx on public.dice_rolls(session_id, created_at desc);
create index messages_campaign_status_idx on public.messages(campaign_id, status, send_at);
create index message_recipients_user_idx on public.message_recipients(user_id, status);
create index scheduled_events_due_idx on public.scheduled_events(status, due_at) where status = 'pending';
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_events_campaign_created_idx on public.audit_events(campaign_id, created_at desc);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles','user_preferences','rule_profiles','campaigns','campaign_members','campaign_rule_settings',
    'character_templates','characters','character_secrets','character_attributes','character_resources','attacks',
    'abilities','character_meter_values','items','sessions','messages','message_sender_profiles','handouts',
    'campaign_custom_fields','campaign_ui_settings'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', target);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'operador'), '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
