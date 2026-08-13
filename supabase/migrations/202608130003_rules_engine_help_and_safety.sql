begin;

alter table public.sessions
  add column if not exists rules_snapshot_revision integer not null default 0;

alter table public.dice_rolls
  add column if not exists roller_display_name text;

alter table public.encounter_combatants
  add column if not exists initiative_bonus integer not null default 0,
  add column if not exists agility integer not null default 0;

create table if not exists public.character_turn_resource_usage (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  round integer not null check (round > 0),
  turn_position integer not null check (turn_position >= 0),
  resource text not null check (resource in ('pv','pe','san')),
  spent integer not null default 0 check (spent >= 0),
  updated_at timestamptz not null default now(),
  unique(encounter_id,round,turn_position,character_id,resource)
);

create or replace function public.advance_encounter_turn_synced(
  p_campaign_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb; v_encounter public.encounters%rowtype; v_current_position integer;
  v_next_position integer; v_next_name text; v_next_character uuid; v_round integer;
  v_live public.live_sessions%rowtype; v_run public.script_runs%rowtype; v_payload jsonb;
  v_script_sequence bigint; v_live_sequence bigint;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão para avançar o turno'; end if;
  select after_data into v_existing from public.audit_events where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing||jsonb_build_object('duplicate',true); end if;
  select * into v_encounter from public.encounters where campaign_id=p_campaign_id and session_id=p_session_id and status in ('active','paused') order by created_at desc limit 1 for update;
  if v_encounter.id is null then raise exception 'Não há encontro ativo para avançar o turno'; end if;
  v_current_position:=v_encounter.current_turn_position;
  select min(position) into v_next_position from public.encounter_combatants where encounter_id=v_encounter.id and (v_current_position is null or position>v_current_position);
  v_round:=v_encounter.round;
  if v_next_position is null then
    select min(position) into v_next_position from public.encounter_combatants where encounter_id=v_encounter.id;
    if v_current_position is not null then v_round:=v_round+1; end if;
  end if;
  if v_next_position is null then raise exception 'Encontro sem combatentes'; end if;
  select display_name,character_id into v_next_name,v_next_character from public.encounter_combatants where encounter_id=v_encounter.id and position=v_next_position order by id limit 1;
  update public.encounters set current_turn_position=v_next_position,round=v_round,version=version+1 where id=v_encounter.id;
  if v_next_character is not null then
    perform public.process_start_of_turn_effects(p_campaign_id,p_session_id,v_next_character,p_actor_user_id,gen_random_uuid());
  end if;
  v_payload:=jsonb_build_object('encounterId',v_encounter.id,'round',v_round,'turnPosition',v_next_position,'currentTurn',v_next_name,'currentCharacterId',v_next_character);
  select * into v_live from public.live_sessions where campaign_id=p_campaign_id and session_id=p_session_id for update;
  if v_live.current_script_run_id is not null then
    select * into v_run from public.script_runs where id=v_live.current_script_run_id for update;
    if v_run.id is not null then
      v_script_sequence:=v_run.sequence_number+1;
      update public.script_runs set sequence_number=v_script_sequence where id=v_run.id;
      update public.script_run_state set current_snapshot=current_snapshot||jsonb_build_object('lastAction','combat_turn_advanced','combat',v_payload),version=version+1,updated_at=now() where script_run_id=v_run.id;
      insert into public.script_run_events(campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key)
      values(p_campaign_id,v_run.id,v_script_sequence,'combat_turn_advanced','{"kind":"party"}',v_payload,p_actor_user_id,p_idempotency_key);
    end if;
  end if;
  if v_live.id is not null then
    v_live_sequence:=v_live.sequence_number+1;
    update public.live_sessions set sequence_number=v_live_sequence,snapshot=snapshot||jsonb_build_object('combat',v_payload),updated_at=now() where id=v_live.id;
    insert into public.live_session_events(campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key)
    values(p_campaign_id,v_live.id,v_live_sequence,'combat_turn_advanced','{"kind":"party"}',v_payload,p_actor_user_id,p_idempotency_key);
  end if;
  v_payload:=v_payload||jsonb_build_object('scriptRunId',v_live.current_script_run_id,'scriptSequence',v_script_sequence,'liveSequence',v_live_sequence,'duplicate',false);
  insert into public.audit_events(campaign_id,session_id,encounter_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_session_id,v_encounter.id,p_actor_user_id,'encounter',v_encounter.id,'combat_turn_advanced','gm_only',v_payload,p_idempotency_key);
  return v_payload;
end $$;

create table if not exists public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.rule_profiles(id) on delete cascade,
  key text not null,
  category text not null,
  title text not null,
  player_summary text not null default '',
  master_summary text not null default '',
  visibility text not null default 'public' check (visibility in ('public','player','gm_only')),
  current_version integer not null default 1 check (current_version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,key)
);

create table if not exists public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_definition_id uuid not null references public.rule_definitions(id) on delete cascade,
  version integer not null check (version > 0),
  payload jsonb not null,
  change_note text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(rule_definition_id,version)
);

create table if not exists public.campaign_rule_overrides (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  rule_definition_id uuid not null references public.rule_definitions(id) on delete cascade,
  version integer not null default 1,
  payload jsonb not null,
  enabled boolean not null default true,
  change_note text not null,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,rule_definition_id)
);

create table if not exists public.session_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  revision integer not null,
  profile_id uuid not null references public.rule_profiles(id),
  reason text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(session_id,revision)
);

create table if not exists public.session_rule_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.session_rule_snapshots(id) on delete cascade,
  rule_definition_id uuid not null references public.rule_definitions(id),
  rule_key text not null,
  rule_version integer not null,
  source text not null check (source in ('profile','campaign_override','session_revision')),
  payload jsonb not null,
  unique(snapshot_id,rule_definition_id)
);

create table if not exists public.rule_change_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  rule_definition_id uuid references public.rule_definitions(id) on delete set null,
  actor_user_id uuid references public.profiles(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.rule_profiles(id) on delete cascade,
  rule_definition_id uuid references public.rule_definitions(id) on delete set null,
  slug text not null,
  category text not null,
  audience text not null check (audience in ('player','master','both')),
  visibility text not null default 'public' check (visibility in ('public','campaign','owner_only','gm_only')),
  current_version integer not null default 1,
  published boolean not null default true,
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(profile_id,slug)
);

create table if not exists public.help_article_versions (
  id uuid primary key default gen_random_uuid(),
  help_article_id uuid not null references public.help_articles(id) on delete cascade,
  version integer not null,
  title text not null,
  summary text not null,
  content text not null,
  keywords text[] not null default '{}',
  change_note text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(help_article_id,version)
);

create table if not exists public.help_article_links (
  id uuid primary key default gen_random_uuid(),
  help_article_id uuid not null references public.help_articles(id) on delete cascade,
  label text not null,
  href text not null check (href ~ '^/'),
  position integer not null default 0
);

create table if not exists public.help_feedback (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  help_article_id uuid not null references public.help_articles(id) on delete cascade,
  reported_by uuid not null references public.profiles(id),
  message text not null check (char_length(message) between 3 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

alter table public.condition_definitions
  add column if not exists key text,
  add column if not exists category text not null default 'general',
  add column if not exists trigger_text text,
  add column if not exists removal_test jsonb not null default '{}'::jsonb,
  add column if not exists evolution_key text;

alter table public.character_conditions
  add column if not exists turn_starts integer not null default 0,
  add column if not exists scene_id uuid references public.session_scenes(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.extended_tests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null,
  skill text not null,
  difficulty integer not null,
  required_successes integer not null check (required_successes in (3,5,7)),
  successes integer not null default 0,
  failures integer not null default 0 check (failures between 0 and 3),
  increasing_difficulty boolean not null default false,
  unique_approaches boolean not null default false,
  status text not null default 'active' check (status in ('active','succeeded','failed','cancelled')),
  visibility text not null default 'campaign' check (visibility in ('campaign','selected','gm_only')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.extended_test_contributions (
  id uuid primary key default gen_random_uuid(),
  extended_test_id uuid not null references public.extended_tests(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  user_id uuid not null references public.profiles(id),
  approach text not null,
  skill text not null,
  roll_id uuid references public.dice_rolls(id) on delete set null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.safety_preferences (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  allowed_topics text[] not null default '{}',
  veiled_topics text[] not null default '{}',
  excluded_topics text[] not null default '{}',
  share_with_co_masters boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(campaign_id,user_id)
);

create table if not exists public.safety_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  tool text not null check (tool in ('pause','cut','rewind','open_door','check_in','debrief')),
  private_to_master boolean not null default true,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index if not exists rule_definitions_profile_category_idx on public.rule_definitions(profile_id,category) where archived_at is null;
create index if not exists help_articles_profile_audience_idx on public.help_articles(profile_id,audience) where published and archived_at is null;
create index if not exists rule_snapshots_session_idx on public.session_rule_snapshots(session_id,revision desc);
create index if not exists safety_events_master_idx on public.safety_events(campaign_id,status,created_at desc);

create or replace function public.resolve_effective_rule(p_campaign_id uuid,p_rule_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(override.payload,version.payload)
  from public.campaigns campaign
  join public.rule_definitions definition on definition.profile_id=campaign.rule_profile_id and definition.key=p_rule_key and definition.archived_at is null
  join public.rule_versions version on version.rule_definition_id=definition.id and version.version=definition.current_version
  left join public.campaign_rule_overrides override on override.campaign_id=campaign.id and override.rule_definition_id=definition.id and override.enabled
  where campaign.id=p_campaign_id
    and (public.is_campaign_member(campaign.id) or auth.role()='service_role')
$$;

create or replace function public.create_rules_snapshot(
  p_campaign_id uuid,p_session_id uuid,p_actor_user_id uuid,p_reason text default 'Início da sessão'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_snapshot uuid; v_revision integer; v_profile uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select rule_profile_id into v_profile from public.campaigns where id=p_campaign_id;
  if v_profile is null then raise exception 'Campanha inválida'; end if;
  select rules_snapshot_revision+1 into v_revision from public.sessions where id=p_session_id and campaign_id=p_campaign_id for update;
  if v_revision is null then raise exception 'Sessão inválida'; end if;
  insert into public.session_rule_snapshots(campaign_id,session_id,revision,profile_id,reason,created_by)
  values(p_campaign_id,p_session_id,v_revision,v_profile,p_reason,p_actor_user_id) returning id into v_snapshot;
  insert into public.session_rule_snapshot_items(snapshot_id,rule_definition_id,rule_key,rule_version,source,payload)
  select v_snapshot,definition.id,definition.key,
    coalesce(override.version,definition.current_version),
    case when override.id is null then 'profile' else 'campaign_override' end,
    coalesce(override.payload,version.payload)
  from public.rule_definitions definition
  join public.rule_versions version on version.rule_definition_id=definition.id and version.version=definition.current_version
  left join public.campaign_rule_overrides override on override.campaign_id=p_campaign_id and override.rule_definition_id=definition.id and override.enabled
  where definition.profile_id=v_profile and definition.archived_at is null;
  update public.sessions set rules_snapshot_revision=v_revision,updated_at=now() where id=p_session_id;
  insert into public.rule_change_log(campaign_id,session_id,actor_user_id,action,after_data,reason)
  values(p_campaign_id,p_session_id,p_actor_user_id,'snapshot_created',jsonb_build_object('snapshotId',v_snapshot,'revision',v_revision),p_reason);
  return v_snapshot;
end;
$$;

create or replace function public.control_session_runtime_v2(
  p_campaign_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_live public.live_sessions%rowtype;
  v_run_id uuid;
  v_snapshot_id uuid;
begin
  v_result:=public.control_session_runtime(
    p_campaign_id,p_session_id,p_actor_user_id,p_action,p_idempotency_key
  );
  if coalesce((v_result->>'duplicate')::boolean,false) then return v_result; end if;
  if p_action='restart' then
    select * into v_live from public.live_sessions where session_id=p_session_id for update;
    v_run_id:=v_live.current_script_run_id;
    if v_run_id is not null then
      update public.script_runs set status='completed',ended_at=now(),sequence_number=sequence_number+1 where id=v_run_id;
    end if;
    update public.live_sessions
    set current_script_run_id=null,
        sequence_number=sequence_number+1,
        snapshot=(snapshot-'scriptRunId'-'currentNodeKey') || jsonb_build_object('scriptStatus','awaiting_new_run'),
        updated_at=now()
    where session_id=p_session_id;
    v_result:=v_result || jsonb_build_object('scriptRunId',null,'currentNodeKey',null,'scriptStatus','awaiting_new_run');
  end if;
  if p_action in ('start','restart') then
    v_snapshot_id:=public.create_rules_snapshot(
      p_campaign_id,p_session_id,p_actor_user_id,
      case when p_action='restart' then 'Reinício da sessão' else 'Início da sessão' end
    );
    v_result:=v_result || jsonb_build_object('rulesSnapshotId',v_snapshot_id);
  end if;
  return v_result;
end;
$$;

create or replace function public.apply_rule_override(
  p_campaign_id uuid,p_rule_definition_id uuid,p_payload jsonb,p_reason text,p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_before jsonb; v_version integer; v_id uuid;
begin
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if char_length(trim(p_reason))<3 or jsonb_typeof(p_payload)<>'object' then raise exception 'Motivo e objeto de regra são obrigatórios'; end if;
  select payload,version into v_before,v_version from public.campaign_rule_overrides where campaign_id=p_campaign_id and rule_definition_id=p_rule_definition_id for update;
  insert into public.campaign_rule_overrides(campaign_id,rule_definition_id,version,payload,change_note,updated_by)
  values(p_campaign_id,p_rule_definition_id,coalesce(v_version,0)+1,p_payload,p_reason,p_actor_user_id)
  on conflict(campaign_id,rule_definition_id) do update set version=public.campaign_rule_overrides.version+1,payload=excluded.payload,change_note=excluded.change_note,updated_by=excluded.updated_by,enabled=true,updated_at=now()
  returning id,version into v_id,v_version;
  insert into public.rule_change_log(campaign_id,rule_definition_id,actor_user_id,action,before_data,after_data,reason)
  values(p_campaign_id,p_rule_definition_id,p_actor_user_id,'override_published',v_before,p_payload,p_reason);
  return jsonb_build_object('id',v_id,'version',v_version);
end;
$$;

create or replace function public.report_help_issue(p_campaign_id uuid,p_article_id uuid,p_message text,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.is_campaign_member(p_campaign_id) and auth.role()<>'service_role' then raise exception 'Sem permissão'; end if;
  insert into public.help_feedback(campaign_id,help_article_id,reported_by,message) values(p_campaign_id,p_article_id,p_actor_user_id,trim(p_message)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.publish_help_article(
  p_campaign_id uuid,p_article_id uuid,p_title text,p_summary text,p_content text,p_keywords text[],p_reason text,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_article public.help_articles%rowtype; v_version integer;
begin
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if least(char_length(trim(p_title)),char_length(trim(p_summary)),char_length(trim(p_content)),char_length(trim(p_reason)))<3 then raise exception 'Título, resumo, conteúdo e motivo são obrigatórios'; end if;
  select article.* into v_article from public.help_articles article join public.campaigns campaign on campaign.rule_profile_id=article.profile_id where article.id=p_article_id and campaign.id=p_campaign_id for update;
  if v_article.id is null then raise exception 'Artigo não encontrado no perfil da campanha'; end if;
  v_version:=v_article.current_version+1;
  insert into public.help_article_versions(help_article_id,version,title,summary,content,keywords,change_note,created_by)
  values(v_article.id,v_version,trim(p_title),trim(p_summary),trim(p_content),coalesce(p_keywords,'{}'),trim(p_reason),p_actor_user_id);
  update public.help_articles set current_version=v_version,published=true,updated_at=now() where id=v_article.id;
  insert into public.rule_change_log(campaign_id,actor_user_id,action,after_data,reason)
  values(p_campaign_id,p_actor_user_id,'help_article_published',jsonb_build_object('articleId',v_article.id,'version',v_version),p_reason);
  return jsonb_build_object('articleId',v_article.id,'version',v_version);
end $$;

create or replace function public.create_safety_event(p_campaign_id uuid,p_session_id uuid,p_tool text,p_private boolean,p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.is_campaign_member(p_campaign_id) and auth.role()<>'service_role' then raise exception 'Sem permissão'; end if;
  insert into public.safety_events(campaign_id,session_id,requested_by,tool,private_to_master) values(p_campaign_id,p_session_id,p_actor_user_id,p_tool,p_private) returning id into v_id;
  if p_tool='pause' then update public.sessions set status='paused',updated_at=now() where id=p_session_id and campaign_id=p_campaign_id and status='active'; end if;
  insert into public.notifications(campaign_id,user_id,type,title,safe_preview,protected_payload)
  select p_campaign_id,member.user_id,'safety_event','Ferramenta de segurança acionada','Verifique a central da sessão.',jsonb_build_object('eventId',v_id,'tool',p_tool)
  from public.campaign_members member where member.campaign_id=p_campaign_id and member.status='active' and member.role in ('campaign_owner','game_master','co_master');
  return v_id;
end $$;

create or replace function public.process_start_of_turn_effects(
  p_campaign_id uuid,p_session_id uuid,p_character_id uuid,p_actor_user_id uuid,p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_dead boolean:=false; v_insane boolean:=false; v_event uuid;
begin
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select id into v_event from public.audit_events where idempotency_key=p_idempotency_key;
  if v_event is not null then return jsonb_build_object('eventId',v_event,'duplicate',true); end if;
  update public.character_conditions instance set turn_starts=turn_starts+1,version=version+1
  from public.condition_definitions definition
  where instance.condition_definition_id=definition.id and instance.character_id=p_character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('morrendo','dying','enlouquecendo','insane');
  select exists(select 1 from public.character_conditions instance join public.condition_definitions definition on definition.id=instance.condition_definition_id where instance.character_id=p_character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('morrendo','dying') and instance.turn_starts>=3) into v_dead;
  select exists(select 1 from public.character_conditions instance join public.condition_definitions definition on definition.id=instance.condition_definition_id where instance.character_id=p_character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('enlouquecendo','insane') and instance.turn_starts>=3) into v_insane;
  if v_dead then
    update public.characters set character_state='dead',narrative_status='morto',updated_at=now(),version=version+1 where id=p_character_id and campaign_id=p_campaign_id;
    update public.character_conditions instance set removed_at=now(),version=version+1
    from public.condition_definitions definition
    where instance.condition_definition_id=definition.id and instance.character_id=p_character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('morrendo','dying');
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    select p_campaign_id,owner.user_id,p_character_id,'character_dead','Você morreu','Seu personagem morreu no terceiro início de turno em Morrendo.',jsonb_build_object('characterId',p_character_id,'state','dead')
    from public.character_owners owner where owner.character_id=p_character_id and owner.confirmed_at is not null;
  end if;
  if v_insane then
    update public.characters set is_npc=true,narrative_status='permanentemente insano',updated_at=now(),version=version+1 where id=p_character_id and campaign_id=p_campaign_id;
    update public.character_conditions instance set removed_at=now(),version=version+1
    from public.condition_definitions definition
    where instance.condition_definition_id=definition.id and instance.character_id=p_character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('enlouquecendo','insane');
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    select p_campaign_id,owner.user_id,p_character_id,'character_permanently_insane','A Zona tomou o controle','Seu personagem ficou permanentemente insano e passou ao controle do mestre.',jsonb_build_object('characterId',p_character_id,'state','permanently_insane')
    from public.character_owners owner where owner.character_id=p_character_id and owner.confirmed_at is not null;
  end if;
  insert into public.audit_events(campaign_id,session_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_session_id,p_actor_user_id,'character',p_character_id,'start_of_turn_effects_resolved','campaign',jsonb_build_object('dead',v_dead,'permanentlyInsane',v_insane),p_idempotency_key) returning id into v_event;
  return jsonb_build_object('eventId',v_event,'dead',v_dead,'permanentlyInsane',v_insane,'duplicate',false);
end $$;

create or replace function public.apply_zero_resource_conditions()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_definition uuid; v_secondary_definition uuid; v_profile text;
begin
  select profile.code into v_profile from public.campaigns campaign join public.rule_profiles profile on profile.id=campaign.rule_profile_id where campaign.id=new.campaign_id;
  if old.current_value=0 and new.current_value>0 and v_profile='zona7_convergencia' then
    if new.resource='pv' then
      update public.character_conditions instance set removed_at=now(),version=version+1
      from public.condition_definitions definition
      where instance.condition_definition_id=definition.id and instance.character_id=new.character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('inconsciente','unconscious');
      update public.characters set character_state='active',narrative_status='recuperando',updated_at=now(),version=version+1 where id=new.character_id and character_state='dying';
    elsif new.resource='san' then
      update public.character_conditions instance set removed_at=now(),version=version+1
      from public.condition_definitions definition
      where instance.condition_definition_id=definition.id and instance.character_id=new.character_id and instance.removed_at is null and lower(coalesce(definition.key,definition.name)) in ('enlouquecendo','insane');
    end if;
    return new;
  end if;
  if new.current_value>0 or old.current_value<=0 then return new; end if;
  if new.resource='pv' and v_profile='zona7_convergencia' then
    insert into public.condition_definitions(campaign_id,key,name,description,category,effects,default_visibility)
    values(new.campaign_id,'morrendo','Morrendo','No terceiro início de turno nesta condição, o personagem morre.','critical','{"turnStartsToTerminal":3}','campaign')
    on conflict(campaign_id,name) do update set key=excluded.key,description=excluded.description,effects=excluded.effects
    returning id into v_definition;
    insert into public.condition_definitions(campaign_id,key,name,description,category,effects,default_visibility)
    values(new.campaign_id,'inconsciente','Inconsciente','Sem ações até recuperar pelo menos 1 PV.','critical','{"actions":0}','campaign')
    on conflict(campaign_id,name) do update set key=excluded.key,description=excluded.description,effects=excluded.effects
    returning id into v_secondary_definition;
    insert into public.character_conditions(campaign_id,character_id,condition_definition_id,source,duration_unit,visibility)
    select new.campaign_id,new.character_id,v_definition,'PV chegou a zero','scene','campaign'
    where not exists(select 1 from public.character_conditions where character_id=new.character_id and condition_definition_id=v_definition and removed_at is null);
    insert into public.character_conditions(campaign_id,character_id,condition_definition_id,source,duration_unit,visibility)
    select new.campaign_id,new.character_id,v_secondary_definition,'PV chegou a zero','scene','campaign'
    where not exists(select 1 from public.character_conditions where character_id=new.character_id and condition_definition_id=v_secondary_definition and removed_at is null);
  elsif new.resource='san' and v_profile='zona7_convergencia' then
    insert into public.condition_definitions(campaign_id,key,name,description,category,effects,default_visibility)
    values(new.campaign_id,'enlouquecendo','Enlouquecendo','No terceiro início de turno, a consequência terminal da campanha ocorre.','critical','{"turnStartsToTerminal":3}','campaign')
    on conflict(campaign_id,name) do update set key=excluded.key,description=excluded.description,effects=excluded.effects
    returning id into v_definition;
    insert into public.character_conditions(campaign_id,character_id,condition_definition_id,source,duration_unit,visibility)
    select new.campaign_id,new.character_id,v_definition,'SAN chegou a zero','scene','campaign'
    where not exists(select 1 from public.character_conditions where character_id=new.character_id and condition_definition_id=v_definition and removed_at is null);
  end if;
  return new;
end $$;

drop trigger if exists apply_zero_resource_conditions_after_update on public.character_resources;
create trigger apply_zero_resource_conditions_after_update after update of current_value on public.character_resources
for each row execute function public.apply_zero_resource_conditions();

create or replace function public.seed_campaign_rule_defaults()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.rule_profiles where id=new.rule_profile_id and code='zona7_convergencia') then
    insert into public.resource_threshold_rules(campaign_id,resource,key,label,percent,severity) values
      (new.id,'pv','pv_wounded','Machucado',50,'warning'),
      (new.id,'pv','pv_critical','PV crítico',25,'critical'),
      (new.id,'pv','pv_zero','Morrendo',0,'zero'),
      (new.id,'san','san_disturbed','Perturbado',49.99,'warning'),
      (new.id,'san','san_critical','Colapso iminente',25,'critical'),
      (new.id,'san','san_zero','Enlouquecendo',0,'zero'),
      (new.id,'pe','pe_low','PE baixo',25,'warning'),
      (new.id,'pe','pe_zero','Esgotado',0,'zero')
    on conflict(campaign_id,key) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists seed_campaign_rule_defaults_after_insert on public.campaigns;
create trigger seed_campaign_rule_defaults_after_insert after insert on public.campaigns
for each row execute function public.seed_campaign_rule_defaults();

insert into public.resource_threshold_rules(campaign_id,resource,key,label,percent,severity)
select campaign.id,seed.resource,seed.key,seed.label,seed.percent,seed.severity
from public.campaigns campaign
join public.rule_profiles profile on profile.id=campaign.rule_profile_id and profile.code='zona7_convergencia'
cross join (values
  ('pv','pv_wounded','Machucado',50::numeric,'warning'),
  ('pv','pv_critical','PV crítico',25::numeric,'critical'),
  ('pv','pv_zero','Morrendo',0::numeric,'zero'),
  ('san','san_disturbed','Perturbado',49.99::numeric,'warning'),
  ('san','san_critical','Colapso iminente',25::numeric,'critical'),
  ('san','san_zero','Enlouquecendo',0::numeric,'zero'),
  ('pe','pe_low','PE baixo',25::numeric,'warning'),
  ('pe','pe_zero','Esgotado',0::numeric,'zero')
) seed(resource,key,label,percent,severity)
on conflict(campaign_id,key) do update set label=excluded.label,percent=excluded.percent,severity=excluded.severity,enabled=true;

create or replace function public.spend_ability_cost(
  p_character_ability_id uuid,p_actor_user_id uuid,p_resolved_costs jsonb,
  p_session_id uuid default null,p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  link_record public.character_abilities%rowtype; ability_record public.abilities%rowtype;
  character_record public.characters%rowtype; cost_entry record;
  resource_record public.character_resources%rowtype; requested_cost integer;
  configured_cost text; dice_count integer; dice_sides integer; event_id uuid;
  before_resources jsonb:='{}'; after_resources jsonb:='{}';
  pe_spent integer:=0; pe_limit integer; pe_cost integer:=0; pe_total integer; v_ignore_pe_limit boolean:=false;
  v_encounter_id uuid; v_round integer; v_turn_position integer;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into link_record from public.character_abilities where id=p_character_ability_id for update;
  if link_record.id is null or link_record.state not in ('unlocked','altered') then raise exception 'Habilidade indisponível'; end if;
  if auth.role()<>'service_role' and not public.is_character_owner(link_record.character_id) and not public.has_campaign_role(link_record.campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select * into ability_record from public.abilities where id=link_record.ability_id;
  select * into character_record from public.characters where id=link_record.character_id;
  select id into event_id from public.audit_events where idempotency_key=p_idempotency_key;
  if event_id is not null then return event_id; end if;
  for cost_entry in select key,value from jsonb_each_text(p_resolved_costs) loop
    if cost_entry.key not in ('pv','pe','san') or cost_entry.value!~'^[0-9]+$' then raise exception 'Custo inválido'; end if;
    requested_cost:=cost_entry.value::integer;
    configured_cost:=ability_record.costs->>cost_entry.key;
    if configured_cost is null then raise exception 'Recurso não configurado no custo'; end if;
    if configured_cost~'^[0-9]+$' and requested_cost<>configured_cost::integer then raise exception 'Custo divergente'; end if;
    if configured_cost~'^[0-9]+d[0-9]+$' then
      dice_count:=split_part(configured_cost,'d',1)::integer; dice_sides:=split_part(configured_cost,'d',2)::integer;
      if requested_cost<dice_count or requested_cost>dice_count*dice_sides then raise exception 'Resultado de custo fora do intervalo'; end if;
    end if;
    if cost_entry.key='pe' then pe_cost:=requested_cost; end if;
    select * into resource_record from public.character_resources where character_id=link_record.character_id and resource=cost_entry.key for update;
    if resource_record.id is null or resource_record.current_value<requested_cost then raise exception 'Recurso insuficiente'; end if;
    before_resources:=before_resources||jsonb_build_object(cost_entry.key,resource_record.current_value);
    after_resources:=after_resources||jsonb_build_object(cost_entry.key,resource_record.current_value-requested_cost);
  end loop;
  if pe_cost>0 and p_session_id is not null then
    pe_limit:=greatest(1,character_record.pe_per_turn);
    v_ignore_pe_limit:=coalesce((ability_record.requirements->>'ignorePeTurnLimit')::boolean,false);
    select id,round,current_turn_position into v_encounter_id,v_round,v_turn_position
    from public.encounters where campaign_id=link_record.campaign_id and session_id=p_session_id and status='active'
    order by created_at desc limit 1;
    if v_encounter_id is not null and v_turn_position is not null then
      insert into public.character_turn_resource_usage(
        campaign_id,session_id,encounter_id,character_id,round,turn_position,resource,spent
      ) values (
        link_record.campaign_id,p_session_id,v_encounter_id,link_record.character_id,v_round,v_turn_position,'pe',pe_cost
      ) on conflict(encounter_id,round,turn_position,character_id,resource) do update
        set spent=public.character_turn_resource_usage.spent+excluded.spent,updated_at=now()
        where public.character_turn_resource_usage.spent+excluded.spent<=pe_limit or v_ignore_pe_limit
      returning spent into pe_total;
      if pe_total is null and not v_ignore_pe_limit then
        select spent into pe_spent from public.character_turn_resource_usage
        where encounter_id=v_encounter_id and round=v_round and turn_position=v_turn_position
          and character_id=link_record.character_id and resource='pe';
        raise exception 'Limite de PE por turno excedido: %/%',coalesce(pe_spent,0)+pe_cost,pe_limit;
      end if;
      pe_spent:=greatest(0,coalesce(pe_total,pe_cost)-pe_cost);
    elsif pe_cost>pe_limit and not v_ignore_pe_limit then
      raise exception 'Limite de PE por turno excedido: %/%',pe_cost,pe_limit;
    end if;
  end if;
  for cost_entry in select key,value from jsonb_each_text(p_resolved_costs) loop
    update public.character_resources set current_value=current_value-cost_entry.value::integer,version=version+1,updated_at=now() where character_id=link_record.character_id and resource=cost_entry.key;
  end loop;
  update public.character_abilities set usage_counters=jsonb_set(usage_counters,'{total}',to_jsonb(coalesce((usage_counters->>'total')::integer,0)+1)),version=version+1 where id=link_record.id;
  insert into public.audit_events(campaign_id,session_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values(link_record.campaign_id,p_session_id,p_actor_user_id,'character_ability',link_record.id,'ability_used','owner_only',
    jsonb_build_object('resources',before_resources),jsonb_build_object('resources',after_resources),
    jsonb_build_object('abilityId',link_record.ability_id,'costs',p_resolved_costs,'peSpentBefore',pe_spent,'peTurnLimit',pe_limit),p_idempotency_key)
  returning id into event_id;
  return event_id;
end $$;

create or replace function public.claim_ability_roll_request(
  p_request_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.roll_requests%rowtype; v_ability public.abilities%rowtype;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id;
  if v_request.id is null then raise exception 'Solicitação não encontrada'; end if;
  if auth.role()<>'service_role' and (v_request.requested_by<>p_actor_user_id or not public.is_character_owner(v_request.character_id)) then raise exception 'Sem permissão'; end if;
  if v_request.decision<>'approved' then raise exception 'Aguarde a aprovação do mestre'; end if;
  if v_request.rolled_at is not null then raise exception 'Este teste já foi rolado'; end if;
  select ability.* into v_ability from public.character_abilities link join public.abilities ability on ability.id=link.ability_id where link.id=v_request.character_ability_id;
  return jsonb_build_object(
    'campaignId',v_request.campaign_id,'sessionId',v_request.session_id,'characterId',v_request.character_id,
    'characterAbilityId',v_request.character_ability_id,'formula',coalesce(nullif(trim(v_ability.test_formula),''),'1d20'),
    'abilityName',v_ability.name,'costs',coalesce(v_ability.costs,'{}'::jsonb)
  );
end;
$$;

create or replace function public.complete_ability_roll(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_formula text,
  p_rolls integer[],
  p_kept_indexes integer[],
  p_modifier integer,
  p_total integer,
  p_resolved_costs jsonb,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.roll_requests%rowtype; v_ability public.abilities%rowtype;
  v_roll_id uuid; v_calculated integer:=p_modifier; v_index integer; v_player_name text;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'Solicitação não encontrada'; end if;
  if auth.role()<>'service_role' and (v_request.requested_by<>p_actor_user_id or not public.is_character_owner(v_request.character_id)) then raise exception 'Sem permissão'; end if;
  if v_request.decision<>'approved' then raise exception 'Aguarde a aprovação do mestre'; end if;
  if v_request.rolled_at is not null then
    select id into v_roll_id from public.dice_rolls where roll_request_id=v_request.id order by created_at desc limit 1;
    return jsonb_build_object('id',v_roll_id,'duplicate',true);
  end if;
  if coalesce(array_length(p_rolls,1),0)<1 or coalesce(array_length(p_rolls,1),0)>50 then raise exception 'Rolagem inválida'; end if;
  foreach v_index in array p_kept_indexes loop
    if v_index<0 or v_index>=array_length(p_rolls,1) then raise exception 'Índice de dado inválido'; end if;
    v_calculated:=v_calculated+p_rolls[v_index+1];
  end loop;
  if v_calculated<>p_total then raise exception 'Total da rolagem divergente'; end if;
  select ability.* into v_ability from public.character_abilities link join public.abilities ability on ability.id=link.ability_id where link.id=v_request.character_ability_id;
  perform public.spend_ability_cost(v_request.character_ability_id,p_actor_user_id,coalesce(p_resolved_costs,'{}'::jsonb),v_request.session_id,p_idempotency_key);
  select display_name into v_player_name from public.profiles where id=p_actor_user_id;
  insert into public.dice_rolls(
    campaign_id,session_id,roll_request_id,character_id,user_id,roller_display_name,formula,rolls,kept_indexes,modifier,total,purpose,visibility
  ) values (
    v_request.campaign_id,v_request.session_id,v_request.id,v_request.character_id,p_actor_user_id,coalesce(v_player_name,'Jogador'),
    p_formula,p_rolls,p_kept_indexes,p_modifier,p_total,'Uso de '||coalesce(v_ability.name,'habilidade'),'session'
  ) returning id into v_roll_id;
  update public.roll_requests set rolled_at=now() where id=v_request.id;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select v_request.campaign_id,member.user_id,v_request.character_id,'ability_roll','Resultado de '||coalesce(v_ability.name,'habilidade'),
    coalesce(v_player_name,'Jogador')||' rolou '||p_total,
    jsonb_build_object('requestId',p_request_id,'rollId',v_roll_id,'total',p_total,'abilityName',v_ability.name,'playerName',coalesce(v_player_name,'Jogador'))
  from public.campaign_members member where member.campaign_id=v_request.campaign_id and member.status='active';
  return jsonb_build_object('id',v_roll_id,'duplicate',false);
end;
$$;

alter table public.rule_definitions enable row level security;
alter table public.rule_versions enable row level security;
alter table public.campaign_rule_overrides enable row level security;
alter table public.session_rule_snapshots enable row level security;
alter table public.session_rule_snapshot_items enable row level security;
alter table public.rule_change_log enable row level security;
alter table public.help_articles enable row level security;
alter table public.help_article_versions enable row level security;
alter table public.help_article_links enable row level security;
alter table public.help_feedback enable row level security;
alter table public.extended_tests enable row level security;
alter table public.extended_test_contributions enable row level security;
alter table public.safety_preferences enable row level security;
alter table public.safety_events enable row level security;
alter table public.character_turn_resource_usage enable row level security;

create policy rule_definitions_read on public.rule_definitions for select to authenticated using (visibility<>'gm_only' or exists(select 1 from public.campaigns campaign where campaign.rule_profile_id=profile_id and public.has_campaign_role(campaign.id,array['campaign_owner','game_master','co_master'])));
create policy rule_versions_read on public.rule_versions for select to authenticated using (exists(select 1 from public.rule_definitions definition where definition.id=rule_definition_id and (definition.visibility<>'gm_only' or exists(select 1 from public.campaigns campaign where campaign.rule_profile_id=definition.profile_id and public.has_campaign_role(campaign.id,array['campaign_owner','game_master','co_master'])))));
create policy rule_overrides_read on public.campaign_rule_overrides for select to authenticated using (
  public.is_campaign_member(campaign_id) and exists(
    select 1 from public.rule_definitions definition where definition.id=rule_definition_id
      and (definition.visibility<>'gm_only' or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
  )
);
create policy rule_overrides_manage on public.campaign_rule_overrides for all to authenticated using(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])) with check(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy rule_snapshots_read on public.session_rule_snapshots for select to authenticated using(public.is_campaign_member(campaign_id));
create policy snapshot_items_read on public.session_rule_snapshot_items for select to authenticated using(exists(
  select 1 from public.session_rule_snapshots snapshot
  join public.rule_definitions definition on definition.id=rule_definition_id
  where snapshot.id=snapshot_id and public.is_campaign_member(snapshot.campaign_id)
    and (definition.visibility<>'gm_only' or public.has_campaign_role(snapshot.campaign_id,array['campaign_owner','game_master','co_master']))
));
create policy rule_change_master on public.rule_change_log for select to authenticated using(campaign_id is not null and public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy help_articles_read on public.help_articles for select to authenticated using(
  published and archived_at is null and (
    (audience in ('player','both') and visibility<>'gm_only')
    or exists(select 1 from public.campaigns campaign where campaign.rule_profile_id=profile_id and public.has_campaign_role(campaign.id,array['campaign_owner','game_master','co_master']))
  )
);
create policy help_versions_read on public.help_article_versions for select to authenticated using(exists(
  select 1 from public.help_articles article where article.id=help_article_id and article.published and article.archived_at is null
    and ((article.audience in ('player','both') and article.visibility<>'gm_only')
      or exists(select 1 from public.campaigns campaign where campaign.rule_profile_id=article.profile_id and public.has_campaign_role(campaign.id,array['campaign_owner','game_master','co_master'])))
));
create policy help_links_read on public.help_article_links for select to authenticated using(exists(
  select 1 from public.help_articles article where article.id=help_article_id and article.published and article.archived_at is null
    and ((article.audience in ('player','both') and article.visibility<>'gm_only')
      or exists(select 1 from public.campaigns campaign where campaign.rule_profile_id=article.profile_id and public.has_campaign_role(campaign.id,array['campaign_owner','game_master','co_master'])))
));
create policy help_feedback_create on public.help_feedback for insert to authenticated with check(reported_by=auth.uid() and public.is_campaign_member(campaign_id));
create policy help_feedback_master on public.help_feedback for select to authenticated using(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy extended_tests_read on public.extended_tests for select to authenticated using(public.is_campaign_member(campaign_id) and (visibility<>'gm_only' or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])));
create policy extended_tests_master on public.extended_tests for all to authenticated using(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])) with check(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy extended_contributions_read on public.extended_test_contributions for select to authenticated using(exists(select 1 from public.extended_tests test where test.id=extended_test_id and public.is_campaign_member(test.campaign_id)));
create policy extended_contributions_create on public.extended_test_contributions for insert to authenticated with check(
  user_id=auth.uid() and (character_id is null or public.is_character_owner(character_id))
  and exists(select 1 from public.extended_tests test where test.id=extended_test_id and test.status='active' and public.is_campaign_member(test.campaign_id))
);
create policy safety_preferences_own on public.safety_preferences for all to authenticated using(user_id=auth.uid() or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])) with check(user_id=auth.uid() or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy safety_events_own_master on public.safety_events for select to authenticated using(requested_by=auth.uid() or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy safety_events_create on public.safety_events for insert to authenticated with check(requested_by=auth.uid() and public.is_campaign_member(campaign_id));
create policy turn_resource_usage_read on public.character_turn_resource_usage for select to authenticated using(
  public.is_character_owner(character_id) or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
);

grant execute on function public.resolve_effective_rule(uuid,text) to authenticated,service_role;
grant execute on function public.create_rules_snapshot(uuid,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.apply_rule_override(uuid,uuid,jsonb,text,uuid) to authenticated,service_role;
grant execute on function public.report_help_issue(uuid,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.publish_help_article(uuid,uuid,text,text,text,text[],text,uuid) to authenticated,service_role;
grant execute on function public.create_safety_event(uuid,uuid,text,boolean,uuid) to authenticated,service_role;
grant execute on function public.process_start_of_turn_effects(uuid,uuid,uuid,uuid,uuid) to authenticated,service_role;
revoke all on function public.complete_ability_roll(uuid,uuid,text,integer[],integer[],integer,integer,jsonb,uuid) from public,authenticated;
grant execute on function public.complete_ability_roll(uuid,uuid,text,integer[],integer[],integer,integer,jsonb,uuid) to service_role;

with definitions(profile_code,key,category,title,player_summary,master_summary,visibility,payload) as (
  values
  ('zona7_convergencia','checks.core','testes','Como fazer testes','Role um d20 por ponto do atributo, escolha o maior e some a perícia. Atributo 0 usa 2d20 e o pior.','O atributo define dados, a perícia define bônus; 20 natural vence teste comum.', 'public','{"training":{"untrained":0,"trained":5,"veteran":10,"expert":15},"natural20":true,"natural1Failure":false,"take10":true,"take20":true}'::jsonb),
  ('zona7_convergencia','resources.thresholds','recursos','PV, PE e SAN','PV 0 inicia Morrendo; SAN 0 inicia Enlouquecendo; PE 0 ainda permite ações sem custo.','Alertas cruzam 50%, 25% e zero, rearmando apenas após recuperação.', 'public','{"pv":{"wounded":50,"critical":25,"zero":"dying"},"san":{"disturbedBelow":50,"critical":25,"zero":"insane"},"pe":{"low":25}}'::jsonb),
  ('zona7_convergencia','combat.turn','combate','Turno e ações','Você possui uma ação padrão e uma de movimento, duas de movimento ou uma ação completa.','Reações e ações livres respeitam gatilhos. Uma defesa especial por rodada.', 'public','{"standard":1,"movement":1,"fullAlternative":true,"specialDefensePerRound":1}'::jsonb),
  ('zona7_convergencia','combat.damage','combate','Dano, RD e dano massivo','A RD compatível reduz dano, nunca abaixo de zero. Um dano de metade do PV máximo pode causar dano massivo.','Dano massivo: Fortitude DT 15 + 2 × piso(dano/10); falha leva a 0 PV.', 'public','{"minimumAfterResistance":0,"massiveDamage":{"fraction":0.5,"difficultyBase":15,"difficultyPerTen":2}}'::jsonb),
  ('zona7_convergencia','conditions.critical','condicoes','Morrendo e Enlouquecendo','No terceiro início de turno na condição crítica, ocorre a consequência terminal do perfil.','Morrendo encerra por Medicina ou efeito; Enlouquecendo por Diplomacia ou SAN recuperada.', 'public','{"turnStarts":3,"stabilizeDifficulty":20,"repeatIncrease":5}'::jsonb),
  ('zona7_convergencia','pressure.zone','pressao','Pressão da Zona','A Pressão vai de 0 a 7: controlada, instável, crítica e limite.','Mecânicas ativas são públicas; causa narrativa pode continuar secreta.', 'public','{"minimum":0,"maximum":7,"bands":[[0,2,"controlled"],[3,4,"unstable"],[5,6,"critical"],[7,7,"limit"]]}'::jsonb),
  ('zona7_convergencia','safety.tools','seguranca','Segurança da mesa','Pausa, Corte, Rebobinar, Porta Aberta e Check-in podem ser acionados sem justificativa.','Não revele publicamente quem acionou. Pausa pode interromper a sessão.', 'public','{"tools":["pause","cut","rewind","open_door","check_in","debrief"],"reasonRequired":false}'::jsonb),
  ('zona7_classic','checks.core','testes','Testes no perfil clássico','Use a rolagem e a dificuldade configuradas pela sala.','Perfil editável, preservado como alternativa ao Convergência.', 'public','{"natural20":true,"natural1Failure":false}'::jsonb),
  ('zona7_classic','resources.zero','recursos','Zero no perfil clássico','PV 0 e SAN 0 seguem as consequências configuradas pela campanha.','Padrão: PV 0 morto; SAN 0 absorvido pela Zona 7.', 'public','{"zeroHp":"dead","zeroSan":"absorbed_by_zone"}'::jsonb)
), inserted as (
  insert into public.rule_definitions(profile_id,key,category,title,player_summary,master_summary,visibility)
  select profile.id,definition.key,definition.category,definition.title,definition.player_summary,definition.master_summary,definition.visibility
  from definitions definition join public.rule_profiles profile on profile.code=definition.profile_code
  on conflict(profile_id,key) do update set category=excluded.category,title=excluded.title,player_summary=excluded.player_summary,master_summary=excluded.master_summary,visibility=excluded.visibility,updated_at=now()
  returning id,profile_id,key,current_version
)
insert into public.rule_versions(rule_definition_id,version,payload,change_note)
select definition.id,1,seed.payload,'Catálogo inicial auditável'
from public.rule_definitions definition
join public.rule_profiles profile on profile.id=definition.profile_id
join definitions seed on seed.profile_code=profile.code and seed.key=definition.key
on conflict(rule_definition_id,version) do update set payload=excluded.payload,change_note=excluded.change_note;

with articles(profile_code,slug,category,audience,visibility,title,summary,content,keywords,rule_key) as (
  values
  ('zona7_convergencia','comece-aqui','comece_aqui','both','public','Comece aqui','Fluxo seguro para entrar e jogar.','Entre com sua conta, confira sua ficha e conexão, entre na sala quando o mestre iniciar, declare intenção e método antes de rolar e acompanhe mapa, mensagens, turno e escolhas.',array['início','sessão','conexão'],null),
  ('zona7_convergencia','minha-ficha','ficha','player','public','Minha ficha','Entenda os números sem alterar dados protegidos.','Atributos definem a quantidade de d20; perícias somam bônus. PV, PE e SAN mostram atual/máximo. Defesa, resistências, medidor, condições, inventário e habilidades usam somente o que o mestre liberou.',array['ficha','atributos','recursos'],null),
  ('zona7_convergencia','como-fazer-testes','testes','both','public','Como fazer um teste','Intenção → método → atributo → perícia → modificadores → rolagem → consequência.','O mestre confirma a combinação. Role um d20 por ponto de atributo, escolha o maior e some perícia e modificadores anunciados. Atributo 0 rola 2d20 e escolhe o pior. Nunca role duas vezes após reconectar.',array['dados','teste','DT','perícia'],'checks.core'),
  ('zona7_convergencia','combate','combate','both','public','Combate','Iniciativa, ações, ataque e defesas.','Em seu turno use padrão + movimento, duas de movimento ou uma completa. Ataques alcançam a Defesa. Bloqueio, Esquiva e Contra-ataque são defesas especiais; cobertura e condições alteram o resultado quando anunciadas.',array['turno','iniciativa','ataque'],'combat.turn'),
  ('zona7_convergencia','poderes-e-recursos','recursos','both','public','Poderes e recursos','Declare, verifique, pague, resolva e registre.','Leia ação, custo, alcance, requisito e consequência. Escolha alvo e obtenha consentimento quando necessário. Uma recusa antes do custo não gasta recurso. O limite de PE por turno não é a reserva de PE.',array['habilidade','PE','custo'],null),
  ('zona7_convergencia','mensagens-e-escolhas','comunicacao','player','public','Mensagens e escolhas','Comunicações privadas, coletivas e narrativas.','Uma mensagem pode vir do mestre, grupo, NPC, entidade ou remetente desconhecido. Notificações não expõem conteúdo secreto. Testes e escolhas enviados pelo mestre aparecem na sessão.',array['mensagem','escolha','votação'],null),
  ('zona7_convergencia','mapa-e-sessao','mapa','player','public','Mapa e sessão ao vivo','Tokens e cenas atualizam em tempo real.','Seu retrato vira token. O mestre controla posição e conteúdo por padrão. Áreas ocultas não são erro; a tela coletiva mostra somente o que foi liberado.',array['mapa','token','tempo real'],null),
  ('zona7_convergencia','alertas-e-condicoes','condicoes','both','public','Alertas e condições','Como reagir a limiares críticos.','Machucado não impõe penalidade sozinho. PV crítico pede proteção; 0 PV inicia Morrendo. SAN abaixo da metade causa Perturbado; 0 SAN inicia Enlouquecendo. PE 0 permite ações sem custo.',array['PV','SAN','PE','morrendo'],'resources.thresholds'),
  ('zona7_convergencia','reconexao','sistema','player','public','Reconexão','O sistema recupera o estado sem repetir ações.','Aguarde a reconexão e não clique repetidamente em dano, poder ou rolagem. O snapshot e os eventos pendentes são recuperados. Se houver divergência, reporte ao mestre.',array['offline','reconectar','snapshot'],null),
  ('zona7_convergencia','seguranca-da-mesa','seguranca','both','public','Segurança da mesa','Ferramentas sem punição e sem justificativa obrigatória.','Pausa interrompe; Corte remove detalhe; Rebobinar troca a abordagem; Porta Aberta permite afastar-se; Check-in pede confirmação. O acionamento pode ser privado.',array['pausa','corte','check-in'],'safety.tools'),
  ('zona7_convergencia','manual-primeira-configuracao','operacao','master','gm_only','Primeira configuração','Checklist do mestre.','Confirme perfil, personagens, contas, visibilidade, limiares, condições, habilidades, atores, pistas, mapa e roteiro antes de abrir a sessão.',array['mestre','configuração','checklist'],null),
  ('zona7_convergencia','manual-conduzir-sessao','operacao','master','gm_only','Conduzir a sessão','Ordem operacional da central ao vivo.','Fixe o snapshot, confirme jogadores, publique cena, descreva a situação, solicite testes com consequência, avance turnos, aplique recursos na mesma transação e atualize roteiro, Pressão e medidores.',array['mestre','sessão','snapshot'],null),
  ('zona7_convergencia','manual-corrigir-erros','operacao','master','gm_only','Corrigir erros','Use compensação e nova revisão.','Não apague histórico. Desfaça a mutação auditável quando possível. Mudança de regra durante sessão cria nova revisão do snapshot e deve indicar motivo.',array['auditoria','erro','revisão'],null)
), article_rows as (
  insert into public.help_articles(profile_id,rule_definition_id,slug,category,audience,visibility)
  select profile.id,definition.id,article.slug,article.category,article.audience,article.visibility
  from articles article join public.rule_profiles profile on profile.code=article.profile_code
  left join public.rule_definitions definition on definition.profile_id=profile.id and definition.key=article.rule_key
  on conflict(profile_id,slug) do update set rule_definition_id=excluded.rule_definition_id,category=excluded.category,audience=excluded.audience,visibility=excluded.visibility,published=true,archived_at=null,updated_at=now()
  returning id,profile_id,slug
)
insert into public.help_article_versions(help_article_id,version,title,summary,content,keywords,change_note)
select help.id,1,article.title,article.summary,article.content,article.keywords,'Conteúdo inicial da central'
from public.help_articles help join public.rule_profiles profile on profile.id=help.profile_id
join articles article on article.profile_code=profile.code and article.slug=help.slug
on conflict(help_article_id,version) do update set title=excluded.title,summary=excluded.summary,content=excluded.content,keywords=excluded.keywords;

commit;
