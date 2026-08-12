begin;

drop policy if exists campaigns_update_master on public.campaigns;
create policy campaigns_update_master on public.campaigns
for update to authenticated
using (public.has_campaign_role(id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(id,array['campaign_owner','game_master','co_master']));

drop policy if exists campaign_members_manage on public.campaign_members;
create policy campaign_members_manage on public.campaign_members
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists campaign_permissions_manage on public.campaign_permissions;
create policy campaign_permissions_manage on public.campaign_permissions
for all to authenticated
using (exists (
  select 1 from public.campaign_members member
  where member.id = campaign_member_id
    and public.has_campaign_role(member.campaign_id,array['campaign_owner','game_master','co_master'])
))
with check (exists (
  select 1 from public.campaign_members member
  where member.id = campaign_member_id
    and public.has_campaign_role(member.campaign_id,array['campaign_owner','game_master','co_master'])
));

drop policy if exists invitations_master on public.invitations;
create policy invitations_master on public.invitations
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists campaign_rules_manage on public.campaign_rule_settings;
create policy campaign_rules_manage on public.campaign_rule_settings
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists character_owners_manage on public.character_owners;
create policy character_owners_manage on public.character_owners
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists threshold_rules_manage on public.resource_threshold_rules;
create policy threshold_rules_manage on public.resource_threshold_rules
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists custom_fields_manage on public.campaign_custom_fields;
create policy custom_fields_manage on public.campaign_custom_fields
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

drop policy if exists campaign_ui_manage on public.campaign_ui_settings;
create policy campaign_ui_manage on public.campaign_ui_settings
for all to authenticated
using (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']))
with check (public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master']));

alter table public.campaign_custom_fields
  alter column editable_by_roles set default array['campaign_owner','game_master','co_master'];
update public.campaign_custom_fields
set editable_by_roles = array_append(editable_by_roles,'co_master')
where 'game_master' = any(editable_by_roles) and not ('co_master' = any(editable_by_roles));

create or replace function public.undo_audit_event(
  p_event_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
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
  if not public.has_campaign_role(original.campaign_id,array['campaign_owner','game_master','co_master']) then raise exception 'Sem permissão'; end if;
  select id into compensation_id from public.audit_events where idempotency_key = p_idempotency_key;
  if compensation_id is not null then return compensation_id; end if;

  update public.character_resources
  set current_value = (original.before_data ->> 'current')::integer,
      version = version + 1,
      updated_at = now()
  where id = original.entity_id
    and current_value = (original.after_data ->> 'current')::integer;
  if not found then raise exception 'Há alteração posterior dependente; confirmação manual necessária'; end if;

  insert into public.audit_events(
    campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,
    before_data,after_data,metadata,idempotency_key,compensates_event_id
  ) values (
    original.campaign_id,auth.uid(),original.entity_type,original.entity_id,
    'audit_event_compensated','gm_only',original.after_data,original.before_data,
    jsonb_build_object('reason',p_reason),p_idempotency_key,original.id
  ) returning id into compensation_id;
  return compensation_id;
end;
$$;

revoke all on function public.undo_audit_event(uuid,text,uuid) from public;
grant execute on function public.undo_audit_event(uuid,text,uuid) to authenticated, service_role;

commit;
