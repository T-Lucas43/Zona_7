begin;

alter table public.roll_requests
  add column if not exists attribute_key text,
  add column if not exists skill_name text,
  add column if not exists favorable_dice integer not null default 0,
  add column if not exists unfavorable_dice integer not null default 0,
  add column if not exists numeric_modifier integer not null default 0,
  add column if not exists method text not null default 'roll'
    check (method in ('roll','take_10','take_20'));

create index if not exists roll_requests_session_checks_idx
  on public.roll_requests(session_id,created_at desc)
  where character_ability_id is null;

create or replace function public.request_character_check(
  p_campaign_id uuid,
  p_session_id uuid,
  p_character_id uuid,
  p_attribute_key text,
  p_skill_name text,
  p_difficulty integer,
  p_context text,
  p_consequences text,
  p_favorable_dice integer,
  p_unfavorable_dice integer,
  p_numeric_modifier integer,
  p_method text,
  p_actor_user_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_request_id uuid; v_owner_user_id uuid; v_character_name text;
begin
  if auth.role()<>'service_role' and (
    auth.uid() is distinct from p_actor_user_id
    or not public.has_campaign_role(p_campaign_id,array['campaign_owner','game_master','co_master'])
  ) then raise exception 'Sem permissão'; end if;
  if p_attribute_key not in ('agi','for','int','pre','vig') then raise exception 'Atributo inválido'; end if;
  if p_method not in ('roll','take_10','take_20') then raise exception 'Método inválido'; end if;
  if p_difficulty<0 or p_difficulty>99 or abs(p_favorable_dice)>20 or abs(p_unfavorable_dice)>20 or abs(p_numeric_modifier)>999 then raise exception 'Modificador inválido'; end if;
  if not exists(select 1 from public.sessions where id=p_session_id and campaign_id=p_campaign_id and status in ('active','paused')) then raise exception 'Sessão indisponível'; end if;
  select name into v_character_name from public.characters where id=p_character_id and campaign_id=p_campaign_id and deleted_at is null;
  if v_character_name is null then raise exception 'Personagem inválido'; end if;
  select id into v_request_id from public.roll_requests where idempotency_key=p_idempotency_key;
  if v_request_id is not null then return v_request_id; end if;
  insert into public.roll_requests(
    campaign_id,session_id,requested_by,character_id,skill_or_attribute,difficulty,context,visibility,
    consequences,status,idempotency_key,attribute_key,skill_name,favorable_dice,unfavorable_dice,numeric_modifier,method
  ) values (
    p_campaign_id,p_session_id,p_actor_user_id,p_character_id,
    upper(p_attribute_key)||case when nullif(trim(p_skill_name),'') is null then '' else ' + '||trim(p_skill_name) end,
    p_difficulty,trim(p_context),'session',jsonb_build_object('failure',trim(p_consequences)),
    'pending',p_idempotency_key,p_attribute_key,nullif(trim(p_skill_name),''),p_favorable_dice,p_unfavorable_dice,p_numeric_modifier,p_method
  ) returning id into v_request_id;
  select owner.user_id into v_owner_user_id from public.character_owners owner
  where owner.character_id=p_character_id and owner.confirmed_at is not null order by owner.created_at limit 1;
  if v_owner_user_id is not null then
    insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
    values(p_campaign_id,v_owner_user_id,p_character_id,'check_requested','Teste solicitado',
      coalesce(nullif(trim(p_skill_name),''),upper(p_attribute_key))||' · DT '||p_difficulty,
      jsonb_build_object('requestId',v_request_id,'characterName',v_character_name,'attribute',p_attribute_key,'skill',p_skill_name,'difficulty',p_difficulty));
  end if;
  return v_request_id;
end;
$$;

create or replace function public.claim_character_check(
  p_request_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request public.roll_requests%rowtype; v_attributes public.character_attributes%rowtype;
  v_character public.characters%rowtype; v_skill_bonus integer:=0; v_attribute integer;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id for update;
  if v_request.id is null or v_request.character_ability_id is not null then raise exception 'Solicitação não encontrada'; end if;
  if auth.role()<>'service_role' and not public.is_character_owner(v_request.character_id) then raise exception 'Sem permissão'; end if;
  if v_request.status<>'pending' or v_request.rolled_at is not null then raise exception 'Este teste não está pendente'; end if;
  select * into v_character from public.characters where id=v_request.character_id;
  if v_character.character_state in ('dying','dead') then raise exception 'O personagem está sem ações neste estado'; end if;
  select * into v_attributes from public.character_attributes where character_id=v_request.character_id;
  v_attribute:=case v_request.attribute_key
    when 'agi' then v_attributes.agility when 'for' then v_attributes.strength when 'int' then v_attributes.intellect
    when 'pre' then v_attributes.presence when 'vig' then v_attributes.vigor else 0 end;
  if v_request.skill_name is not null then
    select coalesce(bonus,0)+coalesce(temporary_bonus,0) into v_skill_bonus
    from public.character_skills where character_id=v_request.character_id and lower(name)=lower(v_request.skill_name) and deleted_at is null limit 1;
  end if;
  return jsonb_build_object(
    'campaignId',v_request.campaign_id,'sessionId',v_request.session_id,'characterId',v_request.character_id,
    'characterName',v_character.name,'attribute',coalesce(v_attribute,0),'skillBonus',coalesce(v_skill_bonus,0),
    'favorableDice',v_request.favorable_dice,'unfavorableDice',v_request.unfavorable_dice,
    'numericModifier',v_request.numeric_modifier,'difficulty',coalesce(v_request.difficulty,0),'method',v_request.method,
    'purpose',v_request.context
  );
end;
$$;

create or replace function public.complete_character_check(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_formula text,
  p_rolls integer[],
  p_kept_indexes integer[],
  p_modifier integer,
  p_total integer,
  p_success boolean,
  p_natural_twenty boolean,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_request public.roll_requests%rowtype; v_roll_id uuid; v_calculated integer:=p_modifier; v_index integer; v_player_name text; v_character_name text;
begin
  if auth.role()<>'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into v_request from public.roll_requests where id=p_request_id for update;
  if v_request.id is null or v_request.character_ability_id is not null then raise exception 'Solicitação não encontrada'; end if;
  if auth.role()<>'service_role' and not public.is_character_owner(v_request.character_id) then raise exception 'Sem permissão'; end if;
  if v_request.rolled_at is not null then
    select id into v_roll_id from public.dice_rolls where roll_request_id=v_request.id order by created_at desc limit 1;
    return jsonb_build_object('id',v_roll_id,'duplicate',true);
  end if;
  foreach v_index in array p_kept_indexes loop
    if v_index<0 or v_index>=array_length(p_rolls,1) then raise exception 'Índice de dado inválido'; end if;
    v_calculated:=v_calculated+p_rolls[v_index+1];
  end loop;
  if v_calculated<>p_total then raise exception 'Total da rolagem divergente'; end if;
  select display_name into v_player_name from public.profiles where id=p_actor_user_id;
  select name into v_character_name from public.characters where id=v_request.character_id;
  insert into public.dice_rolls(campaign_id,session_id,roll_request_id,character_id,user_id,roller_display_name,formula,rolls,kept_indexes,modifier,total,purpose,visibility)
  values(v_request.campaign_id,v_request.session_id,v_request.id,v_request.character_id,p_actor_user_id,coalesce(v_player_name,'Jogador'),p_formula,p_rolls,p_kept_indexes,p_modifier,p_total,v_request.context,'session')
  returning id into v_roll_id;
  update public.roll_requests set status='answered',answered_at=now(),rolled_at=now(),decision=case when p_success then 'approved' else 'rejected' end where id=v_request.id;
  insert into public.notifications(campaign_id,user_id,character_id,type,title,safe_preview,protected_payload)
  select v_request.campaign_id,member.user_id,v_request.character_id,'check_roll','Resultado público de teste',
    coalesce(v_player_name,'Jogador')||' ('||coalesce(v_character_name,'Personagem')||') rolou '||p_total,
    jsonb_build_object('requestId',v_request.id,'rollId',v_roll_id,'playerName',coalesce(v_player_name,'Jogador'),'characterName',v_character_name,'total',p_total,'success',p_success,'natural20',p_natural_twenty)
  from public.campaign_members member where member.campaign_id=v_request.campaign_id and member.status='active';
  return jsonb_build_object('id',v_roll_id,'duplicate',false);
end;
$$;

revoke all on function public.request_character_check(uuid,uuid,uuid,text,text,integer,text,text,integer,integer,integer,text,uuid,uuid) from public;
revoke all on function public.claim_character_check(uuid,uuid) from public;
revoke all on function public.complete_character_check(uuid,uuid,text,integer[],integer[],integer,integer,boolean,boolean,uuid) from public,authenticated;
grant execute on function public.request_character_check(uuid,uuid,uuid,text,text,integer,text,text,integer,integer,integer,text,uuid,uuid) to authenticated,service_role;
grant execute on function public.claim_character_check(uuid,uuid) to authenticated,service_role;
grant execute on function public.complete_character_check(uuid,uuid,text,integer[],integer[],integer,integer,boolean,boolean,uuid) to service_role;

commit;
