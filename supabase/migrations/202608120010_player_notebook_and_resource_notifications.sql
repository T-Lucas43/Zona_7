begin;

create table public.player_notebook_pages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  title text not null default '',
  content text not null default '',
  linked_handout_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, character_id, page_number)
);

create index player_notebook_owner_idx
  on public.player_notebook_pages(user_id, character_id, page_number);

create trigger set_updated_at
before update on public.player_notebook_pages
for each row execute function public.set_updated_at();

alter table public.player_notebook_pages enable row level security;
alter table public.player_notebook_pages force row level security;

create policy player_notebook_owner_read on public.player_notebook_pages
for select to authenticated
using (
  user_id = auth.uid()
  and public.is_character_owner(character_id)
);

create policy player_notebook_master_read on public.player_notebook_pages
for select to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy player_notebook_owner_insert on public.player_notebook_pages
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_character_owner(character_id)
  and public.is_campaign_member(campaign_id)
);

create policy player_notebook_owner_update on public.player_notebook_pages
for update to authenticated
using (user_id = auth.uid() and public.is_character_owner(character_id))
with check (
  user_id = auth.uid()
  and public.is_character_owner(character_id)
  and public.is_campaign_member(campaign_id)
);

create policy player_notebook_owner_delete on public.player_notebook_pages
for delete to authenticated
using (user_id = auth.uid() and public.is_character_owner(character_id));

grant select, insert, update, delete on public.player_notebook_pages to authenticated, service_role;

create policy player_notebook_master_insert on public.player_notebook_pages
for insert to authenticated
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy player_notebook_master_update on public.player_notebook_pages
for update to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy player_notebook_master_delete on public.player_notebook_pages
for delete to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy investigation_board_items_player_read on public.investigation_board_items
for select to authenticated
using (
  exists (
    select 1 from public.handouts handout
    where handout.id = investigation_board_items.handout_id
      and handout.deleted_at is null
  )
);

create policy investigation_board_connections_player_read on public.investigation_board_connections
for select to authenticated
using (
  exists (
    select 1 from public.handouts source_handout
    where source_handout.id = investigation_board_connections.from_handout_id
      and source_handout.deleted_at is null
  )
  and exists (
    select 1 from public.handouts target_handout
    where target_handout.id = investigation_board_connections.to_handout_id
      and target_handout.deleted_at is null
  )
);

create or replace function public.notify_player_resource_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character_id uuid;
  v_character_name text;
  v_resource text;
  v_operation text;
  v_before integer;
  v_after integer;
  v_maximum integer;
  v_amount integer;
  v_title text;
  v_preview text;
begin
  if new.event_type <> 'resource_mutated' then return new; end if;
  v_operation := new.metadata->>'operation';
  if v_operation not in ('damage','healing') then return new; end if;

  select resource.character_id, character.name, resource.resource
    into v_character_id, v_character_name, v_resource
  from public.character_resources resource
  join public.characters character on character.id = resource.character_id
  where resource.id = new.entity_id;

  if v_character_id is null then return new; end if;
  v_before := coalesce((new.before_data->>'current')::integer, 0);
  v_after := coalesce((new.after_data->>'current')::integer, 0);
  v_maximum := coalesce((new.after_data->>'maximum')::integer, 0);
  v_amount := abs(v_after - v_before);
  if v_amount = 0 then return new; end if;

  if v_operation = 'damage' then
    v_title := format('Você recebeu %s de dano', v_amount);
    v_preview := format('%s: %s agora está em %s/%s.', v_character_name, upper(v_resource), v_after, v_maximum);
  else
    v_title := format('Você foi curado em %s', v_amount);
    v_preview := format('%s: %s agora está em %s/%s.', v_character_name, upper(v_resource), v_after, v_maximum);
  end if;

  insert into public.notifications(
    campaign_id, user_id, character_id, type, title, safe_preview, protected_payload
  )
  select
    new.campaign_id,
    owner.user_id,
    v_character_id,
    case when v_operation = 'damage' then 'character_damaged' else 'character_healed' end,
    v_title,
    v_preview,
    jsonb_build_object(
      'characterId', v_character_id,
      'characterName', v_character_name,
      'resource', v_resource,
      'operation', v_operation,
      'amount', v_amount,
      'previous', v_before,
      'current', v_after,
      'maximum', v_maximum,
      'eventId', new.id
    )
  from public.character_owners owner
  where owner.character_id = v_character_id
    and owner.confirmed_at is not null;

  return new;
end;
$$;

revoke all on function public.notify_player_resource_change() from public;

create trigger notify_player_resource_change
after insert on public.audit_events
for each row
when (new.event_type = 'resource_mutated')
execute function public.notify_player_resource_change();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_notebook_pages'
  ) then
    alter publication supabase_realtime add table public.player_notebook_pages;
  end if;
end $$;

commit;
