begin;

-- Existing scene functions use ON CONFLICT (scene_id, actor_id). Keeping this
-- constraint is compatible with nullable actor_id because PostgreSQL still
-- allows more than one item token (NULL actor_id) in the same scene.
alter table public.scene_tokens
  add constraint scene_tokens_scene_id_actor_id_key unique (scene_id, actor_id);

commit;
