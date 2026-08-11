begin;

alter table public.actors add column if not exists public_portrait_path text;
update public.actors a
set public_portrait_path=c.portrait_path
from public.characters c
where a.character_id=c.id and c.portrait_path is not null and a.public_portrait_path is null;

-- Gragas is a playable character. Rivaldo remains a separate master-only entity.
update public.characters
set is_npc = false,
    visibility = 'selected',
    character_state = 'active',
    updated_at = now()
where id = '20000000-0000-4000-8000-000000000006';

update public.actors
set actor_type = 'player_character',
    visibility = 'campaign',
    gm_description = 'Rivaldo permanece uma entidade separada; Gragas pertence ao jogador vinculado.',
    version = version + 1,
    updated_at = now()
where character_id = '20000000-0000-4000-8000-000000000006';

delete from public.actor_controllers ac
using public.actors a
where ac.actor_id = a.id and a.actor_type = 'player_character';

insert into public.scene_tokens(campaign_id,scene_id,actor_id,label,x,y,visible)
select a.campaign_id,s.id,a.id,'Gragas',0.86,0.70,true
from public.actors a
join lateral (
  select gs.id from public.game_scenes gs
  where gs.campaign_id=a.campaign_id and gs.deleted_at is null
  order by gs.created_at limit 1
) s on true
where a.character_id='20000000-0000-4000-8000-000000000006'
on conflict(scene_id,actor_id) do update set visible=true,label='Gragas';

create table public.session_public_state (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_title text not null,
  public_summary text not null default '',
  public_objective text not null default '',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.session_public_state enable row level security;
alter table public.session_public_state force row level security;
create policy session_public_state_member_read on public.session_public_state
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy session_public_state_master_manage on public.session_public_state
for all to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

insert into public.session_public_state(session_id,campaign_id,scene_title,public_summary,public_objective)
select s.id,s.campaign_id,coalesce(ss.title,s.title),coalesce(ss.public_summary,''),'Descubram a origem da transmissão impossível.'
from public.sessions s
left join public.session_scenes ss on ss.id=s.current_scene_id
on conflict(session_id) do nothing;

create or replace function public.create_playable_character(
  p_campaign_id uuid,
  p_name text,
  p_codename text,
  p_origin text,
  p_class_name text,
  p_path_name text,
  p_nex integer,
  p_defense integer,
  p_pv integer,
  p_pe integer,
  p_san integer,
  p_agility integer,
  p_strength integer,
  p_intellect integer,
  p_presence integer,
  p_vigor integer,
  p_owner_user_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character_id uuid;
  v_actor_id uuid;
  v_meter_id uuid;
  v_scene_id uuid;
  v_existing uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) and auth.role() <> 'service_role' then raise exception 'Sem permissão'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Nome obrigatório'; end if;
  if p_nex not between 0 and 100 or least(p_pv,p_pe,p_san) < 0 then raise exception 'Valores de ficha inválidos'; end if;
  select entity_id into v_existing from public.audit_events where idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  insert into public.characters(
    campaign_id,name,codename,origin,class_name,path_name,nex,defense,narrative_status,
    team_role,is_npc,visibility,character_state,published_at,updated_by
  ) values (
    p_campaign_id,trim(p_name),nullif(trim(p_codename),''),nullif(trim(p_origin),''),
    nullif(trim(p_class_name),''),nullif(trim(p_path_name),''),p_nex,p_defense,
    'ativo','personagem jogável',false,'selected','active',now(),p_actor_user_id
  ) returning id into v_character_id;

  insert into public.character_attributes(character_id,agility,strength,intellect,presence,vigor)
  values(v_character_id,p_agility,p_strength,p_intellect,p_presence,p_vigor);
  insert into public.character_resources(campaign_id,character_id,resource,current_value,maximum_value)
  values
    (p_campaign_id,v_character_id,'pv',p_pv,p_pv),
    (p_campaign_id,v_character_id,'pe',p_pe,p_pe),
    (p_campaign_id,v_character_id,'san',p_san,p_san);
  insert into public.custom_meter_definitions(campaign_id,name,minimum,maximum,stages,rules)
  values(p_campaign_id,trim(p_name)||' — Tensão',0,5,'["Estável","Sinal","Pressão","Ruptura","Domínio","Zona"]'::jsonb,'{}'::jsonb)
  returning id into v_meter_id;
  insert into public.character_meter_values(campaign_id,character_id,meter_definition_id,current_value)
  values(p_campaign_id,v_character_id,v_meter_id,0);

  insert into public.actors(campaign_id,character_id,name,actor_type,public_description,color,visibility)
  values(p_campaign_id,v_character_id,trim(p_name),'player_character',coalesce(nullif(trim(p_codename),''),'Personagem jogável'),'#b52532','campaign')
  returning id into v_actor_id;
  select id into v_scene_id from public.game_scenes where campaign_id=p_campaign_id and deleted_at is null order by created_at limit 1;
  if v_scene_id is not null then
    insert into public.scene_tokens(campaign_id,scene_id,actor_id,label,x,y,visible)
    values(p_campaign_id,v_scene_id,v_actor_id,split_part(trim(p_name),' ',1),0.5,0.5,true)
    on conflict(scene_id,actor_id) do nothing;
  end if;

  if p_owner_user_id is not null then
    if not exists(select 1 from public.campaign_members where campaign_id=p_campaign_id and user_id=p_owner_user_id and status='active' and role='player') then
      raise exception 'A conta escolhida não é um jogador ativo';
    end if;
    insert into public.character_owners(campaign_id,character_id,user_id,confirmed_at)
    values(p_campaign_id,v_character_id,p_owner_user_id,now())
    on conflict(character_id,user_id) do update set confirmed_at=excluded.confirmed_at;
    insert into public.actor_controllers(campaign_id,actor_id,user_id,control_level,granted_by)
    values(p_campaign_id,v_actor_id,p_owner_user_id,'owner',p_actor_user_id)
    on conflict(actor_id,user_id) do update set control_level='owner',granted_by=excluded.granted_by;
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    values(p_campaign_id,p_owner_user_id,v_character_id,'character_assigned','Nova ficha vinculada','Você recebeu um novo personagem.',jsonb_build_object('characterId',v_character_id,'characterName',trim(p_name)));
  end if;

  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'character',v_character_id,'playable_character_created','gm_only',jsonb_build_object('name',trim(p_name),'ownerUserId',p_owner_user_id),p_idempotency_key);
  return v_character_id;
end;
$$;

create or replace function public.deliver_item_to_characters(
  p_campaign_id uuid,
  p_character_ids uuid[],
  p_name text,
  p_description text,
  p_quantity integer,
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_item_id uuid; v_audit_id uuid; v_character_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) and auth.role() <> 'service_role' then raise exception 'Sem permissão'; end if;
  if cardinality(p_character_ids)<1 or char_length(trim(p_name))<2 or p_quantity<1 then raise exception 'Entrega inválida'; end if;
  select id into v_audit_id from public.audit_events where idempotency_key=p_idempotency_key;
  if v_audit_id is not null then return v_audit_id; end if;
  select id into v_item_id from public.items where campaign_id=p_campaign_id and lower(name)=lower(trim(p_name)) and deleted_at is null order by created_at limit 1;
  if v_item_id is null then
    insert into public.items(campaign_id,name,description,category,visibility)
    values(p_campaign_id,trim(p_name),nullif(trim(p_description),''),'Item de sessão','owner_only') returning id into v_item_id;
  else
    update public.items set description=coalesce(nullif(trim(p_description),''),description),updated_at=now() where id=v_item_id;
  end if;
  foreach v_character_id in array p_character_ids loop
    if not exists(select 1 from public.characters where id=v_character_id and campaign_id=p_campaign_id and deleted_at is null and is_npc=false) then raise exception 'Personagem inválido'; end if;
    insert into public.character_items(campaign_id,character_id,item_id,quantity,state)
    values(p_campaign_id,v_character_id,v_item_id,p_quantity,'recebido')
    on conflict(character_id,item_id) do update set quantity=public.character_items.quantity+excluded.quantity,state='recebido',version=public.character_items.version+1;
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    select p_campaign_id,co.user_id,v_character_id,'item_received','Você recebeu '||trim(p_name),'Novo item no inventário.',jsonb_build_object('itemId',v_item_id,'itemName',trim(p_name),'quantity',p_quantity)
    from public.character_owners co where co.character_id=v_character_id and co.confirmed_at is not null;
  end loop;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'item',v_item_id,'item_delivered','gm_only',jsonb_build_object('name',trim(p_name),'quantity',p_quantity,'characterIds',p_character_ids),p_idempotency_key)
  returning id into v_audit_id;
  return v_audit_id;
end;
$$;

create or replace function public.deliver_handout_to_characters(
  p_campaign_id uuid,
  p_character_ids uuid[],
  p_title text,
  p_public_excerpt text,
  p_protected_text text,
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_handout_id uuid; v_audit_id uuid; v_character_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) and auth.role() <> 'service_role' then raise exception 'Sem permissão'; end if;
  if cardinality(p_character_ids)<1 or char_length(trim(p_title))<2 then raise exception 'Pista inválida'; end if;
  select id into v_audit_id from public.audit_events where idempotency_key=p_idempotency_key;
  if v_audit_id is not null then return v_audit_id; end if;
  select id into v_handout_id from public.handouts where campaign_id=p_campaign_id and lower(title)=lower(trim(p_title)) and deleted_at is null order by created_at limit 1;
  if v_handout_id is null then
    insert into public.handouts(campaign_id,title,type,state,visibility,public_excerpt,created_by)
    values(p_campaign_id,trim(p_title),'clue','discovered','selected',nullif(trim(p_public_excerpt),''),p_actor_user_id) returning id into v_handout_id;
  else
    update public.handouts set state='discovered',public_excerpt=coalesce(nullif(trim(p_public_excerpt),''),public_excerpt),updated_at=now() where id=v_handout_id;
  end if;
  insert into public.handout_contents(handout_id,protected_text,metadata)
  values(v_handout_id,nullif(trim(p_protected_text),''),'{}'::jsonb)
  on conflict(handout_id) do update set protected_text=coalesce(excluded.protected_text,public.handout_contents.protected_text);
  foreach v_character_id in array p_character_ids loop
    if not exists(select 1 from public.characters where id=v_character_id and campaign_id=p_campaign_id and deleted_at is null and is_npc=false) then raise exception 'Personagem inválido'; end if;
    if not exists(select 1 from public.handout_access where handout_id=v_handout_id and character_id=v_character_id) then
      insert into public.handout_access(campaign_id,handout_id,character_id,access_level,granted_by)
      values(p_campaign_id,v_handout_id,v_character_id,'read',p_actor_user_id);
    end if;
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    select p_campaign_id,co.user_id,v_character_id,'handout_received','Você recebeu a pista '||trim(p_title),'Nova pista disponível.',jsonb_build_object('handoutId',v_handout_id,'handoutTitle',trim(p_title))
    from public.character_owners co where co.character_id=v_character_id and co.confirmed_at is not null;
  end loop;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'handout',v_handout_id,'handout_delivered','gm_only',jsonb_build_object('title',trim(p_title),'characterIds',p_character_ids),p_idempotency_key)
  returning id into v_audit_id;
  return v_audit_id;
end;
$$;

create or replace function public.set_character_session_visibility(
  p_campaign_id uuid,
  p_character_id uuid,
  p_visible boolean,
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor_id uuid; v_audit_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) and auth.role() <> 'service_role' then raise exception 'Sem permissão'; end if;
  select id into v_audit_id from public.audit_events where idempotency_key=p_idempotency_key;
  if v_audit_id is not null then return v_audit_id; end if;
  select id into v_actor_id from public.actors where campaign_id=p_campaign_id and character_id=p_character_id and deleted_at is null;
  if v_actor_id is null then raise exception 'Personagem sem ator de sessão'; end if;
  update public.actors set visibility=case when p_visible then 'campaign' else 'gm_only' end,version=version+1,updated_at=now() where id=v_actor_id;
  update public.scene_tokens set visible=p_visible,version=version+1,updated_at=now() where actor_id=v_actor_id;
  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'character',p_character_id,'session_visibility_changed','gm_only',jsonb_build_object('visible',p_visible),p_idempotency_key)
  returning id into v_audit_id;
  return v_audit_id;
end;
$$;

create or replace function public.update_session_public_state(
  p_campaign_id uuid,
  p_session_id uuid,
  p_scene_title text,
  p_public_summary text,
  p_public_objective text,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_version integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) and auth.role() <> 'service_role' then raise exception 'Sem permissão'; end if;
  if not exists(select 1 from public.sessions where id=p_session_id and campaign_id=p_campaign_id) then raise exception 'Sessão inválida'; end if;
  insert into public.session_public_state(session_id,campaign_id,scene_title,public_summary,public_objective,updated_by)
  values(p_session_id,p_campaign_id,trim(p_scene_title),trim(p_public_summary),trim(p_public_objective),p_actor_user_id)
  on conflict(session_id) do update set scene_title=excluded.scene_title,public_summary=excluded.public_summary,public_objective=excluded.public_objective,version=public.session_public_state.version+1,updated_at=now(),updated_by=excluded.updated_by
  returning version into v_version;
  return v_version;
end;
$$;

revoke all on function public.create_playable_character(uuid,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,uuid,uuid,uuid) from public;
revoke all on function public.deliver_item_to_characters(uuid,uuid[],text,text,integer,uuid,uuid) from public;
revoke all on function public.deliver_handout_to_characters(uuid,uuid[],text,text,text,uuid,uuid) from public;
revoke all on function public.set_character_session_visibility(uuid,uuid,boolean,uuid,uuid) from public;
revoke all on function public.update_session_public_state(uuid,uuid,text,text,text,uuid) from public;
grant execute on function public.create_playable_character(uuid,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.deliver_item_to_characters(uuid,uuid[],text,text,integer,uuid,uuid) to authenticated,service_role;
grant execute on function public.deliver_handout_to_characters(uuid,uuid[],text,text,text,uuid,uuid) to authenticated,service_role;
grant execute on function public.set_character_session_visibility(uuid,uuid,boolean,uuid,uuid) to authenticated,service_role;
grant execute on function public.update_session_public_state(uuid,uuid,text,text,text,uuid) to authenticated,service_role;

alter publication supabase_realtime add table public.actors;
alter publication supabase_realtime add table public.character_items;
alter publication supabase_realtime add table public.handouts;
alter publication supabase_realtime add table public.handout_access;
alter publication supabase_realtime add table public.session_public_state;

commit;
