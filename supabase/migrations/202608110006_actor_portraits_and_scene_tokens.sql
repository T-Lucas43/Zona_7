insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('actor-portraits','actor-portraits',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.storage_actor_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return split_part(object_name,'/',2)::uuid;
exception when others then
  return null;
end;
$$;

create policy storage_actor_portraits_read on storage.objects
for select to authenticated using (
  bucket_id='actor-portraits'
  and (
    public.has_campaign_role(public.storage_campaign_id(name),array['campaign_owner','game_master','co_master'])
    or exists (
      select 1 from public.actors a
      where a.id=public.storage_actor_id(name)
        and a.campaign_id=public.storage_campaign_id(name)
        and a.visibility <> 'gm_only'
        and a.deleted_at is null
        and public.is_campaign_member(a.campaign_id)
    )
  )
);

create policy storage_actor_portraits_write on storage.objects
for all to authenticated
using (
  bucket_id='actor-portraits'
  and public.has_campaign_role(public.storage_campaign_id(name),array['campaign_owner','game_master','co_master'])
)
with check (
  bucket_id='actor-portraits'
  and public.has_campaign_role(public.storage_campaign_id(name),array['campaign_owner','game_master','co_master'])
);

drop policy if exists scene_tokens_member_read on public.scene_tokens;
create policy scene_tokens_member_read on public.scene_tokens
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or (
    public.is_campaign_member(campaign_id)
    and visible
    and exists (
      select 1 from public.actors a
      where a.id=scene_tokens.actor_id
        and a.visibility <> 'gm_only'
        and a.deleted_at is null
    )
  )
);

create or replace function public.add_actor_to_scene(
  p_campaign_id uuid,
  p_scene_id uuid,
  p_actor_id uuid,
  p_x numeric,
  p_y numeric,
  p_visible_to_players boolean,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.actors%rowtype;
  v_token_id uuid;
begin
  if auth.uid() is distinct from p_actor_user_id
    or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Apenas o mestre pode inserir atores na cena.';
  end if;
  if p_x not between 0 and 1 or p_y not between 0 and 1 then
    raise exception 'Posição do token inválida.';
  end if;
  select * into v_actor from public.actors
  where id=p_actor_id and campaign_id=p_campaign_id and deleted_at is null;
  if v_actor.id is null then raise exception 'Ator não encontrado.'; end if;
  if not exists (
    select 1 from public.game_scenes
    where id=p_scene_id and campaign_id=p_campaign_id and deleted_at is null
  ) then raise exception 'Cena não encontrada.'; end if;

  update public.actors
  set visibility=case when p_visible_to_players then 'campaign' else 'gm_only' end,
      version=version+1,
      updated_at=now()
  where id=p_actor_id;

  insert into public.scene_tokens(campaign_id,scene_id,actor_id,label,x,y,visible)
  values(p_campaign_id,p_scene_id,p_actor_id,v_actor.name,p_x,p_y,true)
  on conflict(scene_id,actor_id) do update set
    label=excluded.label,
    x=excluded.x,
    y=excluded.y,
    visible=true,
    version=public.scene_tokens.version+1,
    updated_at=now()
  returning id into v_token_id;

  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_actor_user_id,'scene_token',v_token_id,'actor_added_to_scene','gm_only',
    jsonb_build_object('actorId',p_actor_id,'sceneId',p_scene_id,'visibleToPlayers',p_visible_to_players,'x',p_x,'y',p_y),
    gen_random_uuid()
  );
  return v_token_id;
end;
$$;

revoke all on function public.add_actor_to_scene(uuid,uuid,uuid,numeric,numeric,boolean,uuid) from public;
grant execute on function public.add_actor_to_scene(uuid,uuid,uuid,numeric,numeric,boolean,uuid) to authenticated;

create or replace function public.assign_character_to_user(
  p_campaign_id uuid,
  p_member_id uuid,
  p_user_id uuid,
  p_character_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character_name text;
  v_actor_id uuid;
begin
  if auth.uid() is distinct from p_actor_user_id
    or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Apenas o mestre pode alterar o vínculo da ficha.';
  end if;
  if not exists (
    select 1 from public.campaign_members
    where id=p_member_id and campaign_id=p_campaign_id and user_id=p_user_id and role='player'
  ) then raise exception 'Conta de jogador não encontrada nesta campanha.'; end if;

  if p_character_id is not null then
    select name into v_character_name from public.characters
    where id=p_character_id and campaign_id=p_campaign_id and is_npc=false and deleted_at is null
    for update;
    if v_character_name is null then raise exception 'Personagem jogável não encontrado.'; end if;
    if exists (
      select 1 from public.character_owners
      where character_id=p_character_id and user_id<>p_user_id and confirmed_at is not null
    ) then raise exception 'Este personagem já pertence a outra conta.'; end if;
  end if;

  delete from public.actor_controllers ac
  using public.actors a
  where ac.actor_id=a.id and ac.user_id=p_user_id
    and a.campaign_id=p_campaign_id and a.actor_type='player_character';
  delete from public.character_owners
  where campaign_id=p_campaign_id and user_id=p_user_id;

  if p_character_id is not null then
    insert into public.character_owners(campaign_id,character_id,user_id,confirmed_at)
    values(p_campaign_id,p_character_id,p_user_id,now());
    select id into v_actor_id from public.actors where character_id=p_character_id;
    if v_actor_id is not null then
      insert into public.actor_controllers(campaign_id,actor_id,user_id,control_level,granted_by)
      values(p_campaign_id,v_actor_id,p_user_id,'owner',p_actor_user_id);
    end if;
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    values(p_campaign_id,p_user_id,p_character_id,'character_assigned','Você recebeu '||v_character_name,'Uma ficha foi vinculada à sua conta.',jsonb_build_object('characterId',p_character_id,'characterName',v_character_name));
  end if;

  insert into public.audit_events(campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values(p_campaign_id,p_actor_user_id,'campaign_member',p_member_id,'character_assignment_updated','gm_only',jsonb_build_object('userId',p_user_id,'characterId',p_character_id),gen_random_uuid());

  return jsonb_build_object('ok',true,'characterId',p_character_id,'characterName',v_character_name);
end;
$$;

revoke all on function public.assign_character_to_user(uuid,uuid,uuid,uuid,uuid) from public;
grant execute on function public.assign_character_to_user(uuid,uuid,uuid,uuid,uuid) to authenticated;

alter publication supabase_realtime add table public.game_scenes;
alter publication supabase_realtime add table public.media_assets;
