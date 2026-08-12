begin;

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.messages%rowtype;
begin
  select * into v_message from public.messages where id = new.message_id;
  insert into public.notifications(
    campaign_id,user_id,type,title,safe_preview,protected_payload
  ) values (
    new.campaign_id,new.user_id,'message_received',
    'Mensagem de ' || v_message.apparent_sender_name,
    'Uma nova mensagem protegida chegou ao seu terminal.',
    jsonb_build_object('messageId',new.message_id)
  );
  return new;
end;
$$;

drop trigger if exists notify_message_recipient_after_insert on public.message_recipients;
create trigger notify_message_recipient_after_insert
after insert on public.message_recipients
for each row execute function public.notify_message_recipient();

create or replace function public.notify_character_ability_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.state is not distinct from old.state then return new; end if;
  select name into v_name from public.abilities where id = new.ability_id;
  insert into public.notifications(
    campaign_id,user_id,character_id,type,title,safe_preview,protected_payload
  )
  select
    new.campaign_id,owner.user_id,new.character_id,'ability_state_changed',
    case when new.state = 'unlocked' then 'Habilidade liberada: ' else 'Habilidade atualizada: ' end || coalesce(v_name,'Habilidade'),
    case when new.state = 'unlocked' then 'O mestre liberou uma nova habilidade na sua ficha.' else 'O estado de uma habilidade da sua ficha mudou.' end,
    jsonb_build_object('characterAbilityId',new.id,'state',new.state)
  from public.character_owners owner
  where owner.character_id = new.character_id and owner.confirmed_at is not null;
  return new;
end;
$$;

drop trigger if exists notify_character_ability_state_after_update on public.character_abilities;
create trigger notify_character_ability_state_after_update
after update of state on public.character_abilities
for each row execute function public.notify_character_ability_state();

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
    (select min(owner.character_id) from public.character_owners owner where owner.campaign_id = new.campaign_id and owner.user_id = member.user_id and owner.confirmed_at is not null),
    'session_started','Sessão iniciada',new.title || ' está ao vivo.',
    jsonb_build_object('sessionId',new.id)
  from public.campaign_members member
  where member.campaign_id = new.campaign_id and member.role = 'player' and member.status = 'active';
  return new;
end;
$$;

drop trigger if exists notify_session_started_after_update on public.sessions;
create trigger notify_session_started_after_update
after update of status on public.sessions
for each row execute function public.notify_session_started();

commit;
