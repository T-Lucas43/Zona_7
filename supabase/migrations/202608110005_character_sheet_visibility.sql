create table public.character_sheet_settings (
  character_id uuid primary key references public.characters(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  visible_fields text[] not null default array['portrait','codename','origin','class','path','nex','status','role','defense','attributes','meter','conditions'],
  visible_sections text[] not null default array['resources','skills','combat','abilities','inventory','messages','handouts'],
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);

create index character_sheet_settings_campaign_idx
  on public.character_sheet_settings(campaign_id);

alter table public.character_sheet_settings enable row level security;
alter table public.character_sheet_settings force row level security;

create policy character_sheet_settings_master_manage
on public.character_sheet_settings for all to authenticated
using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy character_sheet_settings_owner_read
on public.character_sheet_settings for select to authenticated
using (public.is_character_owner(character_id));

create or replace function public.ensure_character_sheet_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.character_sheet_settings(character_id,campaign_id,updated_by)
  values(new.id,new.campaign_id,new.updated_by)
  on conflict(character_id) do nothing;
  return new;
end;
$$;

create trigger characters_ensure_sheet_settings
after insert on public.characters
for each row execute function public.ensure_character_sheet_settings();

insert into public.character_sheet_settings(character_id,campaign_id,updated_by)
select id,campaign_id,updated_by from public.characters
on conflict(character_id) do nothing;

create or replace function public.is_character_section_visible(
  p_character_id uuid,
  p_section text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_campaign_role(c.campaign_id, array['campaign_owner','game_master','co_master'])
    or (
      public.is_character_owner(c.id)
      and coalesce(p_section = any(s.visible_sections), false)
    )
  from public.characters c
  left join public.character_sheet_settings s on s.character_id = c.id
  where c.id = p_character_id and c.deleted_at is null
$$;

create or replace function public.is_character_field_visible(
  p_character_id uuid,
  p_field text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_campaign_role(c.campaign_id, array['campaign_owner','game_master','co_master'])
    or (
      public.is_character_owner(c.id)
      and coalesce(p_field = any(s.visible_fields), false)
    )
  from public.characters c
  left join public.character_sheet_settings s on s.character_id = c.id
  where c.id = p_character_id and c.deleted_at is null
$$;

drop policy if exists characters_read_authorized on public.characters;
create policy characters_read_authorized on public.characters
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
);
drop policy if exists characters_owner_narrative_update on public.characters;

drop policy if exists character_data_read on public.character_attributes;
create policy character_data_read on public.character_attributes for select to authenticated
using (
  public.is_character_section_visible(character_id,'attributes')
  or exists (
    select 1 from public.characters c
    where c.id = character_id
      and public.has_campaign_role(c.campaign_id,array['campaign_owner','game_master','co_master'])
  )
);

drop policy if exists character_data_read on public.character_resources;
create policy character_data_read on public.character_resources for select to authenticated
using (public.is_character_section_visible(character_id,'resources'));

drop policy if exists character_data_read on public.character_skills;
create policy character_data_read on public.character_skills for select to authenticated
using (public.is_character_section_visible(character_id,'skills'));

drop policy if exists character_data_read on public.attacks;
create policy character_data_read on public.attacks for select to authenticated
using (public.is_character_section_visible(character_id,'combat'));

drop policy if exists character_data_read on public.character_meter_values;
create policy character_data_read on public.character_meter_values for select to authenticated
using (public.is_character_section_visible(character_id,'meter'));

drop policy if exists character_data_read on public.character_items;
create policy character_data_read on public.character_items for select to authenticated
using (public.is_character_section_visible(character_id,'inventory'));

drop policy if exists character_data_read on public.character_conditions;
create policy character_data_read on public.character_conditions for select to authenticated
using (public.is_character_section_visible(character_id,'conditions'));

drop policy if exists character_attribute_values_owner_read on public.character_attribute_values;
create policy character_attribute_values_owner_read on public.character_attribute_values
for select to authenticated using (public.is_character_section_visible(character_id,'attributes'));

drop policy if exists character_weaknesses_owner_read on public.character_weaknesses;
create policy character_weaknesses_owner_read on public.character_weaknesses
for select to authenticated using (
  public.is_character_section_visible(character_id,'weaknesses')
  and visibility in ('public','campaign','selected','owner_only')
);

drop policy if exists character_meter_history_owner_read on public.character_meter_history;
create policy character_meter_history_owner_read on public.character_meter_history
for select to authenticated using (
  public.is_character_section_visible(character_id,'history')
  and player_visible_reason is not null
);

drop policy if exists character_notes_owner_read on public.character_notes;
create policy character_notes_owner_read on public.character_notes
for select to authenticated using (
  public.is_character_section_visible(character_id,'history')
  and visibility in ('public','campaign','selected','owner_only')
);

drop policy if exists resource_transactions_owner_read on public.resource_transactions;
create policy resource_transactions_owner_read on public.resource_transactions
for select to authenticated using (public.is_character_section_visible(character_id,'resources'));

drop policy if exists character_abilities_read on public.character_abilities;
create policy character_abilities_read on public.character_abilities
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or (
    public.is_character_section_visible(character_id,'abilities')
    and state <> 'sealed'
  )
);

drop policy if exists ability_read_authorized on public.abilities;
create policy ability_read_authorized on public.abilities
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or exists (
    select 1 from public.character_abilities ca
    where ca.ability_id = abilities.id
      and ca.state in ('discovered','unlocked','altered','disabled','masked')
      and public.is_character_section_visible(ca.character_id,'abilities')
  )
);

drop policy if exists items_read_authorized on public.items;
create policy items_read_authorized on public.items
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or exists (
    select 1 from public.character_items ci
    where ci.item_id = items.id
      and public.is_character_section_visible(ci.character_id,'inventory')
  )
);

drop policy if exists meters_read on public.custom_meter_definitions;
create policy meters_read on public.custom_meter_definitions
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or exists (
    select 1 from public.character_meter_values cmv
    where cmv.meter_definition_id = custom_meter_definitions.id
      and public.is_character_section_visible(cmv.character_id,'meter')
  )
);

drop policy if exists condition_definitions_read on public.condition_definitions;
create policy condition_definitions_read on public.condition_definitions
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or exists (
    select 1 from public.character_conditions cc
    where cc.condition_definition_id = condition_definitions.id
      and public.is_character_section_visible(cc.character_id,'conditions')
  )
);

create or replace function public.get_player_character_sheet(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.characters%rowtype;
  s public.character_sheet_settings%rowtype;
  v_result jsonb;
begin
  select * into c
  from public.characters
  where id = p_character_id and is_npc = false and deleted_at is null;

  if c.id is null or not public.is_character_owner(c.id) then
    raise exception 'Ficha não autorizada.';
  end if;

  select * into s from public.character_sheet_settings where character_id = c.id;
  if s.character_id is null then
    s.visible_fields := array[]::text[];
    s.visible_sections := array[]::text[];
  end if;

  v_result := jsonb_build_object(
    'id',c.id,
    'name',c.name,
    'codename',case when 'codename'=any(s.visible_fields) then c.codename end,
    'origin',case when 'origin'=any(s.visible_fields) then c.origin end,
    'class_name',case when 'class'=any(s.visible_fields) then c.class_name end,
    'path_name',case when 'path'=any(s.visible_fields) then c.path_name end,
    'narrative_status',case when 'status'=any(s.visible_fields) then c.narrative_status end,
    'team_role',case when 'role'=any(s.visible_fields) then c.team_role end,
    'nex',case when 'nex'=any(s.visible_fields) then c.nex else 0 end,
    'defense',case when 'defense'=any(s.visible_fields) then c.defense else 0 end,
    'movement',case when 'movement'=any(s.visible_fields) then c.movement else 0 end,
    'main_dc',null,
    'version',c.version,
    'portrait_path',case when 'portrait'=any(s.visible_fields) then c.portrait_path end,
    'character_attributes',case when 'attributes'=any(s.visible_fields) then (
      select to_jsonb(a) - 'character_id' - 'updated_at'
      from public.character_attributes a where a.character_id=c.id
    ) end,
    'character_resources',case when 'resources'=any(s.visible_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource',r.resource,'current_value',r.current_value,'maximum_value',r.maximum_value
      )) from public.character_resources r where r.character_id=c.id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_meter_values',case when 'meter'=any(s.visible_fields) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'current_value',m.current_value,
        'custom_meter_definitions',jsonb_build_object('name',d.name,'stages',d.stages)
      ))
      from public.character_meter_values m
      join public.custom_meter_definitions d on d.id=m.meter_definition_id
      where m.character_id=c.id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_conditions',case when 'conditions'=any(s.visible_fields) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'removed_at',cc.removed_at,
        'condition_definitions',jsonb_build_object('name',cd.name)
      ))
      from public.character_conditions cc
      join public.condition_definitions cd on cd.id=cc.condition_definition_id
      where cc.character_id=c.id and cc.visibility <> 'gm_only'
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_sheet_settings',jsonb_build_object(
      'visible_fields',s.visible_fields,
      'visible_sections',s.visible_sections
    )
  );
  return v_result;
end;
$$;

create or replace function public.update_character_sheet_settings(
  p_campaign_id uuid,
  p_character_id uuid,
  p_visible_fields text[],
  p_visible_sections text[],
  p_actor_user_id uuid
)
returns public.character_sheet_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.character_sheet_settings;
  v_allowed_fields constant text[] := array['portrait','codename','origin','class','path','nex','status','role','defense','movement','attributes','meter','conditions'];
  v_allowed_sections constant text[] := array['resources','skills','combat','abilities','weaknesses','inventory','messages','handouts','history'];
begin
  if auth.uid() is distinct from p_actor_user_id
    or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Apenas o mestre pode definir a visibilidade da ficha.';
  end if;
  if not coalesce(p_visible_fields <@ v_allowed_fields,false)
    or not coalesce(p_visible_sections <@ v_allowed_sections,false) then
    raise exception 'Configuração de ficha inválida.';
  end if;
  if not exists (
    select 1 from public.characters
    where id=p_character_id and campaign_id=p_campaign_id and deleted_at is null
  ) then
    raise exception 'Personagem não encontrado.';
  end if;

  insert into public.character_sheet_settings(
    character_id,campaign_id,visible_fields,visible_sections,updated_by
  ) values (
    p_character_id,p_campaign_id,p_visible_fields,p_visible_sections,p_actor_user_id
  )
  on conflict(character_id) do update set
    visible_fields=excluded.visible_fields,
    visible_sections=excluded.visible_sections,
    updated_by=excluded.updated_by,
    updated_at=now(),
    version=public.character_sheet_settings.version+1
  returning * into v_settings;

  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key
  ) values (
    p_campaign_id,p_actor_user_id,'character',p_character_id,'sheet_visibility_updated','gm_only',
    jsonb_build_object('visibleFields',p_visible_fields,'visibleSections',p_visible_sections),
    gen_random_uuid()
  );
  return v_settings;
end;
$$;

revoke all on function public.get_player_character_sheet(uuid) from public;
revoke all on function public.update_character_sheet_settings(uuid,uuid,text[],text[],uuid) from public;
grant execute on function public.get_player_character_sheet(uuid) to authenticated;
grant execute on function public.update_character_sheet_settings(uuid,uuid,text[],text[],uuid) to authenticated;

alter publication supabase_realtime add table public.character_sheet_settings;
