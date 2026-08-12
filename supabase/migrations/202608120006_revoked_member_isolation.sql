begin;

create or replace function public.is_character_owner(target_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.character_owners owner
    join public.campaign_members member
      on member.campaign_id = owner.campaign_id
     and member.user_id = owner.user_id
     and member.status = 'active'
    where owner.character_id = target_character_id
      and owner.user_id = auth.uid()
      and owner.confirmed_at is not null
  )
$$;

drop policy if exists dice_rolls_read on public.dice_rolls;
create policy dice_rolls_read on public.dice_rolls
for select to authenticated using (
  (user_id = auth.uid() and (campaign_id is null or public.is_campaign_member(campaign_id)))
  or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or (visibility = 'session' and public.is_campaign_member(campaign_id))
);

drop policy if exists messages_read_recipient on public.messages;
create policy messages_read_recipient on public.messages
for select to authenticated using (
  public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
  or (
    public.is_campaign_member(campaign_id)
    and exists (
      select 1 from public.message_recipients recipient
      where recipient.message_id = messages.id and recipient.user_id = auth.uid()
    )
  )
);

drop policy if exists message_contents_read on public.message_contents;
create policy message_contents_read on public.message_contents
for select to authenticated using (
  exists (
    select 1 from public.messages message
    where message.id = message_id and (
      public.has_campaign_role(message.campaign_id,array['campaign_owner','game_master','co_master'])
      or (
        public.is_campaign_member(message.campaign_id)
        and exists (
          select 1 from public.message_recipients recipient
          where recipient.message_id = message.id and recipient.user_id = auth.uid()
        )
      )
    )
  )
);

drop policy if exists recipients_read on public.message_recipients;
create policy recipients_read on public.message_recipients
for select to authenticated using (
  (user_id = auth.uid() and public.is_campaign_member(campaign_id))
  or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
);
drop policy if exists recipients_self_update on public.message_recipients;
create policy recipients_self_update on public.message_recipients
for update to authenticated
using (user_id = auth.uid() and public.is_campaign_member(campaign_id))
with check (user_id = auth.uid() and public.is_campaign_member(campaign_id));

drop policy if exists responses_read on public.message_responses;
create policy responses_read on public.message_responses
for select to authenticated using (
  (user_id = auth.uid() and public.is_campaign_member(campaign_id))
  or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
);
drop policy if exists responses_create on public.message_responses;
create policy responses_create on public.message_responses
for insert to authenticated
with check (user_id = auth.uid() and public.is_campaign_member(campaign_id));

drop policy if exists handout_access_read on public.handout_access;
create policy handout_access_read on public.handout_access
for select to authenticated using (
  (public.is_campaign_member(campaign_id) and (user_id = auth.uid() or public.is_character_owner(character_id)))
  or public.has_campaign_role(campaign_id,array['campaign_owner','game_master','co_master'])
);

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
for select to authenticated
using (user_id = auth.uid() and public.is_campaign_member(campaign_id));
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
for update to authenticated
using (user_id = auth.uid() and public.is_campaign_member(campaign_id))
with check (user_id = auth.uid() and public.is_campaign_member(campaign_id));

commit;
