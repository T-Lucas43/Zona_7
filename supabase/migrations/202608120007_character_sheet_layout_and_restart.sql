begin;

-- PostgreSQL does not implement min(uuid). The previous trigger used it while
-- notifying players when a restarted session became active again.
create or replace function public.notify_session_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or old.status = 'active' then return new; end if;
  insert into public.notifications(
    campaign_id,user_id,character_id,type,title,safe_preview,protected_payload
  )
  select
    new.campaign_id,member.user_id,
    (
      select owner.character_id
      from public.character_owners owner
      where owner.campaign_id = new.campaign_id
        and owner.user_id = member.user_id
        and owner.confirmed_at is not null
      order by owner.id
      limit 1
    ),
    'session_started','Sessão iniciada',new.title || ' está ao vivo.',
    jsonb_build_object('sessionId',new.id)
  from public.campaign_members member
  where member.campaign_id = new.campaign_id and member.role = 'player' and member.status = 'active';
  return new;
end;
$$;

-- One audited, optimistic-concurrency operation updates every editable field
-- in the operational identity block, including base attributes and saves.
create or replace function public.update_character_profile(
  p_character_id uuid,
  p_expected_version integer,
  p_name text,
  p_codename text,
  p_pronouns text,
  p_origin text,
  p_class_name text,
  p_path_name text,
  p_nex integer,
  p_narrative_status text,
  p_team_role text,
  p_affinities text[],
  p_short_description text,
  p_tagline text,
  p_public_history text,
  p_character_state text,
  p_identification_color text,
  p_defense integer,
  p_block_value integer,
  p_dodge_value integer,
  p_movement numeric,
  p_main_dc integer,
  p_pe_per_turn integer,
  p_agility integer,
  p_strength integer,
  p_intellect integer,
  p_presence integer,
  p_vigor integer,
  p_fortitude integer,
  p_reflexes integer,
  p_willpower integer,
  p_reason text,
  p_actor_user_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character public.characters%rowtype;
  v_event uuid;
  v_version integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Ator inválido';
  end if;
  select id into v_event from public.audit_events where idempotency_key = p_idempotency_key;
  if v_event is not null then
    return jsonb_build_object('eventId',v_event,'duplicate',true);
  end if;
  select * into v_character
  from public.characters
  where id = p_character_id and deleted_at is null
  for update;
  if v_character.id is null then raise exception 'Personagem não encontrado'; end if;
  if auth.role() <> 'service_role'
    and not public.has_campaign_role(v_character.campaign_id,array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão';
  end if;
  if v_character.version <> p_expected_version then
    raise exception 'A ficha foi alterada em outro dispositivo';
  end if;
  if char_length(trim(p_name)) < 2
    or p_nex not between 0 and 100
    or least(p_defense,p_block_value,p_dodge_value,p_movement,p_main_dc,p_pe_per_turn,
      p_agility,p_strength,p_intellect,p_presence,p_vigor,p_fortitude,p_reflexes,p_willpower) < 0
    or p_identification_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Valores inválidos';
  end if;

  update public.characters set
    name=trim(p_name),
    codename=nullif(trim(p_codename),''),
    pronouns=nullif(trim(p_pronouns),''),
    origin=nullif(trim(p_origin),''),
    class_name=nullif(trim(p_class_name),''),
    path_name=nullif(trim(p_path_name),''),
    nex=p_nex,
    narrative_status=nullif(trim(p_narrative_status),''),
    team_role=nullif(trim(p_team_role),''),
    affinities=coalesce(p_affinities,'{}'::text[]),
    short_description=nullif(trim(p_short_description),''),
    tagline=nullif(trim(p_tagline),''),
    public_history=nullif(trim(p_public_history),''),
    character_state=coalesce(nullif(trim(p_character_state),''),'active'),
    identification_color=p_identification_color,
    defense=p_defense,
    block_value=p_block_value,
    dodge_value=p_dodge_value,
    movement=p_movement,
    main_dc=p_main_dc,
    pe_per_turn=p_pe_per_turn,
    version=version+1,
    updated_by=p_actor_user_id,
    updated_at=now()
  where id=p_character_id
  returning version into v_version;

  insert into public.character_attributes(
    character_id,agility,strength,intellect,presence,vigor,fortitude,reflexes,willpower,updated_at
  ) values (
    p_character_id,p_agility,p_strength,p_intellect,p_presence,p_vigor,p_fortitude,p_reflexes,p_willpower,now()
  ) on conflict(character_id) do update set
    agility=excluded.agility,
    strength=excluded.strength,
    intellect=excluded.intellect,
    presence=excluded.presence,
    vigor=excluded.vigor,
    fortitude=excluded.fortitude,
    reflexes=excluded.reflexes,
    willpower=excluded.willpower,
    updated_at=now();

  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,
    before_data,after_data,metadata,idempotency_key
  ) values (
    v_character.campaign_id,p_actor_user_id,'character',p_character_id,
    'character_profile_updated','owner_only',
    to_jsonb(v_character)-'player_private_history'-'portrait_path',
    jsonb_build_object(
      'name',p_name,'codename',p_codename,'pronouns',p_pronouns,'origin',p_origin,
      'className',p_class_name,'pathName',p_path_name,'nex',p_nex,
      'status',p_narrative_status,'teamRole',p_team_role,'affinities',p_affinities,
      'shortDescription',p_short_description,'tagline',p_tagline,
      'publicHistory',p_public_history,'characterState',p_character_state,
      'identificationColor',p_identification_color,'defense',p_defense,
      'blockValue',p_block_value,'dodgeValue',p_dodge_value,'movement',p_movement,
      'mainDc',p_main_dc,'pePerTurn',p_pe_per_turn,
      'attributes',jsonb_build_object(
        'agility',p_agility,'strength',p_strength,'intellect',p_intellect,
        'presence',p_presence,'vigor',p_vigor,'fortitude',p_fortitude,
        'reflexes',p_reflexes,'willpower',p_willpower
      ),
      'version',v_version
    ),
    jsonb_build_object('reason',p_reason),p_idempotency_key
  ) returning id into v_event;
  return jsonb_build_object('eventId',v_event,'version',v_version,'duplicate',false);
end;
$$;

revoke all on function public.update_character_profile(
  uuid,integer,text,text,text,text,text,text,integer,text,text,text[],text,text,text,text,text,
  integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer,
  integer,integer,integer,text,uuid,uuid
) from public;
grant execute on function public.update_character_profile(
  uuid,integer,text,text,text,text,text,text,integer,text,text,text[],text,text,text,text,text,
  integer,integer,integer,numeric,integer,integer,integer,integer,integer,integer,integer,
  integer,integer,integer,text,uuid,uuid
) to authenticated, service_role;

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
begin
  select * into c from public.characters
  where id=p_character_id and is_npc=false and deleted_at is null;
  if c.id is null or not public.is_character_owner(c.id) then
    raise exception 'Ficha não autorizada.';
  end if;
  select * into s from public.character_sheet_settings where character_id=c.id;
  if s.character_id is null then
    s.visible_fields:=array[]::text[];
    s.visible_sections:=array[]::text[];
  end if;

  return jsonb_build_object(
    'id',c.id,
    'name',c.name,
    'codename',case when 'codename'=any(s.visible_fields) then c.codename end,
    'pronouns',case when 'pronouns'=any(s.visible_fields) then c.pronouns end,
    'origin',case when 'origin'=any(s.visible_fields) then c.origin end,
    'class_name',case when 'class'=any(s.visible_fields) then c.class_name end,
    'path_name',case when 'path'=any(s.visible_fields) then c.path_name end,
    'narrative_status',case when 'status'=any(s.visible_fields) then c.narrative_status end,
    'team_role',case when 'role'=any(s.visible_fields) then c.team_role end,
    'affinities',case when 'affinities'=any(s.visible_fields) then c.affinities else '{}'::text[] end,
    'short_description',case when 'description'=any(s.visible_fields) then c.short_description end,
    'tagline',case when 'tagline'=any(s.visible_fields) then c.tagline end,
    'public_history',case when 'public_history'=any(s.visible_fields) then c.public_history end,
    'character_state',case when 'status'=any(s.visible_fields) then c.character_state else 'active' end,
    'identification_color',c.identification_color,
    'nex',case when 'nex'=any(s.visible_fields) then c.nex else 0 end,
    'defense',case when 'defense'=any(s.visible_fields) then c.defense else 0 end,
    'block_value',case when 'block'=any(s.visible_fields) then c.block_value else 0 end,
    'dodge_value',case when 'dodge'=any(s.visible_fields) then c.dodge_value else 0 end,
    'movement',case when 'movement'=any(s.visible_fields) then c.movement else 0 end,
    'main_dc',case when 'main_dc'=any(s.visible_fields) then c.main_dc else 0 end,
    'pe_per_turn',case when 'pe_per_turn'=any(s.visible_fields) then c.pe_per_turn else 0 end,
    'version',c.version,
    'portrait_path',case when 'portrait'=any(s.visible_fields) then c.portrait_path end,
    'character_attributes',(
      select jsonb_build_object(
        'agility',case when 'attributes'=any(s.visible_fields) then a.agility else 0 end,
        'strength',case when 'attributes'=any(s.visible_fields) then a.strength else 0 end,
        'intellect',case when 'attributes'=any(s.visible_fields) then a.intellect else 0 end,
        'presence',case when 'attributes'=any(s.visible_fields) then a.presence else 0 end,
        'vigor',case when 'attributes'=any(s.visible_fields) then a.vigor else 0 end,
        'fortitude',case when 'resistances'=any(s.visible_fields) then a.fortitude else 0 end,
        'reflexes',case when 'resistances'=any(s.visible_fields) then a.reflexes else 0 end,
        'willpower',case when 'resistances'=any(s.visible_fields) then a.willpower else 0 end
      ) from public.character_attributes a where a.character_id=c.id
    ),
    'character_resources',case when 'resources'=any(s.visible_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'resource',r.resource,'current_value',r.current_value,'maximum_value',r.maximum_value
      )) from public.character_resources r where r.character_id=c.id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_meter_values',case when 'meter'=any(s.visible_fields) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'current_value',m.current_value,
        'custom_meter_definitions',jsonb_build_object('name',d.name,'stages',d.stages)
      )) from public.character_meter_values m
      join public.custom_meter_definitions d on d.id=m.meter_definition_id
      where m.character_id=c.id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_conditions',case when 'conditions'=any(s.visible_fields) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'removed_at',cc.removed_at,
        'condition_definitions',jsonb_build_object('name',cd.name)
      )) from public.character_conditions cc
      join public.condition_definitions cd on cd.id=cc.condition_definition_id
      where cc.character_id=c.id and cc.visibility <> 'gm_only'
    ),'[]'::jsonb) else '[]'::jsonb end,
    'character_sheet_settings',jsonb_build_object(
      'visible_fields',s.visible_fields,'visible_sections',s.visible_sections
    )
  );
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
  v_allowed_fields constant text[] := array[
    'portrait','codename','pronouns','origin','class','path','nex','status','role',
    'affinities','description','tagline','public_history','defense','block','dodge',
    'movement','main_dc','pe_per_turn','attributes','resistances','meter','conditions'
  ];
  v_allowed_sections constant text[] := array[
    'resources','skills','combat','abilities','weaknesses','inventory','messages','handouts','history'
  ];
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
  ) then raise exception 'Personagem não encontrado.'; end if;

  insert into public.character_sheet_settings(
    character_id,campaign_id,visible_fields,visible_sections,updated_by
  ) values (p_character_id,p_campaign_id,p_visible_fields,p_visible_sections,p_actor_user_id)
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
    jsonb_build_object('visibleFields',p_visible_fields,'visibleSections',p_visible_sections),gen_random_uuid()
  );
  return v_settings;
end;
$$;

revoke all on function public.get_player_character_sheet(uuid) from public;
revoke all on function public.update_character_sheet_settings(uuid,uuid,text[],text[],uuid) from public;
grant execute on function public.get_player_character_sheet(uuid) to authenticated;
grant execute on function public.update_character_sheet_settings(uuid,uuid,text[],text[],uuid) to authenticated;

commit;
