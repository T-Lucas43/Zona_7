begin;

create or replace function public.control_session_runtime(
  p_campaign_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_now timestamptz := now();
  v_elapsed bigint;
  v_status text;
  v_timer_started_at timestamptz;
  v_existing jsonb;
  v_live public.live_sessions%rowtype;
  v_live_sequence bigint;
  v_payload jsonb;
  v_run public.script_runs%rowtype;
  v_start_node_id uuid;
  v_start_node_key text;
  v_script_sequence bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Ator inválido';
  end if;
  if auth.role() <> 'service_role'
    and not public.has_campaign_role(p_campaign_id, array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão para controlar a sessão';
  end if;
  if p_action not in ('start','pause','resume','reopen','restart','end') then
    raise exception 'Ação inválida';
  end if;

  select after_data into v_existing
  from public.audit_events
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  select * into v_session
  from public.sessions
  where id = p_session_id and campaign_id = p_campaign_id
  for update;
  if v_session.id is null then raise exception 'Sessão não encontrada'; end if;

  v_elapsed := v_session.elapsed_seconds + case
    when v_session.status = 'active' and v_session.timer_started_at is not null
      then greatest(0, floor(extract(epoch from (v_now - v_session.timer_started_at)))::bigint)
    else 0
  end;

  if p_action = 'start' then
    if v_session.status not in ('draft','scheduled','open') then
      raise exception 'Use retomar ou reabrir para esta sessão';
    end if;
    v_status := 'active';
    v_timer_started_at := v_now;
    update public.sessions
    set status = v_status, started_at = coalesce(started_at, v_now),
        timer_started_at = v_timer_started_at, ended_at = null, updated_at = v_now
    where id = v_session.id;
  elsif p_action = 'resume' then
    if v_session.status <> 'paused' then raise exception 'A sessão não está pausada'; end if;
    v_status := 'active';
    v_timer_started_at := v_now;
    update public.sessions
    set status = v_status, timer_started_at = v_timer_started_at, updated_at = v_now
    where id = v_session.id;
  elsif p_action = 'reopen' then
    if v_session.status <> 'ended' then raise exception 'A sessão não está encerrada'; end if;
    v_status := 'active';
    v_timer_started_at := v_now;
    update public.sessions
    set status = v_status, timer_started_at = v_timer_started_at,
        ended_at = null, updated_at = v_now
    where id = v_session.id;
  elsif p_action = 'restart' then
    if v_session.status = 'archived' then raise exception 'Uma sessão arquivada não pode ser reiniciada'; end if;
    v_status := 'active';
    v_elapsed := 0;
    v_timer_started_at := v_now;
    update public.sessions
    set status = v_status, elapsed_seconds = 0, timer_started_at = v_timer_started_at,
        started_at = v_now, ended_at = null, updated_at = v_now
    where id = v_session.id;
    update public.encounters
    set round = 0, current_turn_position = null, version = version + 1,
        started_at = null, ended_at = null
    where campaign_id = p_campaign_id and session_id = p_session_id
      and status in ('active','paused','ended');
  elsif p_action = 'pause' then
    if v_session.status <> 'active' then raise exception 'A sessão não está em andamento'; end if;
    v_status := 'paused';
    v_timer_started_at := null;
    update public.sessions
    set status = v_status, elapsed_seconds = v_elapsed,
        timer_started_at = null, updated_at = v_now
    where id = v_session.id;
  else
    if v_session.status not in ('active','paused') then raise exception 'A sessão não pode ser encerrada neste estado'; end if;
    v_status := 'ended';
    v_timer_started_at := null;
    update public.sessions
    set status = v_status, elapsed_seconds = v_elapsed,
        timer_started_at = null, ended_at = v_now, updated_at = v_now
    where id = v_session.id;
  end if;

  select * into v_live
  from public.live_sessions
  where campaign_id = p_campaign_id and session_id = p_session_id
  for update;
  if p_action = 'restart' and v_live.current_script_run_id is not null then
    select * into v_run from public.script_runs where id = v_live.current_script_run_id for update;
    select node.id,node.stable_key into v_start_node_id,v_start_node_key
    from public.script_versions version
    join public.script_nodes node
      on node.script_version_id = version.id
     and node.stable_key = coalesce(version.canonical_document->>'startNodeId',version.canonical_document->>'start')
    where version.id = v_run.script_version_id
    limit 1;
    if v_run.id is not null and v_start_node_id is not null then
      v_script_sequence := v_run.sequence_number + 1;
      update public.script_runs
      set current_node_id = v_start_node_id, status = 'running',
          sequence_number = v_script_sequence, started_at = v_now, ended_at = null
      where id = v_run.id;
      update public.script_run_state
      set current_snapshot = jsonb_build_object('currentNodeKey',v_start_node_key,'status','running','lastAction','session_restart'),
          version = version + 1, updated_at = v_now
      where script_run_id = v_run.id;
      insert into public.script_run_events(
        campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key
      ) values (
        p_campaign_id,v_run.id,v_script_sequence,'session_restart','{"kind":"party"}'::jsonb,
        jsonb_build_object('currentNodeKey',v_start_node_key,'status','running'),p_actor_user_id,p_idempotency_key
      );
    end if;
  end if;
  if v_live.id is not null then
    v_live_sequence := v_live.sequence_number + 1;
    update public.live_sessions
    set state = v_status, sequence_number = v_live_sequence, updated_at = v_now,
        snapshot = snapshot || jsonb_build_object(
          'sessionStatus',v_status,
          'elapsedSeconds',v_elapsed,
          'timerStartedAt',v_timer_started_at,
          'currentNodeKey',coalesce(v_start_node_key,snapshot->>'currentNodeKey')
        )
    where id = v_live.id;
    insert into public.live_session_events(
      campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key
    ) values (
      p_campaign_id,v_live.id,v_live_sequence,'session_'||p_action,
      '{"kind":"party"}'::jsonb,
      jsonb_build_object('status',v_status,'elapsedSeconds',v_elapsed,'timerStartedAt',v_timer_started_at,'currentNodeKey',v_start_node_key),
      p_actor_user_id,p_idempotency_key
    );
  end if;

  v_payload := jsonb_build_object(
    'sessionId',v_session.id,'status',v_status,'elapsedSeconds',v_elapsed,
    'timerStartedAt',v_timer_started_at,'liveSequence',v_live_sequence,
    'scriptSequence',v_script_sequence,'currentNodeKey',v_start_node_key,'duplicate',false
  );
  insert into public.audit_events(
    campaign_id,session_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_session_id,p_actor_user_id,'session',p_session_id,'session_'||p_action,
    'gm_only',v_payload,p_idempotency_key
  );
  return v_payload;
end;
$$;

revoke all on function public.control_session_runtime(uuid,uuid,uuid,text,uuid) from public;
grant execute on function public.control_session_runtime(uuid,uuid,uuid,text,uuid) to authenticated, service_role;

commit;
