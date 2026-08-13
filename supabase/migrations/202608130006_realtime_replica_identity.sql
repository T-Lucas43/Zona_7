begin;

-- O filtro de RLS e as interfaces otimistas precisam do registro completo em UPDATE/DELETE.
alter table public.audit_events replica identity full;
alter table public.session_summaries replica identity full;
alter table public.scene_reveal_states replica identity full;
alter table public.rule_change_log replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.rule_change_log;
exception when duplicate_object then null; end $$;

commit;
