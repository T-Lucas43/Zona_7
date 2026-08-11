begin;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.platform_admin from public.profiles p where p.id = auth.uid() and p.deleted_at is null), false)
$$;

create or replace function public.is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = target_campaign_id and cm.user_id = auth.uid() and cm.status = 'active'
  )
$$;

create or replace function public.has_campaign_role(target_campaign_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and cm.role = any(allowed_roles)
  )
$$;

create or replace function public.is_character_owner(target_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.character_owners co
    where co.character_id = target_character_id and co.user_id = auth.uid() and co.confirmed_at is not null
  )
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.has_campaign_role(uuid, text[]) to authenticated;
grant execute on function public.is_character_owner(uuid) to authenticated;

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles','user_preferences','rule_profiles','campaigns','campaign_secrets','campaign_members','campaign_permissions',
    'invitations','campaign_rule_settings','character_templates','characters','character_secrets','character_owners',
    'character_attributes','character_resources','character_skills','attacks','abilities','ability_secrets','character_abilities',
    'custom_meter_definitions','character_meter_values','items','item_secrets','character_items','condition_definitions',
    'character_conditions','sessions','session_scenes','session_participants','encounters','encounter_combatants',
    'roll_requests','dice_rolls','messages','message_sender_profiles','message_sender_secrets','message_contents','message_recipients',
    'message_responses','scheduled_events','handouts','handout_contents','handout_access','resource_threshold_rules',
    'resource_threshold_states','notifications','audit_events','threat_templates','campaign_custom_fields','campaign_ui_settings'
  ] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

create policy preferences_own on public.user_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy rule_profiles_read on public.rule_profiles
for select to authenticated using (true);

create policy campaigns_read_member on public.campaigns
for select to authenticated using (public.is_campaign_member(id));
create policy campaigns_create_owner on public.campaigns
for insert to authenticated with check (owner_user_id = auth.uid());
create policy campaigns_update_master on public.campaigns
for update to authenticated using (public.has_campaign_role(id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(id, array['campaign_owner','game_master']));

create policy campaign_members_read on public.campaign_members
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy campaign_members_manage on public.campaign_members
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));

create policy campaign_permissions_read on public.campaign_permissions
for select to authenticated using (
  exists (select 1 from public.campaign_members cm where cm.id = campaign_member_id and public.is_campaign_member(cm.campaign_id))
);
create policy campaign_permissions_manage on public.campaign_permissions
for all to authenticated using (
  exists (select 1 from public.campaign_members cm where cm.id = campaign_member_id and public.has_campaign_role(cm.campaign_id, array['campaign_owner','game_master']))
) with check (
  exists (select 1 from public.campaign_members cm where cm.id = campaign_member_id and public.has_campaign_role(cm.campaign_id, array['campaign_owner','game_master']))
);

create policy campaign_secrets_master on public.campaign_secrets
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy invitations_master on public.invitations
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));
create policy invitations_recipient_read on public.invitations
for select to authenticated using (lower(email::text) = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'pending');

create policy campaign_rules_read on public.campaign_rule_settings
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy campaign_rules_manage on public.campaign_rule_settings
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));

create policy character_templates_master on public.character_templates
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy characters_read_authorized on public.characters
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or public.is_character_owner(id)
  or (visibility = 'public' and public.is_campaign_member(campaign_id))
);
create policy characters_manage_master on public.characters
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy characters_owner_narrative_update on public.characters
for update to authenticated using (public.is_character_owner(id)) with check (public.is_character_owner(id));

create policy character_secrets_master on public.character_secrets
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy character_owners_read on public.character_owners
for select to authenticated using (user_id = auth.uid() or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy character_owners_manage on public.character_owners
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));

do $$
declare
  target text;
begin
  foreach target in array array['character_attributes','character_resources','character_skills','attacks','character_meter_values','character_items','character_conditions'] loop
    if target = 'character_attributes' then
      execute 'create policy character_data_read on public.character_attributes for select to authenticated using (public.is_character_owner(character_id) or exists (select 1 from public.characters c where c.id = character_id and public.has_campaign_role(c.campaign_id, array[''campaign_owner'',''game_master'',''co_master''])))';
      execute 'create policy character_data_master_write on public.character_attributes for all to authenticated using (exists (select 1 from public.characters c where c.id = character_id and public.has_campaign_role(c.campaign_id, array[''campaign_owner'',''game_master'',''co_master'']))) with check (exists (select 1 from public.characters c where c.id = character_id and public.has_campaign_role(c.campaign_id, array[''campaign_owner'',''game_master'',''co_master''])))';
    else
      execute format(
        'create policy character_data_read on public.%I for select to authenticated using (public.is_character_owner(character_id) or public.has_campaign_role(campaign_id, array[''campaign_owner'',''game_master'',''co_master'']))',
        target
      );
      execute format(
        'create policy character_data_master_write on public.%I for all to authenticated using (public.has_campaign_role(campaign_id, array[''campaign_owner'',''game_master'',''co_master''])) with check (public.has_campaign_role(campaign_id, array[''campaign_owner'',''game_master'',''co_master'']))',
        target
      );
    end if;
  end loop;
end $$;

create policy ability_read_authorized on public.abilities
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or exists (
    select 1 from public.character_abilities ca
    where ca.ability_id = abilities.id and ca.state in ('discovered','unlocked','altered','disabled') and public.is_character_owner(ca.character_id)
  )
);
create policy ability_master_write on public.abilities
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy ability_secrets_master on public.ability_secrets
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy character_abilities_read on public.character_abilities
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (public.is_character_owner(character_id) and state <> 'sealed')
);
create policy character_abilities_master_write on public.character_abilities
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy meters_read on public.custom_meter_definitions
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy meters_manage on public.custom_meter_definitions
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy items_read_authorized on public.items
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (visibility in ('public','campaign') and public.is_campaign_member(campaign_id))
  or exists (select 1 from public.character_items ci where ci.item_id = items.id and public.is_character_owner(ci.character_id))
);
create policy items_master_write on public.items
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy item_secrets_master on public.item_secrets
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy condition_definitions_read on public.condition_definitions
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy condition_definitions_manage on public.condition_definitions
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy sessions_read on public.sessions
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy sessions_manage on public.sessions
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy session_scenes_master on public.session_scenes
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy session_participants_read on public.session_participants
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy session_participants_self_update on public.session_participants
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_participants_master on public.session_participants
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy encounters_master on public.encounters
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy combatants_master on public.encounter_combatants
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy roll_requests_read on public.roll_requests
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (character_id is not null and public.is_character_owner(character_id))
);
create policy roll_requests_manage on public.roll_requests
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy dice_rolls_read on public.dice_rolls
for select to authenticated using (
  user_id = auth.uid()
  or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (visibility = 'session' and public.is_campaign_member(campaign_id))
);
create policy dice_rolls_create on public.dice_rolls
for insert to authenticated with check (
  user_id = auth.uid()
  and (campaign_id is null or public.is_campaign_member(campaign_id))
  and (character_id is null or public.is_character_owner(character_id) or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
);

create policy messages_read_recipient on public.messages
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or exists (select 1 from public.message_recipients mr where mr.message_id = messages.id and mr.user_id = auth.uid())
);
create policy messages_master_write on public.messages
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy sender_profiles_read on public.message_sender_profiles
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy sender_profiles_manage on public.message_sender_profiles
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy message_sender_secrets_master on public.message_sender_secrets
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy message_contents_read on public.message_contents
for select to authenticated using (
  exists (
    select 1 from public.messages m
    where m.id = message_id and (
      public.has_campaign_role(m.campaign_id, array['campaign_owner','game_master','co_master'])
      or exists (select 1 from public.message_recipients mr where mr.message_id = m.id and mr.user_id = auth.uid())
    )
  )
);
create policy message_contents_master_write on public.message_contents
for all to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and public.has_campaign_role(m.campaign_id, array['campaign_owner','game_master','co_master']))
) with check (
  exists (select 1 from public.messages m where m.id = message_id and public.has_campaign_role(m.campaign_id, array['campaign_owner','game_master','co_master']))
);
create policy recipients_read on public.message_recipients
for select to authenticated using (user_id = auth.uid() or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy recipients_self_update on public.message_recipients
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recipients_master on public.message_recipients
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy responses_read on public.message_responses
for select to authenticated using (user_id = auth.uid() or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy responses_create on public.message_responses
for insert to authenticated with check (user_id = auth.uid());

create policy scheduled_events_master on public.scheduled_events
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy handouts_read_metadata on public.handouts
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (visibility in ('public','campaign') and public.is_campaign_member(campaign_id))
  or exists (
    select 1 from public.handout_access ha
    where ha.handout_id = handouts.id and (
      ha.user_id = auth.uid() or (ha.character_id is not null and public.is_character_owner(ha.character_id))
    )
  )
);
create policy handouts_master_write on public.handouts
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy handout_contents_read on public.handout_contents
for select to authenticated using (
  exists (
    select 1 from public.handouts h
    where h.id = handout_id and (
      public.has_campaign_role(h.campaign_id, array['campaign_owner','game_master','co_master'])
      or (h.visibility in ('public','campaign') and public.is_campaign_member(h.campaign_id))
      or exists (select 1 from public.handout_access ha where ha.handout_id = h.id and (ha.user_id = auth.uid() or public.is_character_owner(ha.character_id)))
    )
  )
);
create policy handout_contents_master_write on public.handout_contents
for all to authenticated using (
  exists (select 1 from public.handouts h where h.id = handout_id and public.has_campaign_role(h.campaign_id, array['campaign_owner','game_master','co_master']))
) with check (
  exists (select 1 from public.handouts h where h.id = handout_id and public.has_campaign_role(h.campaign_id, array['campaign_owner','game_master','co_master']))
);
create policy handout_access_read on public.handout_access
for select to authenticated using (user_id = auth.uid() or public.is_character_owner(character_id) or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy handout_access_master on public.handout_access
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy threshold_rules_read on public.resource_threshold_rules
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy threshold_rules_manage on public.resource_threshold_rules
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));
create policy threshold_states_read on public.resource_threshold_states
for select to authenticated using (public.is_character_owner(character_id) or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));
create policy threshold_states_master on public.resource_threshold_states
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy notifications_own_read on public.notifications
for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_master_read on public.notifications
for select to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy audit_master_read on public.audit_events
for select to authenticated using (campaign_id is not null and public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy threats_master on public.threat_templates
for all to authenticated using (campaign_id is null or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']))
with check (campaign_id is null or public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master']));

create policy custom_fields_read on public.campaign_custom_fields
for select to authenticated using (
  public.has_campaign_role(campaign_id, array['campaign_owner','game_master','co_master'])
  or (visibility <> 'gm_only' and public.is_campaign_member(campaign_id))
);
create policy custom_fields_manage on public.campaign_custom_fields
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));
create policy campaign_ui_read on public.campaign_ui_settings
for select to authenticated using (public.is_campaign_member(campaign_id));
create policy campaign_ui_manage on public.campaign_ui_settings
for all to authenticated using (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']))
with check (public.has_campaign_role(campaign_id, array['campaign_owner','game_master']));

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record public.invitations%rowtype;
begin
  select * into invitation_record
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and status = 'pending'
    and expires_at > now()
  for update;

  if invitation_record.id is null then raise exception 'Convite inválido ou expirado'; end if;
  if lower(invitation_record.email::text) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Este convite pertence a outra conta';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role, status, joined_at)
  values (invitation_record.campaign_id, auth.uid(), invitation_record.role, 'active', now())
  on conflict (campaign_id, user_id) do update set role = excluded.role, status = 'active', joined_at = coalesce(public.campaign_members.joined_at, now());

  update public.invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now() where id = invitation_record.id;
  insert into public.audit_events (campaign_id, actor_user_id, entity_type, entity_id, event_type, visibility, after_data)
  values (invitation_record.campaign_id, auth.uid(), 'invitation', invitation_record.id, 'invitation_accepted', 'gm_only', jsonb_build_object('role', invitation_record.role));
  return invitation_record.campaign_id;
end;
$$;

create or replace function public.mutate_character_resource(
  p_character_id uuid,
  p_resource text,
  p_delta integer,
  p_operation text,
  p_source text,
  p_reason text,
  p_actor_user_id uuid,
  p_session_id uuid default null,
  p_encounter_id uuid default null,
  p_visibility text default 'campaign',
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resource_record public.character_resources%rowtype;
  character_record public.characters%rowtype;
  existing_event_id uuid;
  next_value integer;
  event_id uuid;
  rule_record public.resource_threshold_rules%rowtype;
  threshold_state public.resource_threshold_states%rowtype;
  threshold_value numeric;
  crossed_labels text[] := array[]::text[];
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if p_resource not in ('pv','pe','san') then raise exception 'Recurso inválido'; end if;
  if p_operation not in ('damage','healing','loss','recovery','spend','set','transfer') then raise exception 'Operação inválida'; end if;
  if char_length(trim(p_reason)) < 2 then raise exception 'Justificativa obrigatória'; end if;

  select id into existing_event_id from public.audit_events where idempotency_key = p_idempotency_key;
  if existing_event_id is not null then return jsonb_build_object('eventId', existing_event_id, 'duplicate', true); end if;

  select * into character_record from public.characters where id = p_character_id and deleted_at is null;
  if character_record.id is null then raise exception 'Personagem não encontrado'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(character_record.campaign_id, array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão para alterar recursos';
  end if;

  select * into resource_record from public.character_resources
  where character_id = p_character_id and resource = p_resource for update;
  if resource_record.id is null then raise exception 'Recurso não encontrado'; end if;

  next_value := greatest(0, resource_record.current_value + p_delta);
  if not resource_record.allow_overflow then next_value := least(resource_record.maximum_value, next_value); end if;

  update public.character_resources
  set current_value = next_value, version = version + 1, updated_at = now()
  where id = resource_record.id;
  update public.characters set version = version + 1, updated_at = now() where id = p_character_id;

  insert into public.audit_events (
    campaign_id, session_id, encounter_id, actor_user_id, entity_type, entity_id, event_type,
    visibility, before_data, after_data, metadata, idempotency_key
  ) values (
    character_record.campaign_id, p_session_id, p_encounter_id, p_actor_user_id, 'character_resource', resource_record.id,
    'resource_mutated', p_visibility,
    jsonb_build_object('resource', p_resource, 'current', resource_record.current_value, 'maximum', resource_record.maximum_value),
    jsonb_build_object('resource', p_resource, 'current', next_value, 'maximum', resource_record.maximum_value),
    jsonb_build_object('delta', next_value - resource_record.current_value, 'operation', p_operation, 'source', p_source, 'reason', p_reason),
    p_idempotency_key
  ) returning id into event_id;

  for rule_record in
    select * from public.resource_threshold_rules
    where campaign_id = character_record.campaign_id and resource = p_resource and enabled
    order by percent desc
  loop
    threshold_value := resource_record.maximum_value * rule_record.percent / 100.0;
    insert into public.resource_threshold_states (campaign_id, character_id, rule_id, armed)
    values (character_record.campaign_id, p_character_id, rule_record.id, true)
    on conflict (character_id, rule_id) do nothing;
    select * into threshold_state from public.resource_threshold_states
      where character_id = p_character_id and rule_id = rule_record.id for update;

    if next_value > threshold_value then
      update public.resource_threshold_states set armed = true, acknowledged_at = null, acknowledged_by = null
      where id = threshold_state.id;
    elsif threshold_state.armed and resource_record.current_value > threshold_value and next_value <= threshold_value then
      crossed_labels := array_append(crossed_labels, rule_record.label);
      update public.resource_threshold_states set armed = false, last_crossed_at = now(), acknowledged_at = null, acknowledged_by = null
      where id = threshold_state.id;

      insert into public.audit_events (campaign_id, session_id, actor_user_id, entity_type, entity_id, event_type, visibility, after_data, metadata)
      values (character_record.campaign_id, p_session_id, p_actor_user_id, 'character', p_character_id, 'resource_threshold_crossed', 'campaign',
        jsonb_build_object('resource', p_resource, 'value', next_value, 'label', rule_record.label),
        jsonb_build_object('resourceEventId', event_id, 'ruleId', rule_record.id, 'severity', rule_record.severity));

      insert into public.notifications (campaign_id, user_id, character_id, type, title, safe_preview, protected_payload)
      select character_record.campaign_id, recipient.user_id, p_character_id, 'resource_threshold_crossed',
        case when rule_record.severity = 'zero' then 'Recurso chegou a zero' else 'Limite de recurso cruzado' end,
        'Alerta de recurso da Zona 7',
        jsonb_build_object('characterId', p_character_id, 'characterName', character_record.name, 'resource', p_resource, 'value', next_value, 'threshold', rule_record.label)
      from (
        select co.user_id from public.character_owners co where co.character_id = p_character_id and co.confirmed_at is not null
        union
        select cm.user_id from public.campaign_members cm where cm.campaign_id = character_record.campaign_id and cm.status = 'active' and cm.role in ('campaign_owner','game_master','co_master')
      ) recipient;
    end if;
  end loop;

  return jsonb_build_object(
    'eventId', event_id, 'duplicate', false, 'characterId', p_character_id, 'resource', p_resource,
    'previous', resource_record.current_value, 'current', next_value, 'delta', next_value - resource_record.current_value,
    'thresholds', to_jsonb(crossed_labels)
  );
end;
$$;

create or replace function public.unlock_ability(
  p_character_ability_id uuid,
  p_actor_user_id uuid,
  p_state text default 'unlocked',
  p_reason text default 'Liberação narrativa',
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.character_abilities%rowtype;
  event_id uuid;
begin
  select * into link_record from public.character_abilities where id = p_character_ability_id for update;
  if link_record.id is null then raise exception 'Habilidade não encontrada'; end if;
  if p_state not in ('sealed','masked','discovered','unlocked','altered','disabled','lost') then raise exception 'Estado inválido'; end if;
  if auth.role() <> 'service_role' and (auth.uid() is distinct from p_actor_user_id or not public.has_campaign_role(link_record.campaign_id, array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  select id into event_id from public.audit_events where idempotency_key = p_idempotency_key;
  if event_id is not null then return event_id; end if;
  update public.character_abilities set state = p_state, unlocked_at = case when p_state = 'unlocked' then now() else unlocked_at end,
    unlocked_by = p_actor_user_id, version = version + 1 where id = link_record.id;
  insert into public.audit_events (campaign_id, actor_user_id, entity_type, entity_id, event_type, visibility, before_data, after_data, metadata, idempotency_key)
  values (link_record.campaign_id, p_actor_user_id, 'character_ability', link_record.id, 'ability_state_changed', 'owner_only',
    jsonb_build_object('state', link_record.state), jsonb_build_object('state', p_state), jsonb_build_object('reason', p_reason), p_idempotency_key)
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.spend_ability_cost(
  p_character_ability_id uuid,
  p_actor_user_id uuid,
  p_resolved_costs jsonb,
  p_session_id uuid default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_record public.character_abilities%rowtype;
  ability_record public.abilities%rowtype;
  cost_entry record;
  resource_record public.character_resources%rowtype;
  requested_cost integer;
  configured_cost text;
  dice_count integer;
  dice_sides integer;
  event_id uuid;
  before_resources jsonb := '{}'::jsonb;
  after_resources jsonb := '{}'::jsonb;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  select * into link_record from public.character_abilities where id = p_character_ability_id for update;
  if link_record.id is null or link_record.state not in ('unlocked','altered') then raise exception 'Habilidade indisponível'; end if;
  if auth.role() <> 'service_role'
    and not public.is_character_owner(link_record.character_id)
    and not public.has_campaign_role(link_record.campaign_id, array['campaign_owner','game_master','co_master']) then
    raise exception 'Sem permissão';
  end if;
  select * into ability_record from public.abilities where id = link_record.ability_id;
  select id into event_id from public.audit_events where idempotency_key = p_idempotency_key;
  if event_id is not null then return event_id; end if;

  for cost_entry in select key, value from jsonb_each_text(p_resolved_costs) loop
    if cost_entry.key not in ('pv','pe','san') or cost_entry.value !~ '^[0-9]+$' then raise exception 'Custo inválido'; end if;
    requested_cost := cost_entry.value::integer;
    configured_cost := ability_record.costs ->> cost_entry.key;
    if configured_cost is null then raise exception 'Recurso não configurado no custo'; end if;
    if configured_cost ~ '^[0-9]+$' and requested_cost <> configured_cost::integer then raise exception 'Custo divergente'; end if;
    if configured_cost ~ '^[0-9]+d[0-9]+$' then
      dice_count := split_part(configured_cost, 'd', 1)::integer;
      dice_sides := split_part(configured_cost, 'd', 2)::integer;
      if requested_cost < dice_count or requested_cost > dice_count * dice_sides then raise exception 'Resultado de custo fora do intervalo'; end if;
    end if;

    select * into resource_record from public.character_resources
    where character_id = link_record.character_id and resource = cost_entry.key for update;
    if resource_record.id is null or resource_record.current_value < requested_cost then raise exception 'Recurso insuficiente'; end if;
    before_resources := before_resources || jsonb_build_object(cost_entry.key, resource_record.current_value);
    after_resources := after_resources || jsonb_build_object(cost_entry.key, resource_record.current_value - requested_cost);
  end loop;

  for cost_entry in select key, value from jsonb_each_text(p_resolved_costs) loop
    update public.character_resources
    set current_value = current_value - cost_entry.value::integer, version = version + 1, updated_at = now()
    where character_id = link_record.character_id and resource = cost_entry.key;
  end loop;
  update public.character_abilities
  set usage_counters = jsonb_set(usage_counters, '{total}', to_jsonb(coalesce((usage_counters ->> 'total')::integer, 0) + 1)),
      version = version + 1
  where id = link_record.id;

  insert into public.audit_events (campaign_id,session_id,actor_user_id,entity_type,entity_id,event_type,visibility,before_data,after_data,metadata,idempotency_key)
  values (link_record.campaign_id,p_session_id,p_actor_user_id,'character_ability',link_record.id,'ability_used','owner_only',
    jsonb_build_object('resources',before_resources),jsonb_build_object('resources',after_resources),
    jsonb_build_object('abilityId',link_record.ability_id,'costs',p_resolved_costs),p_idempotency_key)
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.create_character_ability(
  p_campaign_id uuid,
  p_character_id uuid,
  p_name text,
  p_public_description text,
  p_action_type text,
  p_costs jsonb,
  p_recommended_nex integer,
  p_initial_state text,
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ability_id uuid;
  v_link_id uuid;
  v_event_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_actor_user_id then raise exception 'Ator inválido'; end if;
  if auth.role() <> 'service_role' and not public.has_campaign_role(p_campaign_id, array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  if not exists (select 1 from public.characters where id = p_character_id and campaign_id = p_campaign_id and deleted_at is null) then raise exception 'Personagem inválido'; end if;
  if p_initial_state not in ('sealed','masked','discovered','unlocked','altered','disabled','lost') then raise exception 'Estado inválido'; end if;
  if char_length(trim(p_name)) < 2 or char_length(trim(p_public_description)) < 2 then raise exception 'Nome e descrição obrigatórios'; end if;
  if p_recommended_nex < 0 or p_recommended_nex > 100 then raise exception 'NEX inválido'; end if;

  select ae.id, ae.entity_id into v_event_id, v_ability_id
  from public.audit_events ae where ae.idempotency_key = p_idempotency_key;
  if v_event_id is not null then
    select ca.id into v_link_id from public.character_abilities ca
    where ca.character_id = p_character_id and ca.ability_id = v_ability_id;
    return jsonb_build_object('abilityId',v_ability_id,'characterAbilityId',v_link_id,'eventId',v_event_id,'duplicate',true);
  end if;

  insert into public.abilities (campaign_id,name,public_description,action_type,costs,recommended_nex,visibility)
  values (p_campaign_id,trim(p_name),trim(p_public_description),p_action_type,coalesce(p_costs,'{}'::jsonb),p_recommended_nex,'owner_only')
  returning id into v_ability_id;
  insert into public.character_abilities (campaign_id,character_id,ability_id,state,unlocked_at,unlocked_by)
  values (p_campaign_id,p_character_id,v_ability_id,p_initial_state,
    case when p_initial_state = 'unlocked' then now() else null end,
    case when p_initial_state = 'unlocked' then p_actor_user_id else null end)
  returning id into v_link_id;
  insert into public.audit_events (campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,metadata,idempotency_key)
  values (p_campaign_id,p_actor_user_id,'ability',v_ability_id,'ability_created','gm_only',
    jsonb_build_object('name',p_name,'state',p_initial_state,'characterId',p_character_id),
    jsonb_build_object('characterAbilityId',v_link_id),p_idempotency_key)
  returning id into v_event_id;
  return jsonb_build_object('abilityId',v_ability_id,'characterAbilityId',v_link_id,'eventId',v_event_id,'duplicate',false);
end;
$$;

create or replace function public.send_campaign_message(
  p_campaign_id uuid,
  p_real_sender_user_id uuid,
  p_apparent_sender_name text,
  p_recipient_user_ids uuid[],
  p_body text,
  p_format text,
  p_visibility text,
  p_expires_at timestamptz default null,
  p_idempotency_key uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id uuid;
begin
  if auth.role() <> 'service_role' and (auth.uid() is distinct from p_real_sender_user_id or not public.has_campaign_role(p_campaign_id, array['campaign_owner','game_master','co_master'])) then raise exception 'Sem permissão'; end if;
  if cardinality(p_recipient_user_ids) < 1 then raise exception 'Destinatário obrigatório'; end if;
  select id into message_id from public.messages where idempotency_key = p_idempotency_key;
  if message_id is not null then return message_id; end if;

  insert into public.messages (campaign_id, apparent_sender_name, format, visibility, status, expires_at, idempotency_key)
  values (p_campaign_id, p_apparent_sender_name, p_format, p_visibility, 'sent', p_expires_at, p_idempotency_key)
  returning id into message_id;
  insert into public.message_sender_secrets (message_id, campaign_id, real_sender_user_id)
  values (message_id, p_campaign_id, p_real_sender_user_id);
  insert into public.message_contents (message_id, body) values (message_id, p_body);
  insert into public.message_recipients (campaign_id, message_id, user_id, status, delivered_at)
  select p_campaign_id, message_id, recipient_id, 'delivered', now()
  from unnest(p_recipient_user_ids) recipient_id
  where exists (select 1 from public.campaign_members cm where cm.campaign_id = p_campaign_id and cm.user_id = recipient_id and cm.status = 'active');
  insert into public.audit_events (campaign_id, actor_user_id, entity_type, entity_id, event_type, visibility, after_data, metadata, idempotency_key)
  values (p_campaign_id, p_real_sender_user_id, 'message', message_id, 'message_sent', 'gm_only',
    jsonb_build_object('format', p_format, 'recipientCount', cardinality(p_recipient_user_ids)),
    jsonb_build_object('apparentSender', p_apparent_sender_name), gen_random_uuid());
  return message_id;
end;
$$;

create or replace function public.process_due_events(p_limit integer default 100)
returns table(event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.scheduled_events%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role obrigatória'; end if;
  for event_record in
    select * from public.scheduled_events
    where status = 'pending' and due_at <= now()
    order by due_at
    for update skip locked
    limit least(greatest(p_limit, 1), 500)
  loop
    update public.scheduled_events set status = 'processing', attempts = attempts + 1 where id = event_record.id;
    begin
      if event_record.event_type = 'send_message' and event_record.protected_payload ? 'messageId' then
        update public.messages set status = 'sent', send_at = now()
        where id = (event_record.protected_payload ->> 'messageId')::uuid and status in ('created','scheduled');
      end if;
      update public.scheduled_events set status = 'processed', processed_at = now(), last_error = null where id = event_record.id;
      event_id := event_record.id;
      return next;
    exception when others then
      update public.scheduled_events set status = case when attempts >= 4 then 'failed' else 'pending' end, last_error = left(sqlerrm, 500)
      where id = event_record.id;
    end;
  end loop;
end;
$$;

create or replace function public.undo_audit_event(p_event_id uuid, p_reason text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.audit_events%rowtype;
  compensation_id uuid;
begin
  if char_length(trim(p_reason)) < 3 then raise exception 'Justificativa obrigatória'; end if;
  select * into original from public.audit_events where id = p_event_id for update;
  if original.id is null or original.event_type <> 'resource_mutated' then raise exception 'Evento não pode ser desfeito automaticamente'; end if;
  if not public.has_campaign_role(original.campaign_id, array['campaign_owner','game_master']) then raise exception 'Sem permissão'; end if;
  select id into compensation_id from public.audit_events where idempotency_key = p_idempotency_key;
  if compensation_id is not null then return compensation_id; end if;

  update public.character_resources
  set current_value = (original.before_data ->> 'current')::integer, version = version + 1, updated_at = now()
  where id = original.entity_id and current_value = (original.after_data ->> 'current')::integer;
  if not found then raise exception 'Há alteração posterior dependente; confirmação manual necessária'; end if;

  insert into public.audit_events (campaign_id, actor_user_id, entity_type, entity_id, event_type, visibility, before_data, after_data, metadata, idempotency_key, compensates_event_id)
  values (original.campaign_id, auth.uid(), original.entity_type, original.entity_id, 'audit_event_compensated', 'gm_only', original.after_data, original.before_data,
    jsonb_build_object('reason', p_reason), p_idempotency_key, original.id)
  returning id into compensation_id;
  return compensation_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public;
revoke all on function public.mutate_character_resource(uuid,text,integer,text,text,text,uuid,uuid,uuid,text,uuid) from public;
revoke all on function public.unlock_ability(uuid,uuid,text,text,uuid) from public;
revoke all on function public.spend_ability_cost(uuid,uuid,jsonb,uuid,uuid) from public;
revoke all on function public.create_character_ability(uuid,uuid,text,text,text,jsonb,integer,text,uuid,uuid) from public;
revoke all on function public.send_campaign_message(uuid,uuid,text,uuid[],text,text,text,timestamptz,uuid) from public;
revoke all on function public.process_due_events(integer) from public;
revoke all on function public.undo_audit_event(uuid,text,uuid) from public;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.mutate_character_resource(uuid,text,integer,text,text,text,uuid,uuid,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.unlock_ability(uuid,uuid,text,text,uuid) to authenticated, service_role;
grant execute on function public.spend_ability_cost(uuid,uuid,jsonb,uuid,uuid) to authenticated, service_role;
grant execute on function public.create_character_ability(uuid,uuid,text,text,text,jsonb,integer,text,uuid,uuid) to authenticated, service_role;
grant execute on function public.send_campaign_message(uuid,uuid,text,uuid[],text,text,text,timestamptz,uuid) to authenticated, service_role;
grant execute on function public.process_due_events(integer) to service_role;
grant execute on function public.undo_audit_event(uuid,text,uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portraits', 'portraits', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('handouts-public', 'handouts-public', false, 26214400, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/ogg','video/mp4','application/pdf']),
  ('handouts-private', 'handouts-private', false, 26214400, array['image/jpeg','image/png','image/webp','audio/mpeg','audio/ogg','video/mp4','application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_campaign_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare first_part text;
begin
  first_part := (storage.foldername(object_name))[1];
  if first_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return first_part::uuid; end if;
  return null;
end;
$$;

create policy storage_portraits_read on storage.objects for select to authenticated
using (bucket_id = 'portraits' and public.is_campaign_member(public.storage_campaign_id(name)));
create policy storage_portraits_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'portraits' and (
    public.has_campaign_role(public.storage_campaign_id(name), array['campaign_owner','game_master','co_master'])
    or exists (
      select 1 from public.character_owners co
      where co.campaign_id = public.storage_campaign_id(name)
        and co.character_id::text = (storage.foldername(name))[2]
        and co.user_id = auth.uid() and co.confirmed_at is not null
    )
  )
);
create policy storage_public_handouts_read on storage.objects for select to authenticated
using (bucket_id = 'handouts-public' and public.is_campaign_member(public.storage_campaign_id(name)));
create policy storage_handouts_master_write on storage.objects for all to authenticated
using (bucket_id in ('handouts-public','handouts-private') and public.has_campaign_role(public.storage_campaign_id(name), array['campaign_owner','game_master','co_master']))
with check (bucket_id in ('handouts-public','handouts-private') and public.has_campaign_role(public.storage_campaign_id(name), array['campaign_owner','game_master','co_master']));
create policy storage_private_handouts_read on storage.objects for select to authenticated
using (
  bucket_id = 'handouts-private' and (
    public.has_campaign_role(public.storage_campaign_id(name), array['campaign_owner','game_master','co_master'])
    or exists (
      select 1 from public.handout_access ha
      where ha.campaign_id = public.storage_campaign_id(name)
        and ha.handout_id::text = (storage.foldername(name))[2]
        and (ha.user_id = auth.uid() or public.is_character_owner(ha.character_id))
    )
  )
);

alter publication supabase_realtime add table public.character_resources;
alter publication supabase_realtime add table public.character_abilities;
alter publication supabase_realtime add table public.character_conditions;
alter publication supabase_realtime add table public.character_meter_values;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_participants;
alter publication supabase_realtime add table public.encounters;
alter publication supabase_realtime add table public.encounter_combatants;
alter publication supabase_realtime add table public.message_recipients;
alter publication supabase_realtime add table public.notifications;

commit;
