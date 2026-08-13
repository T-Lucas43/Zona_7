begin;

alter table public.audit_events
  add column if not exists reversal_status text not null default 'available'
    check (reversal_status in ('available','reversed','blocked')),
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles(id);

create table if not exists public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  revision integer not null default 1,
  title text not null,
  overview text not null default '',
  decisions jsonb not null default '[]'::jsonb,
  clues jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  deaths jsonb not null default '[]'::jsonb,
  meters jsonb not null default '[]'::jsonb,
  pending_topics jsonb not null default '[]'::jsonb,
  generated_from_event_at timestamptz,
  generated_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,revision)
);

create table if not exists public.scene_reveal_states (
  scene_id uuid primary key references public.game_scenes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  enabled boolean not null default false,
  synchronized boolean not null default false,
  paths jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists session_summaries_session_idx on public.session_summaries(session_id,revision desc);
create index if not exists audit_events_session_timeline_idx on public.audit_events(session_id,created_at desc);

alter table public.session_summaries enable row level security;
alter table public.scene_reveal_states enable row level security;

create policy session_summaries_master_manage on public.session_summaries for all to authenticated
using(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy session_summaries_player_read on public.session_summaries for select to authenticated
using(published_at is not null and public.is_campaign_member(campaign_id));
create policy scene_reveal_master_manage on public.scene_reveal_states for all to authenticated
using(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check(public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy scene_reveal_member_read on public.scene_reveal_states for select to authenticated
using(public.is_campaign_member(campaign_id) and synchronized);

create or replace function public.attach_audit_event_to_session(p_event_id uuid,p_session_id uuid,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_event public.audit_events%rowtype;
begin
  select * into v_event from public.audit_events where id=p_event_id for update;
  if v_event.id is null then raise exception 'Evento auditável não encontrado'; end if;
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(v_event.campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if not exists(select 1 from public.sessions where id=p_session_id and campaign_id=v_event.campaign_id) then raise exception 'Sessão inválida'; end if;
  update public.audit_events set session_id=p_session_id where id=p_event_id;
end $$;

create or replace function public.reverse_session_event(
  p_event_id uuid,p_reason text,p_actor_user_id uuid,p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_event public.audit_events%rowtype;
  v_existing uuid;
  v_compensation uuid;
  v_character_item public.character_items%rowtype;
  v_condition public.character_conditions%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_character_ids uuid[];
  v_character_id uuid;
  v_item_id uuid;
  v_handout_id uuid;
  v_previous_position integer;
  v_previous_round integer;
  v_snapshot jsonb;
  v_member jsonb;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if char_length(trim(p_reason))<3 then raise exception 'Informe um motivo com pelo menos 3 caracteres'; end if;
  select id into v_existing from public.audit_events where idempotency_key=p_idempotency_key;
  if v_existing is not null then return jsonb_build_object('eventId',v_existing,'duplicate',true); end if;
  select * into v_event from public.audit_events where id=p_event_id for update;
  if v_event.id is null then raise exception 'Evento não encontrado'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(v_event.campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  if v_event.reversal_status='reversed' or exists(select 1 from public.audit_events where compensates_event_id=v_event.id) then raise exception 'Este evento já foi desfeito'; end if;
  if v_event.event_type like 'initiative_%' or v_event.event_type='combat_turn_advanced' then
    if exists(select 1 from public.audit_events later where later.encounter_id=v_event.encounter_id and later.created_at>v_event.created_at and (later.event_type like 'initiative_%' or later.event_type='combat_turn_advanced')) then
      raise exception 'Há turnos posteriores. Desfaça primeiro o evento mais recente da iniciativa';
    end if;
  end if;
  if v_event.event_type='condition_applied' then
    v_event.entity_id:=coalesce(v_event.entity_id,(v_event.after_data->>'conditionId')::uuid);
  elsif v_event.event_type='condition_removed' then
    v_event.entity_id:=coalesce(v_event.entity_id,(v_event.before_data->>'conditionId')::uuid);
  end if;

  v_before:=v_event.after_data; v_after:=v_event.before_data;
  if v_event.event_type='resource_mutated' then
    update public.character_resources
      set current_value=(v_event.before_data->>'current')::integer,version=version+1,updated_at=now()
      where id=v_event.entity_id and current_value=(v_event.after_data->>'current')::integer;
    if not found then raise exception 'O recurso recebeu outra alteração depois deste evento'; end if;
  elsif v_event.event_type='meter_changed' then
    update public.character_meter_values
      set current_value=(v_event.before_data->>'value')::integer,version=version+1,updated_at=now()
      where id=v_event.entity_id and current_value=(v_event.after_data->>'value')::integer;
    if not found then raise exception 'O medidor recebeu outra alteração depois deste evento'; end if;
  elsif v_event.event_type='condition_applied' then
    select * into v_condition from public.character_conditions where id=v_event.entity_id for update;
    if v_condition.id is null or v_condition.removed_at is not null then raise exception 'A condição já foi alterada ou removida'; end if;
    update public.character_conditions set removed_at=now(),version=version+1 where id=v_condition.id;
  elsif v_event.event_type='condition_removed' then
    select * into v_condition from public.character_conditions where id=v_event.entity_id for update;
    if v_condition.id is null or v_condition.removed_at is null then raise exception 'A condição já está ativa ou não existe'; end if;
    update public.character_conditions set removed_at=null,version=version+1 where id=v_condition.id;
  elsif v_event.event_type='item_delivered' then
    v_item_id:=v_event.entity_id;
    select array(select jsonb_array_elements_text(coalesce(v_event.after_data->'characterIds','[]'::jsonb))::uuid) into v_character_ids;
    foreach v_character_id in array coalesce(v_character_ids,'{}'::uuid[]) loop
      select * into v_character_item from public.character_items where character_id=v_character_id and item_id=v_item_id for update;
      if v_character_item.id is null or v_character_item.quantity<(v_event.after_data->>'quantity')::integer then raise exception 'O item já foi usado, doado ou removido'; end if;
      update public.character_items set quantity=quantity-(v_event.after_data->>'quantity')::integer,version=version+1 where id=v_character_item.id;
    end loop;
  elsif v_event.event_type='handout_delivered' then
    v_handout_id:=v_event.entity_id;
    select array(select jsonb_array_elements_text(coalesce(v_event.after_data->'characterIds','[]'::jsonb))::uuid) into v_character_ids;
    delete from public.handout_access where handout_id=v_handout_id and character_id=any(coalesce(v_character_ids,'{}'::uuid[]));
  elsif v_event.event_type='combat_turn_advanced' then
    if v_event.before_data is not null then
      v_previous_round:=coalesce((v_event.before_data->>'round')::integer,0);
      v_previous_position:=(v_event.before_data->>'turnPosition')::integer;
    else
      v_previous_round:=coalesce((v_event.after_data->>'round')::integer,1);
      select max(position) into v_previous_position from public.encounter_combatants where encounter_id=v_event.encounter_id and position<(v_event.after_data->>'turnPosition')::integer;
      if v_previous_position is null then select max(position) into v_previous_position from public.encounter_combatants where encounter_id=v_event.encounter_id;
        v_previous_round:=greatest(0,v_previous_round-1);
      end if;
    end if;
    update public.encounters set round=v_previous_round,current_turn_position=v_previous_position,version=version+1 where id=v_event.encounter_id;
    v_after:=jsonb_build_object('round',v_previous_round,'turnPosition',v_previous_position);
  elsif v_event.event_type like 'initiative_%' then
    v_snapshot:=v_event.before_data->'combatants';
    if v_snapshot is null or jsonb_typeof(v_snapshot)<>'array' then raise exception 'Este evento antigo não possui a ordem anterior da iniciativa'; end if;
    delete from public.encounter_combatants where encounter_id=v_event.encounter_id;
    for v_member in select * from jsonb_array_elements(v_snapshot) loop
      insert into public.encounter_combatants(id,campaign_id,encounter_id,character_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state,actions_state,private_notes,initiative_bonus,agility)
      values((v_member->>'id')::uuid,v_event.campaign_id,v_event.encounter_id,(v_member->>'character_id')::uuid,v_member->>'display_name',v_member->>'kind',(v_member->>'initiative')::integer,(v_member->>'position')::integer,(v_member->>'current_hp')::integer,(v_member->>'maximum_hp')::integer,coalesce((v_member->>'hidden_hp')::boolean,false),v_member->>'visible_state',coalesce(v_member->'actions_state','{}'::jsonb),v_member->>'private_notes',coalesce((v_member->>'initiative_bonus')::integer,0),coalesce((v_member->>'agility')::integer,0));
    end loop;
    update public.encounters set current_turn_position=(v_event.before_data->>'turnPosition')::integer,version=version+1 where id=v_event.encounter_id;
  else
    raise exception 'Este tipo de evento exige correção manual e não pode ser desfeito automaticamente';
  end if;

  insert into public.audit_events(campaign_id,session_id,encounter_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key,compensates_event_id,reversal_status)
  values(v_event.campaign_id,v_event.session_id,v_event.encounter_id,p_actor_user_id,v_event.entity_type,v_event.entity_id,'session_event_reversed','gm_only',v_before,v_after,jsonb_build_object('reason',trim(p_reason),'originalEventType',v_event.event_type),p_idempotency_key,v_event.id,'blocked')
  returning id into v_compensation;
  update public.audit_events set reversal_status='reversed',reversed_at=now(),reversed_by=p_actor_user_id where id=v_event.id;
  insert into public.notifications(campaign_id,user_id,type,title,safe_preview,protected_payload)
  select v_event.campaign_id,member.user_id,'session_event_reversed','A sessão foi corrigida','Uma ação foi desfeita pelo mestre e o estado foi sincronizado.',jsonb_build_object('eventId',v_event.id,'compensationId',v_compensation)
  from public.campaign_members member where member.campaign_id=v_event.campaign_id and member.status='active';
  return jsonb_build_object('eventId',v_compensation,'originalEventId',v_event.id,'duplicate',false);
end $$;

create or replace function public.set_scene_reveal_state(
  p_campaign_id uuid,p_session_id uuid,p_scene_id uuid,p_enabled boolean,p_synchronized boolean,p_paths jsonb,p_actor_user_id uuid,p_idempotency_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_state public.scene_reveal_states%rowtype; v_live public.live_sessions%rowtype;
begin
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if jsonb_typeof(p_paths)<>'array' or jsonb_array_length(p_paths)>500 then raise exception 'Traços da máscara inválidos'; end if;
  if not exists(select 1 from public.game_scenes where id=p_scene_id and campaign_id=p_campaign_id and deleted_at is null) then raise exception 'Cena inválida'; end if;
  insert into public.scene_reveal_states as state(scene_id,campaign_id,enabled,synchronized,paths,updated_by)
  values(p_scene_id,p_campaign_id,p_enabled,p_synchronized,p_paths,p_actor_user_id)
  on conflict(scene_id) do update set enabled=excluded.enabled,synchronized=excluded.synchronized,paths=excluded.paths,version=state.version+1,updated_by=excluded.updated_by,updated_at=now()
  returning * into v_state;
  select * into v_live from public.live_sessions where session_id=p_session_id for update;
  if v_live.id is not null then
    update public.live_sessions set sequence_number=sequence_number+1,snapshot=snapshot||jsonb_build_object('revealVersion',v_state.version,'revealSynchronized',p_synchronized),updated_at=now() where id=v_live.id returning * into v_live;
    insert into public.live_session_events(campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key)
    values(p_campaign_id,v_live.id,v_live.sequence_number,'scene_reveal_updated','{"kind":"party"}'::jsonb,jsonb_build_object('sceneId',p_scene_id,'version',v_state.version,'enabled',p_enabled,'synchronized',p_synchronized),p_actor_user_id,p_idempotency_key);
  end if;
  insert into public.audit_events(campaign_id,session_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_session_id,p_actor_user_id,'scene_reveal',p_scene_id,'scene_reveal_updated','gm_only',jsonb_build_object('version',v_state.version,'enabled',p_enabled,'synchronized',p_synchronized,'pathCount',jsonb_array_length(p_paths)),gen_random_uuid());
  return jsonb_build_object('version',v_state.version,'enabled',p_enabled,'synchronized',p_synchronized);
end $$;

create or replace function public.rewind_session_script_run(
  p_campaign_id uuid,p_session_id uuid,p_run_id uuid,p_actor_user_id uuid,p_reason text,p_idempotency_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_run public.script_runs%rowtype; v_event public.script_run_events%rowtype; v_node public.script_nodes%rowtype; v_sequence bigint; v_live public.live_sessions%rowtype;
begin
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if char_length(trim(p_reason))<3 then raise exception 'Informe o motivo do retrocesso'; end if;
  select * into v_run from public.script_runs where id=p_run_id and campaign_id=p_campaign_id and session_id=p_session_id for update;
  if v_run.id is null then raise exception 'Execução do roteiro não encontrada'; end if;
  select * into v_event from public.script_run_events where script_run_id=p_run_id and event_type in ('script_start','script_advance','script_rewind') and sequence_number<v_run.sequence_number order by sequence_number desc limit 1;
  if v_event.id is null then raise exception 'O roteiro já está no primeiro passo'; end if;
  select * into v_node from public.script_nodes where script_version_id=v_run.script_version_id and stable_key=v_event.payload->>'currentNodeKey';
  if v_node.id is null then raise exception 'O passo anterior não existe nesta versão do roteiro'; end if;
  v_sequence:=v_run.sequence_number+1;
  update public.script_runs set current_node_id=v_node.id,status='running',sequence_number=v_sequence,ended_at=null where id=v_run.id;
  update public.script_run_state set current_snapshot=current_snapshot||jsonb_build_object('currentNodeKey',v_node.stable_key,'status','running','lastAction','rewind','reason',trim(p_reason)),version=version+1,updated_at=now() where script_run_id=v_run.id;
  insert into public.script_run_events(campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key)
  values(p_campaign_id,p_run_id,v_sequence,'script_rewind','{"kind":"party"}'::jsonb,jsonb_build_object('currentNodeKey',v_node.stable_key,'status','running','reason',trim(p_reason)),p_actor_user_id,p_idempotency_key);
  select * into v_live from public.live_sessions where session_id=p_session_id for update;
  if v_live.id is not null then
    update public.live_sessions set current_script_run_id=p_run_id,sequence_number=sequence_number+1,snapshot=snapshot||jsonb_build_object('scriptRunId',p_run_id,'currentNodeKey',v_node.stable_key,'scriptStatus','running'),updated_at=now() where id=v_live.id returning * into v_live;
    insert into public.live_session_events(campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key)
    values(p_campaign_id,v_live.id,v_live.sequence_number,'script_rewind','{"kind":"party"}'::jsonb,jsonb_build_object('scriptRunId',p_run_id,'currentNodeKey',v_node.stable_key,'status','running'),p_actor_user_id,p_idempotency_key);
  end if;
  return jsonb_build_object('runId',p_run_id,'status','running','sequence',v_sequence,'currentNodeKey',v_node.stable_key,'duplicate',false);
end $$;

create or replace function public.restore_rule_override_version(
  p_campaign_id uuid,p_rule_definition_id uuid,p_log_id uuid,p_reason text,p_actor_user_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_log public.rule_change_log%rowtype;
begin
  if auth.role()<>'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  select * into v_log from public.rule_change_log where id=p_log_id and campaign_id=p_campaign_id and rule_definition_id=p_rule_definition_id;
  if v_log.id is null or v_log.after_data is null then raise exception 'Versão da regra não encontrada'; end if;
  return public.apply_rule_override(p_campaign_id,p_rule_definition_id,v_log.after_data,p_reason,p_actor_user_id);
end $$;

revoke all on function public.reverse_session_event(uuid,text,uuid,uuid) from public;
revoke all on function public.attach_audit_event_to_session(uuid,uuid,uuid) from public;
revoke all on function public.set_scene_reveal_state(uuid,uuid,uuid,boolean,boolean,jsonb,uuid,uuid) from public;
revoke all on function public.rewind_session_script_run(uuid,uuid,uuid,uuid,text,uuid) from public;
revoke all on function public.restore_rule_override_version(uuid,uuid,uuid,text,uuid) from public;
grant execute on function public.reverse_session_event(uuid,text,uuid,uuid) to authenticated,service_role;
grant execute on function public.attach_audit_event_to_session(uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.set_scene_reveal_state(uuid,uuid,uuid,boolean,boolean,jsonb,uuid,uuid) to authenticated,service_role;
grant execute on function public.rewind_session_script_run(uuid,uuid,uuid,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.restore_rule_override_version(uuid,uuid,uuid,text,uuid) to authenticated,service_role;

do $$ begin
  alter publication supabase_realtime add table public.audit_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.session_summaries;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.scene_reveal_states;
exception when duplicate_object then null; end $$;

commit;
