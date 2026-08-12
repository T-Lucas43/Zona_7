begin;

-- Every table observed by the live UI must belong to the realtime publication.
-- Keeping this list idempotent lets environments created from older snapshots catch up safely.
do $$
declare
  target text;
begin
  foreach target in array array[
    'characters','character_attributes','character_resources','character_items','character_abilities',
    'character_sheet_settings','notifications','message_recipients','handouts','handout_access','items',
    'media_assets','game_scenes','actors','scene_tokens','sessions','session_participants','live_sessions',
    'live_session_events','script_run_events','session_public_state','script_packages','script_versions',
    'roll_requests','dice_rolls','encounters','investigation_board_items',
    'investigation_board_connections','scene_token_connections'
  ] loop
    if to_regclass(format('public.%I', target)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target
      )
    then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;

create table if not exists public.investigation_board_items (
  handout_id uuid primary key references public.handouts(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  x numeric(8,5) not null default 0.08 check (x between 0 and 0.88),
  y numeric(8,5) not null default 0.08 check (y between 0 and 0.78),
  rotation numeric(6,2) not null default 0 check (rotation between -8 and 8),
  z_index integer not null default 1 check (z_index > 0),
  display_style text not null default 'paper' check (display_style in ('polaroid','postit','paper')),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.investigation_board_connections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  from_handout_id uuid not null references public.handouts(id) on delete cascade,
  to_handout_id uuid not null references public.handouts(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (campaign_id,from_handout_id,to_handout_id),
  check (from_handout_id <> to_handout_id)
);

alter table public.scene_tokens add column if not exists z_index integer not null default 1 check (z_index > 0);

create table if not exists public.scene_token_connections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.game_scenes(id) on delete cascade,
  from_token_id uuid not null references public.scene_tokens(id) on delete cascade,
  to_token_id uuid not null references public.scene_tokens(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (scene_id,from_token_id,to_token_id),
  check (from_token_id <> to_token_id)
);

alter table public.investigation_board_items enable row level security;
alter table public.investigation_board_items force row level security;
alter table public.investigation_board_connections enable row level security;
alter table public.investigation_board_connections force row level security;
alter table public.scene_token_connections enable row level security;
alter table public.scene_token_connections force row level security;

create policy investigation_board_items_master on public.investigation_board_items
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy investigation_board_connections_master on public.investigation_board_connections
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy scene_token_connections_master on public.scene_token_connections
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));
create policy scene_token_connections_member_read on public.scene_token_connections
for select to authenticated using (public.is_campaign_member(campaign_id));

grant select,insert,update,delete on public.investigation_board_items to authenticated,service_role;
grant select,insert,update,delete on public.investigation_board_connections to authenticated,service_role;
grant select,insert,update,delete on public.scene_token_connections to authenticated,service_role;

do $$
declare
  target text;
begin
  foreach target in array array['investigation_board_items','investigation_board_connections','scene_token_connections'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=target
    ) then
      execute format('alter publication supabase_realtime add table public.%I',target);
    end if;
  end loop;
end $$;

commit;
