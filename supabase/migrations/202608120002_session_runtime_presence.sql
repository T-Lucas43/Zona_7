begin;

alter table public.sessions
  add column if not exists elapsed_seconds bigint not null default 0 check (elapsed_seconds >= 0),
  add column if not exists timer_started_at timestamptz;

update public.sessions
set timer_started_at = coalesce(started_at, now())
where status = 'active' and timer_started_at is null;

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
  v_existing jsonb;
  v_live public.live_sessions%rowtype;
  v_live_sequence bigint;
  v_payload jsonb;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Ator inválido';
  end if;
  if auth.role() <> 'service_role'
    and not public.has_campaign_role(p_campaign_id, array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão para controlar a sessão';
  end if;
  if p_action not in ('start','pause','resume','end') then raise exception 'Ação inválida'; end if;

  select after_data into v_existing
  from public.audit_events
  where idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing || jsonb_build_object('duplicate', true); end if;

  select * into v_session
  from public.sessions
  where id = p_session_id and campaign_id = p_campaign_id
  for update;
  if v_session.id is null then raise exception 'Sessão não encontrada'; end if;

  v_elapsed := v_session.elapsed_seconds + case
    when v_session.timer_started_at is not null
      then greatest(0, floor(extract(epoch from (v_now - v_session.timer_started_at)))::bigint)
    else 0
  end;

  if p_action in ('start','resume') then
    if v_session.status in ('ended','archived') then raise exception 'A sessão já foi encerrada'; end if;
    v_status := 'active';
    update public.sessions
    set status = 'active',
        started_at = coalesce(started_at, v_now),
        timer_started_at = case when status = 'active' then timer_started_at else v_now end
    where id = v_session.id;
  elsif p_action = 'pause' then
    if v_session.status <> 'active' then raise exception 'A sessão não está em andamento'; end if;
    v_status := 'paused';
    update public.sessions
    set status = 'paused', elapsed_seconds = v_elapsed, timer_started_at = null
    where id = v_session.id;
  else
    v_status := 'ended';
    update public.sessions
    set status = 'ended', elapsed_seconds = v_elapsed, timer_started_at = null, ended_at = v_now
    where id = v_session.id;
  end if;

  select * into v_live
  from public.live_sessions
  where campaign_id = p_campaign_id and session_id = p_session_id
  for update;
  if v_live.id is not null then
    v_live_sequence := v_live.sequence_number + 1;
    update public.live_sessions
    set state = v_status, sequence_number = v_live_sequence, updated_at = v_now,
        snapshot = snapshot || jsonb_build_object('sessionStatus',v_status,'elapsedSeconds',v_elapsed)
    where id = v_live.id;
    insert into public.live_session_events(
      campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key
    ) values (
      p_campaign_id,v_live.id,v_live_sequence,'session_'||p_action,
      '{"kind":"party"}'::jsonb,jsonb_build_object('status',v_status,'elapsedSeconds',v_elapsed),
      p_actor_user_id,p_idempotency_key
    );
  end if;

  v_payload := jsonb_build_object(
    'sessionId',v_session.id,'status',v_status,'elapsedSeconds',v_elapsed,
    'timerStartedAt',case when v_status='active' then v_now else null end,
    'liveSequence',v_live_sequence,'duplicate',false
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
