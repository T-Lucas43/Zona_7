-- Repair functions already installed by earlier migrations on incremental deployments.
alter function public.accept_invitation(text) set search_path to extensions;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.mutate_character_resource(uuid,text,integer,text,text,text,uuid,uuid,uuid,text,uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'crossed_labels text[] := ''{}'';',
    'crossed_labels text[] := array[]::text[];'
  );
  execute v_definition;
end;
$$;
