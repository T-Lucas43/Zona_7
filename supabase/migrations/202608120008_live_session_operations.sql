begin;

alter table public.abilities
  add column if not exists use_criteria text,
  add column if not exists application_text text;

alter table public.roll_requests
  add column if not exists character_ability_id uuid references public.character_abilities(id) on delete cascade,
  add column if not exists decision text check (decision in ('approved','rejected')),
  add column if not exists resolved_by uuid references public.profiles(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists rolled_at timestamptz;

alter table public.live_sessions
  add column if not exists scene_sync_enabled boolean not null default true;

create index if not exists roll_requests_session_ability_idx
  on public.roll_requests(session_id, character_ability_id, created_at desc);

create or replace function public.control_session_script_run(
  p_campaign_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_script_package_id uuid default null,
  p_run_id uuid default null,
  p_target_stable_key text default null,
  p_reason text default 'Controle manual do mestre',
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.script_packages%rowtype;
  v_version public.script_versions%rowtype;
  v_run public.script_runs%rowtype;
  v_node public.script_nodes%rowtype;
  v_run_id uuid;
  v_sequence bigint;
  v_live public.live_sessions%rowtype;
  v_live_sequence bigint;
  v_status text;
  v_current_stable text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Ator invalido';
  end if;
  if auth.role() <> 'service_role'
    and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissao';
  end if;
  if not exists(select 1 from public.sessions where id=p_session_id and campaign_id=p_campaign_id) then
    raise exception 'Sessao nao encontrada';
  end if;
  if p_action not in ('start','advance','pause','resume','improvise','complete') then
    raise exception 'Acao de roteiro invalida';
  end if;

  select script_run_id into v_run_id
  from public.script_run_events where idempotency_key=p_idempotency_key;
  if v_run_id is not null then
    select * into v_run from public.script_runs where id=v_run_id;
    select stable_key into v_current_stable from public.script_nodes where id=v_run.current_node_id;
    return jsonb_build_object('runId',v_run.id,'status',v_run.status,'sequence',v_run.sequence_number,'currentNodeKey',v_current_stable,'duplicate',true);
  end if;

  if p_action='start' then
    select * into v_package
    from public.script_packages
    where id=p_script_package_id and campaign_id=p_campaign_id and state='published' and deleted_at is null
    for update;
    if v_package.id is null or v_package.current_version_id is null then
      raise exception 'Publique o roteiro antes de executa-lo';
    end if;
    select * into v_version
    from public.script_versions
    where id=v_package.current_version_id and state='published';
    select * into v_node
    from public.script_nodes
    where script_version_id=v_version.id
      and stable_key=coalesce(v_version.canonical_document->>'startNodeId',v_version.canonical_document->>'start');
    if v_node.id is null then raise exception 'No inicial nao encontrado'; end if;

    update public.script_runs
    set status='completed',ended_at=coalesce(ended_at,now())
    where session_id=p_session_id and status in ('preparing','running','paused','improvising');
    insert into public.script_runs(
      campaign_id,script_version_id,session_id,current_node_id,status,sequence_number,started_by,started_at
    ) values (
      p_campaign_id,v_version.id,p_session_id,v_node.id,'running',1,p_actor_user_id,now()
    ) returning * into v_run;
    insert into public.script_run_state(script_run_id,campaign_id,variables,current_snapshot)
    values(
      v_run.id,p_campaign_id,coalesce(v_version.canonical_document->'variables','{}'::jsonb),
      jsonb_build_object('currentNodeKey',v_node.stable_key,'status','running')
    );
    v_run_id:=v_run.id;
    v_sequence:=1;
    v_status:='running';
    v_current_stable:=v_node.stable_key;
  else
    select * into v_run
    from public.script_runs
    where id=p_run_id and campaign_id=p_campaign_id and session_id=p_session_id
    for update;
    if v_run.id is null then raise exception 'Execucao nao encontrada nesta sessao'; end if;
    v_run_id:=v_run.id;
    v_status:=v_run.status;
    select stable_key into v_current_stable from public.script_nodes where id=v_run.current_node_id;
    if p_action='advance' then
      if p_target_stable_key is null then raise exception 'Escolha o proximo no'; end if;
      select target.* into v_node
      from public.script_edges edge
      join public.script_nodes target on target.id=edge.target_node_id
      where edge.source_node_id=v_run.current_node_id and target.stable_key=p_target_stable_key
      limit 1;
      if v_node.id is null then raise exception 'Destino invalido'; end if;
      v_current_stable:=v_node.stable_key;
      update public.script_runs
      set current_node_id=v_node.id,status='running',sequence_number=sequence_number+1
      where id=v_run.id returning * into v_run;
      v_status:='running';
    elsif p_action='pause' then
      if v_run.status not in ('running','improvising') then raise exception 'O roteiro nao pode ser pausado neste estado'; end if;
      update public.script_runs set status='paused',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run;
      v_status:='paused';
    elsif p_action='resume' then
      if v_run.status not in ('paused','improvising') then raise exception 'O roteiro nao esta pausado'; end if;
      update public.script_runs set status='running',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run;
      v_status:='running';
    elsif p_action='improvise' then
      if v_run.status='completed' then raise exception 'O roteiro ja foi encerrado'; end if;
      update public.script_runs set status='improvising',sequence_number=sequence_number+1 where id=v_run.id returning * into v_run;
      v_status:='improvising';
    elsif p_action='complete' then
      update public.script_runs
      set status='completed',sequence_number=sequence_number+1,ended_at=now()
      where id=v_run.id returning * into v_run;
      v_status:='completed';
    end if;
    v_sequence:=v_run.sequence_number;
    update public.script_run_state
    set current_snapshot=jsonb_build_object(
      'currentNodeKey',v_current_stable,'status',v_status,'lastAction',p_action,'reason',p_reason
    ),version=version+1,updated_at=now()
    where script_run_id=v_run.id;
  end if;

  insert into public.script_run_events(
    campaign_id,script_run_id,sequence_number,event_type,audience,payload,created_by,idempotency_key
  ) values (
    p_campaign_id,v_run_id,v_sequence,'script_'||p_action,'{"kind":"party"}'::jsonb,
    jsonb_build_object('currentNodeKey',v_current_stable,'status',v_status,'reason',p_reason),
    p_actor_user_id,p_idempotency_key
  );

  insert into public.live_sessions as current_live(
    campaign_id,session_id,current_script_run_id,sequence_number,state,snapshot,started_at,updated_at
  ) values (
    p_campaign_id,p_session_id,case when p_action='complete' then null else v_run_id end,1,v_status,
    jsonb_build_object('scriptRunId',case when p_action='complete' then null else v_run_id end,'currentNodeKey',v_current_stable,'scriptStatus',v_status),
    now(),now()
  ) on conflict(session_id) do update set
    current_script_run_id=excluded.current_script_run_id,
    sequence_number=current_live.sequence_number+1,
    snapshot=current_live.snapshot || excluded.snapshot,
    updated_at=now()
  returning * into v_live;
  v_live_sequence:=v_live.sequence_number;
  insert into public.live_session_events(
    campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key
  ) values (
    p_campaign_id,v_live.id,v_live_sequence,'script_'||p_action,'{"kind":"party"}'::jsonb,
    jsonb_build_object('scriptRunId',v_run_id,'currentNodeKey',v_current_stable,'status',v_status),
    p_actor_user_id,p_idempotency_key
  );
  return jsonb_build_object('runId',v_run_id,'status',v_status,'sequence',v_sequence,'currentNodeKey',v_current_stable,'duplicate',false);
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
begin
  v_result:=public.control_session_runtime(
    p_campaign_id,p_session_id,p_actor_user_id,p_action,p_idempotency_key
  );
  if p_action='restart' then
    select * into v_live from public.live_sessions where session_id=p_session_id for update;
    v_run_id:=v_live.current_script_run_id;
    if v_run_id is not null then
      update public.script_runs
      set status='completed',ended_at=now(),sequence_number=sequence_number+1
      where id=v_run_id;
    end if;
    update public.live_sessions
    set current_script_run_id=null,
        sequence_number=sequence_number+1,
        snapshot=(snapshot-'scriptRunId'-'currentNodeKey') || jsonb_build_object('scriptStatus','awaiting_new_run'),
        updated_at=now()
    where session_id=p_session_id;
    v_result:=v_result || jsonb_build_object('scriptRunId',null,'currentNodeKey',null,'scriptStatus','awaiting_new_run');
  end if;
  return v_result;
end;
$$;

create or replace function public.set_session_scene_sync(
  p_campaign_id uuid,
  p_session_id uuid,
  p_scene_id uuid,
  p_enabled boolean,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_live public.live_sessions%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  if not exists(select 1 from public.game_scenes where id=p_scene_id and campaign_id=p_campaign_id and deleted_at is null) then raise exception 'Cena invalida'; end if;
  insert into public.live_sessions as current_live(
    campaign_id,session_id,current_scene_id,scene_sync_enabled,sequence_number,state,snapshot,updated_at
  ) values (
    p_campaign_id,p_session_id,p_scene_id,p_enabled,1,'active',jsonb_build_object('sceneSyncEnabled',p_enabled,'sceneId',p_scene_id),now()
  ) on conflict(session_id) do update set
    current_scene_id=excluded.current_scene_id,
    scene_sync_enabled=excluded.scene_sync_enabled,
    sequence_number=current_live.sequence_number+1,
    snapshot=current_live.snapshot || excluded.snapshot,
    updated_at=now()
  returning * into v_live;
  insert into public.live_session_events(
    campaign_id,live_session_id,sequence_number,event_type,audience,protected_payload,created_by,idempotency_key
  ) values (
    p_campaign_id,v_live.id,v_live.sequence_number,case when p_enabled then 'scene_synced' else 'scene_unsynced' end,
    '{"kind":"party"}'::jsonb,jsonb_build_object('sceneId',p_scene_id,'enabled',p_enabled),p_actor_user_id,p_idempotency_key
  );
  return jsonb_build_object('enabled',p_enabled,'sceneId',p_scene_id,'sequence',v_live.sequence_number);
end;
$$;

create or replace function public.manage_scene_actor(
  p_campaign_id uuid,
  p_scene_id uuid,
  p_actor_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_token public.scene_tokens%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  if p_action not in ('hide','show','remove') then raise exception 'Acao invalida'; end if;
  select * into v_token from public.scene_tokens
  where campaign_id=p_campaign_id and scene_id=p_scene_id and actor_id=p_actor_id for update;
  if v_token.id is null then raise exception 'O ator nao esta nesta cena'; end if;
  if p_action='remove' then
    delete from public.scene_tokens where id=v_token.id;
  else
    update public.scene_tokens set visible=(p_action='show'),version=version+1,updated_at=now() where id=v_token.id;
    update public.actors set visibility=case when p_action='show' then 'campaign' else 'gm_only' end,version=version+1,updated_at=now() where id=p_actor_id;
  end if;
  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_actor_user_id,'scene_token',v_token.id,'scene_actor_'||p_action,'gm_only',
    jsonb_build_object('sceneId',p_scene_id,'actorId',p_actor_id,'action',p_action),p_idempotency_key
  );
  return jsonb_build_object('action',p_action,'tokenId',v_token.id,'visible',p_action='show');
end;
$$;

create or replace function public.mutate_owned_inventory_item(
  p_character_item_id uuid,
  p_action text,
  p_target_character_id uuid,
  p_quantity integer,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.character_items%rowtype;
  v_catalog public.items%rowtype;
  v_target_user uuid;
  v_remaining integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if p_action not in ('use','discard','donate') then raise exception 'Acao invalida'; end if;
  if p_quantity < 1 then raise exception 'Quantidade invalida'; end if;
  select * into v_item from public.character_items where id=p_character_item_id for update;
  if v_item.id is null then raise exception 'Item nao encontrado'; end if;
  if exists(select 1 from public.characters where id=v_item.character_id and character_state in ('dying','dead')) then
    raise exception 'O personagem esta sem acoes neste estado';
  end if;
  if auth.role() <> 'service_role'
    and not public.is_character_owner(v_item.character_id)
    and not public.has_campaign_role(v_item.campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissao para alterar este inventario';
  end if;
  select * into v_catalog from public.items where id=v_item.item_id;
  if p_action='use' and v_item.charges is not null then
    if v_item.charges < p_quantity then raise exception 'Cargas insuficientes'; end if;
    update public.character_items set charges=charges-p_quantity,state='usado',version=version+1 where id=v_item.id;
    v_remaining:=v_item.quantity;
  else
    if v_item.quantity < p_quantity then raise exception 'Quantidade insuficiente'; end if;
    v_remaining:=v_item.quantity-p_quantity;
    update public.character_items
    set quantity=v_remaining,state=case when p_action='discard' then 'descartado' when p_action='donate' then 'doado' else 'usado' end,version=version+1
    where id=v_item.id;
  end if;
  if p_action='donate' then
    if p_target_character_id is null or p_target_character_id=v_item.character_id then raise exception 'Escolha outro personagem'; end if;
    if not exists(select 1 from public.characters where id=p_target_character_id and campaign_id=v_item.campaign_id and deleted_at is null and is_npc=false) then raise exception 'Destinatario invalido'; end if;
    insert into public.character_items(campaign_id,character_id,item_id,quantity,state)
    values(v_item.campaign_id,p_target_character_id,v_item.item_id,p_quantity,'recebido por doacao')
    on conflict(character_id,item_id) do update set
      quantity=public.character_items.quantity+excluded.quantity,state=excluded.state,version=public.character_items.version+1;
    select user_id into v_target_user from public.character_owners
    where character_id=p_target_character_id and confirmed_at is not null order by id limit 1;
    if v_target_user is not null then
      insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
      values(
        v_item.campaign_id,v_target_user,p_target_character_id,'item_received',
        'Voce recebeu '||v_catalog.name,'Item doado por outro jogador.',
        jsonb_build_object('itemId',v_catalog.id,'itemName',v_catalog.name,'description',coalesce(v_catalog.description,''),'quantity',p_quantity)
      );
    end if;
  end if;
  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    v_item.campaign_id,p_actor_user_id,'character_item',v_item.id,'inventory_'||p_action,'owner_only',
    jsonb_build_object('itemId',v_catalog.id,'quantity',p_quantity,'remaining',v_remaining,'targetCharacterId',p_target_character_id),p_idempotency_key
  );
  return jsonb_build_object('action',p_action,'remaining',v_remaining,'itemName',v_catalog.name);
end;
$$;

create or replace function public.request_ability_use(
  p_campaign_id uuid,
  p_session_id uuid,
  p_character_id uuid,
  p_character_ability_id uuid,
  p_context text,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_request_id uuid; v_ability public.abilities%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role() <> 'service_role' and not public.is_character_owner(p_character_id) then raise exception 'Esta ficha nao pertence a sua conta'; end if;
  if not exists(select 1 from public.sessions where id=p_session_id and campaign_id=p_campaign_id and status in ('active','paused')) then raise exception 'A sessao nao esta disponivel'; end if;
  if exists(select 1 from public.characters where id=p_character_id and character_state in ('dying','dead')) then raise exception 'O personagem esta sem acoes neste estado'; end if;
  select ability.* into v_ability
  from public.character_abilities link
  join public.abilities ability on ability.id=link.ability_id
  where link.id=p_character_ability_id and link.character_id=p_character_id
    and link.campaign_id=p_campaign_id and link.state='unlocked' and link.deleted_at is null;
  if v_ability.id is null then raise exception 'Habilidade nao liberada'; end if;
  select id into v_request_id from public.roll_requests where idempotency_key=p_idempotency_key;
  if v_request_id is not null then return v_request_id; end if;
  insert into public.roll_requests(
    campaign_id,session_id,requested_by,character_id,character_ability_id,skill_or_attribute,
    difficulty,context,visibility,consequences,status,idempotency_key
  ) values (
    p_campaign_id,p_session_id,p_actor_user_id,p_character_id,p_character_ability_id,
    coalesce(nullif(v_ability.test_formula,''),'1d20'),v_ability.difficulty,
    coalesce(nullif(trim(p_context),''),'Solicitacao de uso: '||v_ability.name),'session',
    jsonb_build_object('abilityName',v_ability.name,'criteria',v_ability.use_criteria,'application',v_ability.application_text),
    'pending',p_idempotency_key
  ) returning id into v_request_id;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select p_campaign_id,member.user_id,p_character_id,'ability_requested','Uso de habilidade solicitado',
    v_ability.name||' aguarda aprovacao.',jsonb_build_object('requestId',v_request_id,'abilityName',v_ability.name)
  from public.campaign_members member
  where member.campaign_id=p_campaign_id and member.status='active' and member.role in ('campaign_owner','game_master','co_master');
  return v_request_id;
end;
$$;

create or replace function public.notify_zero_pv_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.resource<>'pv' or new.current_value<>0 or old.current_value<=0 then return new; end if;
  update public.characters
  set character_state='dying',narrative_status='quase morto',updated_at=now()
  where id=new.character_id and character_state<>'dead';
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select new.campaign_id,owner.user_id,new.character_id,'character_dying','Voce esta quase morto',
    'Seu PV chegou a zero. Voce esta sem acoes ate a decisao do mestre.',
    jsonb_build_object('characterId',new.character_id,'state','dying')
  from public.character_owners owner
  where owner.character_id=new.character_id and owner.confirmed_at is not null;
  return new;
end;
$$;

create or replace function public.enrich_live_content_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_description text;
begin
  if new.type='item_received' and new.protected_payload ? 'itemId' then
    select description into v_description from public.items where id=(new.protected_payload->>'itemId')::uuid;
    new.safe_preview:=coalesce(nullif(v_description,''),new.safe_preview);
    new.protected_payload:=new.protected_payload || jsonb_build_object('description',coalesce(v_description,''));
  elsif new.type='handout_received' and new.protected_payload ? 'handoutId' then
    select coalesce(content.protected_text,handout.public_excerpt) into v_description
    from public.handouts handout left join public.handout_contents content on content.handout_id=handout.id
    where handout.id=(new.protected_payload->>'handoutId')::uuid;
    new.safe_preview:=coalesce(nullif(v_description,''),new.safe_preview);
    new.protected_payload:=new.protected_payload || jsonb_build_object('description',coalesce(v_description,''));
  end if;
  return new;
end;
$$;

drop trigger if exists enrich_live_content_notification_before_insert on public.notifications;
create trigger enrich_live_content_notification_before_insert
before insert on public.notifications
for each row execute function public.enrich_live_content_notification();

drop trigger if exists character_zero_pv_state_after_update on public.character_resources;
create trigger character_zero_pv_state_after_update
after update of current_value on public.character_resources
for each row execute function public.notify_zero_pv_state();

create or replace function public.set_character_life_state(
  p_campaign_id uuid,
  p_character_id uuid,
  p_state text,
  p_actor_user_id uuid,
  p_reason text,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text; v_event uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  if p_state not in ('active','dying','dead') then raise exception 'Estado invalido'; end if;
  update public.characters set
    character_state=p_state,
    narrative_status=case when p_state='dead' then 'morto' when p_state='dying' then 'quase morto' else 'ativo' end,
    updated_at=now(),updated_by=p_actor_user_id,version=version+1
  where id=p_character_id and campaign_id=p_campaign_id and deleted_at is null
  returning name into v_name;
  if v_name is null then raise exception 'Personagem nao encontrado'; end if;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select p_campaign_id,owner.user_id,p_character_id,'character_'||p_state,
    case when p_state='dead' then 'Voce morreu' when p_state='dying' then 'Voce esta quase morto' else 'Voce foi estabilizado' end,
    case when p_state='dead' then 'Seu personagem foi declarado morto pelo mestre.' when p_state='dying' then 'Voce esta sem acoes ate a decisao do mestre.' else 'Suas acoes foram restauradas pelo mestre.' end,
    jsonb_build_object('characterId',p_character_id,'state',p_state,'reason',p_reason)
  from public.character_owners owner
  where owner.character_id=p_character_id and owner.confirmed_at is not null;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,metadata,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'character',p_character_id,'character_life_state_changed','owner_only',jsonb_build_object('state',p_state),jsonb_build_object('reason',p_reason),p_idempotency_key)
  returning id into v_event;
  return jsonb_build_object('characterId',p_character_id,'state',p_state,'eventId',v_event);
end;
$$;

create or replace function public.adjust_character_resource_maximum(
  p_campaign_id uuid,
  p_character_id uuid,
  p_resource text,
  p_maximum integer,
  p_adjust_current boolean,
  p_actor_user_id uuid,
  p_reason text,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_before public.character_resources%rowtype; v_after public.character_resources%rowtype; v_event uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  if p_resource not in ('pv','pe','san') or p_maximum<1 or p_maximum>9999 then raise exception 'Valor maximo invalido'; end if;
  select * into v_before from public.character_resources where character_id=p_character_id and campaign_id=p_campaign_id and resource=p_resource for update;
  if v_before.id is null then raise exception 'Recurso nao encontrado'; end if;
  update public.character_resources set
    maximum_value=p_maximum,
    current_value=case when p_adjust_current then greatest(0,least(p_maximum,current_value+(p_maximum-v_before.maximum_value))) else least(current_value,p_maximum) end,
    version=version+1,updated_at=now()
  where id=v_before.id returning * into v_after;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'character_resource',v_before.id,'resource_maximum_changed','owner_only',to_jsonb(v_before),to_jsonb(v_after),jsonb_build_object('reason',p_reason),p_idempotency_key)
  returning id into v_event;
  return jsonb_build_object('eventId',v_event,'resource',p_resource,'current',v_after.current_value,'maximum',v_after.maximum_value);
end;
$$;

create or replace function public.adjust_character_attribute(
  p_campaign_id uuid,
  p_character_id uuid,
  p_attribute text,
  p_value integer,
  p_actor_user_id uuid,
  p_reason text,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_before public.character_attributes%rowtype; v_event uuid;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role()<>'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  if p_attribute not in ('agi','for','int','pre','vig') or p_value<0 or p_value>20 then raise exception 'Atributo invalido'; end if;
  if not exists(select 1 from public.characters where id=p_character_id and campaign_id=p_campaign_id and deleted_at is null) then raise exception 'Personagem nao encontrado'; end if;
  select * into v_before from public.character_attributes where character_id=p_character_id for update;
  if p_attribute='agi' then update public.character_attributes set agility=p_value,updated_at=now() where character_id=p_character_id;
  elsif p_attribute='for' then update public.character_attributes set strength=p_value,updated_at=now() where character_id=p_character_id;
  elsif p_attribute='int' then update public.character_attributes set intellect=p_value,updated_at=now() where character_id=p_character_id;
  elsif p_attribute='pre' then update public.character_attributes set presence=p_value,updated_at=now() where character_id=p_character_id;
  else update public.character_attributes set vigor=p_value,updated_at=now() where character_id=p_character_id;
  end if;
  update public.characters set version=version+1,updated_at=now(),updated_by=p_actor_user_id where id=p_character_id;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'character',p_character_id,'character_attribute_changed','owner_only',jsonb_build_object('attribute',p_attribute,'value',case p_attribute when 'agi' then v_before.agility when 'for' then v_before.strength when 'int' then v_before.intellect when 'pre' then v_before.presence else v_before.vigor end),jsonb_build_object('attribute',p_attribute,'value',p_value),jsonb_build_object('reason',p_reason),p_idempotency_key)
  returning id into v_event;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select p_campaign_id,owner.user_id,p_character_id,'attribute_changed','Atributo atualizado',upper(p_attribute)||' agora e '||p_value,jsonb_build_object('attribute',p_attribute,'value',p_value)
  from public.character_owners owner where owner.character_id=p_character_id and owner.confirmed_at is not null;
  return jsonb_build_object('eventId',v_event,'attribute',p_attribute,'value',p_value);
end;
$$;

create or replace function public.resolve_ability_use_request(
  p_campaign_id uuid,
  p_request_id uuid,
  p_approved boolean,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.roll_requests%rowtype; v_name text; v_user uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissao'; end if;
  select * into v_request from public.roll_requests where id=p_request_id and campaign_id=p_campaign_id for update;
  if v_request.id is null then raise exception 'Solicitacao nao encontrada'; end if;
  if v_request.status <> 'pending' then raise exception 'Solicitacao ja analisada'; end if;
  select ability.name into v_name
  from public.character_abilities link join public.abilities ability on ability.id=link.ability_id
  where link.id=v_request.character_ability_id;
  update public.roll_requests set
    status=case when p_approved then 'answered' else 'revoked' end,
    decision=case when p_approved then 'approved' else 'rejected' end,
    resolved_by=p_actor_user_id,resolved_at=now(),answered_at=now()
  where id=v_request.id;
  select user_id into v_user from public.character_owners
  where character_id=v_request.character_id and confirmed_at is not null order by id limit 1;
  if v_user is not null then
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    values(
      p_campaign_id,v_user,v_request.character_id,'ability_'||case when p_approved then 'approved' else 'rejected' end,
      case when p_approved then 'Habilidade aprovada' else 'Habilidade recusada' end,
      coalesce(v_name,'Habilidade')||case when p_approved then ': role o teste na sala.' else ': o mestre recusou o uso.' end,
      jsonb_build_object('requestId',v_request.id,'abilityName',v_name,'approved',p_approved)
    );
  end if;
  return jsonb_build_object('requestId',v_request.id,'decision',case when p_approved then 'approved' else 'rejected' end,'abilityName',v_name);
end;
$$;

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
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'Solicitacao nao encontrada'; end if;
  if auth.role() <> 'service_role' and (v_request.requested_by<>p_actor_user_id or not public.is_character_owner(v_request.character_id)) then raise exception 'Sem permissao'; end if;
  if v_request.decision<>'approved' then raise exception 'Aguarde a aprovacao do mestre'; end if;
  if v_request.rolled_at is not null then raise exception 'Este teste ja foi rolado'; end if;
  select ability.* into v_ability
  from public.character_abilities link join public.abilities ability on ability.id=link.ability_id
  where link.id=v_request.character_ability_id;
  update public.roll_requests set rolled_at=now() where id=v_request.id;
  return jsonb_build_object(
    'campaignId',v_request.campaign_id,'sessionId',v_request.session_id,'characterId',v_request.character_id,
    'formula',coalesce(nullif(trim(v_ability.test_formula),''),'1d20'),'abilityName',v_ability.name
  );
end;
$$;

create or replace function public.notify_ability_roll(
  p_request_id uuid,
  p_roll_id uuid,
  p_total integer,
  p_actor_user_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.roll_requests%rowtype; v_name text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator invalido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id;
  if v_request.requested_by<>p_actor_user_id then raise exception 'Sem permissao'; end if;
  select ability.name into v_name from public.character_abilities link join public.abilities ability on ability.id=link.ability_id where link.id=v_request.character_ability_id;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select v_request.campaign_id,member.user_id,v_request.character_id,'ability_roll','Resultado de '||coalesce(v_name,'habilidade'),
    'Resultado publico: '||p_total,jsonb_build_object('requestId',p_request_id,'rollId',p_roll_id,'total',p_total,'abilityName',v_name)
  from public.campaign_members member
  where member.campaign_id=v_request.campaign_id and member.status='active';
end;
$$;

revoke all on function public.control_session_script_run(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid) from public;
revoke all on function public.control_session_runtime_v2(uuid,uuid,uuid,text,uuid) from public;
revoke all on function public.set_session_scene_sync(uuid,uuid,uuid,boolean,uuid,uuid) from public;
revoke all on function public.manage_scene_actor(uuid,uuid,uuid,text,uuid,uuid) from public;
revoke all on function public.mutate_owned_inventory_item(uuid,text,uuid,integer,uuid,uuid) from public;
revoke all on function public.request_ability_use(uuid,uuid,uuid,uuid,text,uuid,uuid) from public;
revoke all on function public.resolve_ability_use_request(uuid,uuid,boolean,uuid) from public;
revoke all on function public.claim_ability_roll_request(uuid,uuid) from public;
revoke all on function public.notify_ability_roll(uuid,uuid,integer,uuid) from public;
revoke all on function public.set_character_life_state(uuid,uuid,text,uuid,text,uuid) from public;
revoke all on function public.adjust_character_resource_maximum(uuid,uuid,text,integer,boolean,uuid,text,uuid) from public;
revoke all on function public.adjust_character_attribute(uuid,uuid,text,integer,uuid,text,uuid) from public;
grant execute on function public.control_session_script_run(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid) to authenticated,service_role;
grant execute on function public.control_session_runtime_v2(uuid,uuid,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.set_session_scene_sync(uuid,uuid,uuid,boolean,uuid,uuid) to authenticated,service_role;
grant execute on function public.manage_scene_actor(uuid,uuid,uuid,text,uuid,uuid) to authenticated,service_role;
grant execute on function public.mutate_owned_inventory_item(uuid,text,uuid,integer,uuid,uuid) to authenticated,service_role;
grant execute on function public.request_ability_use(uuid,uuid,uuid,uuid,text,uuid,uuid) to authenticated,service_role;
grant execute on function public.resolve_ability_use_request(uuid,uuid,boolean,uuid) to authenticated,service_role;
grant execute on function public.claim_ability_roll_request(uuid,uuid) to authenticated,service_role;
grant execute on function public.notify_ability_roll(uuid,uuid,integer,uuid) to authenticated,service_role;
grant execute on function public.set_character_life_state(uuid,uuid,text,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.adjust_character_resource_maximum(uuid,uuid,text,integer,boolean,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.adjust_character_attribute(uuid,uuid,text,integer,uuid,text,uuid) to authenticated,service_role;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='roll_requests') then
    alter publication supabase_realtime add table public.roll_requests;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dice_rolls') then
    alter publication supabase_realtime add table public.dice_rolls;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='encounters') then
    alter publication supabase_realtime add table public.encounters;
  end if;
end;
$$;

commit;
