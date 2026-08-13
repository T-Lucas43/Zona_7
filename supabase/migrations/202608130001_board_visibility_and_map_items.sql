begin;

alter table public.investigation_board_items
  add column if not exists visible_to_players boolean not null default false;

-- Preserve the visibility of clues that were already on the board before this control existed.
update public.investigation_board_items
set visible_to_players = true
where updated_at < '2026-08-13'::timestamptz;

drop policy if exists investigation_board_items_player_read on public.investigation_board_items;
create policy investigation_board_items_player_read on public.investigation_board_items
for select to authenticated
using (
  visible_to_players
  and exists (
    select 1
    from public.handouts handout
    where handout.id = investigation_board_items.handout_id
      and handout.deleted_at is null
      and (
        (
          handout.visibility in ('public','campaign')
          and public.is_campaign_member(handout.campaign_id)
        )
        or exists (
          select 1
          from public.handout_access access
          where access.handout_id = handout.id
            and public.is_character_owner(access.character_id)
        )
      )
  )
);

drop policy if exists investigation_board_connections_player_read on public.investigation_board_connections;
create policy investigation_board_connections_player_read on public.investigation_board_connections
for select to authenticated
using (
  exists (
    select 1
    from public.investigation_board_items source_item
    where source_item.handout_id = investigation_board_connections.from_handout_id
      and source_item.visible_to_players
  )
  and exists (
    select 1
    from public.investigation_board_items target_item
    where target_item.handout_id = investigation_board_connections.to_handout_id
      and target_item.visible_to_players
  )
);

alter table public.items
  add column if not exists image_path text;

alter table public.scene_tokens
  alter column actor_id drop not null;
alter table public.scene_tokens
  add column if not exists item_id uuid references public.items(id) on delete cascade;
alter table public.scene_tokens
  drop constraint if exists scene_tokens_scene_id_actor_id_key;
alter table public.scene_tokens
  drop constraint if exists scene_tokens_content_kind_check;
alter table public.scene_tokens
  add constraint scene_tokens_content_kind_check
  check (num_nonnulls(actor_id, item_id) = 1);

create unique index if not exists scene_tokens_scene_actor_unique
  on public.scene_tokens(scene_id, actor_id)
  where actor_id is not null;
create unique index if not exists scene_tokens_scene_item_unique
  on public.scene_tokens(scene_id, item_id)
  where item_id is not null;

drop policy if exists scene_tokens_member_read on public.scene_tokens;
create policy scene_tokens_member_read on public.scene_tokens
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or (
    public.is_campaign_member(campaign_id)
    and visible
    and (
      exists (
        select 1 from public.actors actor
        where actor.id = scene_tokens.actor_id
          and actor.visibility <> 'gm_only'
          and actor.deleted_at is null
      )
      or exists (
        select 1 from public.items item
        where item.id = scene_tokens.item_id
          and item.deleted_at is null
      )
    )
  )
);

create or replace function public.add_item_to_scene(
  p_campaign_id uuid,
  p_scene_id uuid,
  p_item_id uuid,
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
  v_item public.items%rowtype;
  v_token_id uuid;
begin
  if auth.uid() is distinct from p_actor_user_id
    or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Apenas o mestre pode inserir itens na cena.';
  end if;
  if p_x not between 0 and 1 or p_y not between 0 and 1 then
    raise exception 'Posição do item inválida.';
  end if;
  select * into v_item
  from public.items
  where id = p_item_id and campaign_id = p_campaign_id and deleted_at is null;
  if v_item.id is null then raise exception 'Item não encontrado.'; end if;
  if not exists (
    select 1 from public.game_scenes
    where id = p_scene_id and campaign_id = p_campaign_id and deleted_at is null
  ) then raise exception 'Cena não encontrada.'; end if;

  insert into public.scene_tokens(campaign_id,scene_id,item_id,label,x,y,visible,token_state)
  values(
    p_campaign_id,p_scene_id,p_item_id,v_item.name,p_x,p_y,p_visible_to_players,
    jsonb_build_object('kind','item')
  )
  on conflict(scene_id,item_id) where item_id is not null do update set
    label = excluded.label,
    x = excluded.x,
    y = excluded.y,
    visible = excluded.visible,
    version = public.scene_tokens.version + 1,
    updated_at = now()
  returning id into v_token_id;

  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_actor_user_id,'scene_token',v_token_id,'item_added_to_scene','gm_only',
    jsonb_build_object('itemId',p_item_id,'sceneId',p_scene_id,'visibleToPlayers',p_visible_to_players,'x',p_x,'y',p_y),
    gen_random_uuid()
  );
  return v_token_id;
end;
$$;

revoke all on function public.add_item_to_scene(uuid,uuid,uuid,numeric,numeric,boolean,uuid) from public;
grant execute on function public.add_item_to_scene(uuid,uuid,uuid,numeric,numeric,boolean,uuid) to authenticated;

commit;
