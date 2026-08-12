begin;

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
  v_existing jsonb;
  v_encounter public.encounters%rowtype;
  v_current_position integer;
  v_next_position integer;
  v_next_name text;
  v_round integer;
  v_live public.live_sessions%rowtype;
  v_run public.script_runs%rowtype;
  v_payload jsonb;
  v_script_sequence bigint;
  v_live_sequence bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Ator inválido';
  end if;
  if auth.role() <> 'service_role'
    and not public.has_campaign_role(p_campaign_id, array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão para avançar o turno';
  end if;

  select after_data into v_existing
  from public.audit_events
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  select * into v_encounter
  from public.encounters
  where campaign_id = p_campaign_id
    and session_id = p_session_id
    and status in ('active','paused')
  order by created_at desc
  limit 1
  for update;
  if v_encounter.id is null then raise exception 'Não há encontro ativo para avançar o turno'; end if;

  v_current_position := v_encounter.current_turn_position;
  select min(position) into v_next_position
  from public.encounter_combatants
  where encounter_id = v_encounter.id
    and (v_current_position is null or position > v_current_position);
  v_round := v_encounter.round;
  if v_next_position is null then
    select min(position) into v_next_position
    from public.encounter_combatants
    where encounter_id = v_encounter.id;
    if v_current_position is not null then v_round := v_round + 1; end if;
  end if;
  if v_next_position is null then raise exception 'Encontro sem combatentes'; end if;

  select display_name into v_next_name
  from public.encounter_combatants
  where encounter_id = v_encounter.id and position = v_next_position
  order by id
  limit 1;

  update public.encounters
  set current_turn_position = v_next_position,
      round = v_round,
      version = version + 1
  where id = v_encounter.id;

  v_payload := jsonb_build_object(
    'encounterId', v_encounter.id,
    'round', v_round,
    'turnPosition', v_next_position,
    'currentTurn', v_next_name
  );

  select * into v_live
  from public.live_sessions
  where campaign_id = p_campaign_id and session_id = p_session_id
  for update;

  if v_live.current_script_run_id is not null then
    select * into v_run
    from public.script_runs
    where id = v_live.current_script_run_id
    for update;
    if v_run.id is not null then
      v_script_sequence := v_run.sequence_number + 1;
      update public.script_runs
      set sequence_number = v_script_sequence
      where id = v_run.id;
      update public.script_run_state
      set current_snapshot = current_snapshot || jsonb_build_object(
            'lastAction', 'combat_turn_advanced',
            'combat', v_payload
          ),
          version = version + 1,
          updated_at = now()
      where script_run_id = v_run.id;
      insert into public.script_run_events(
        campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key
      ) values (
        p_campaign_id,v_run.id,v_script_sequence,'combat_turn_advanced',
        '{"kind":"party"}'::jsonb,v_payload,p_actor_user_id,p_idempotency_key
      );
    end if;
  end if;

  if v_live.id is not null then
    v_live_sequence := v_live.sequence_number + 1;
    update public.live_sessions
    set sequence_number = v_live_sequence,
        snapshot = snapshot || jsonb_build_object('combat', v_payload),
        updated_at = now()
    where id = v_live.id;
    insert into public.live_session_events(
      campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key
    ) values (
      p_campaign_id,v_live.id,v_live_sequence,'combat_turn_advanced',
      '{"kind":"party"}'::jsonb,v_payload,p_actor_user_id,p_idempotency_key
    );
  end if;

  v_payload := v_payload || jsonb_build_object(
    'scriptRunId', v_live.current_script_run_id,
    'scriptSequence', v_script_sequence,
    'liveSequence', v_live_sequence,
    'duplicate', false
  );
  insert into public.audit_events(
    campaign_id,session_id,encounter_id,actor_user_id,entity_type,entity_id,event_type,
    visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_session_id,v_encounter.id,p_actor_user_id,'encounter',v_encounter.id,
    'combat_turn_advanced','gm_only',v_payload,p_idempotency_key
  );
  return v_payload;
end;
$$;

revoke all on function public.advance_encounter_turn_synced(uuid,uuid,uuid,uuid) from public;
grant execute on function public.advance_encounter_turn_synced(uuid,uuid,uuid,uuid) to authenticated, service_role;

commit;
