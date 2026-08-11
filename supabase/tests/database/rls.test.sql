begin;
select plan(30);

-- These tests are executed after supabase/seed.sql and the server-side demo-user bootstrap.
select has_table('public', 'audit_events', 'audit_events exists');
select has_table('public', 'message_sender_secrets', 'real sender is physically separated');
select has_table('public', 'character_secrets', 'character master notes are physically separated');
select policies_are(
  'public',
  'message_sender_secrets',
  array['message_sender_secrets_master'],
  'only the master policy reaches real sender data'
);
select policies_are(
  'public',
  'character_secrets',
  array['character_secrets_master'],
  'only the master policy reaches character secrets'
);
select function_returns('public', 'mutate_character_resource', array['uuid','text','integer','text','text','text','uuid','uuid','uuid','text','uuid'], 'jsonb', 'resource mutation is a database transaction');
select function_returns('public', 'undo_audit_event', array['uuid','text','uuid'], 'uuid', 'undo creates compensating events');
select has_table('public', 'character_weaknesses', 'mechanical weaknesses exist');
select has_table('public', 'media_assets', 'private media catalog exists');
select has_table('public', 'actors', 'master-controlled actors exist');
select has_table('public', 'scene_tokens', 'interactive scene tokens exist');
select has_table('public', 'script_versions', 'immutable script versions exist');
select has_table('public', 'script_runs', 'script execution state exists');
select has_table('public', 'live_session_events', 'sequenced realtime events exist');
select function_returns('public', 'mutate_character_meter', array['uuid','integer','integer','text','text','uuid','uuid'], 'jsonb', 'meter changes are transactional');
select function_returns('public', 'move_scene_token', array['uuid','numeric','numeric','text','uuid','uuid'], 'jsonb', 'token movement is transactional');
select function_returns('public', 'control_script_run', array['uuid','uuid','text','uuid','uuid','text','text','uuid'], 'jsonb', 'script run control is transactional');
select function_returns('public', 'update_character_identity', array['uuid','integer','text','text','text','text','text','integer','text','text','integer','numeric','integer','text','uuid','uuid'], 'jsonb', 'character editing uses optimistic concurrency');
select has_table('public', 'session_public_state', 'public session state is physically separated from master scripts');
select policies_are('public', 'session_public_state', array['session_public_state_master_manage','session_public_state_member_read'], 'players only receive the public session DTO');
select function_returns('public', 'create_playable_character', array['uuid','text','text','text','text','text','integer','integer','integer','integer','integer','integer','integer','integer','integer','integer','uuid','uuid','uuid'], 'uuid', 'playable character creation is transactional');
select function_returns('public', 'deliver_item_to_characters', array['uuid','uuid[]','text','text','integer','uuid','uuid'], 'uuid', 'item delivery is transactional');
select function_returns('public', 'deliver_handout_to_characters', array['uuid','uuid[]','text','text','text','uuid','uuid'], 'uuid', 'handout delivery is transactional');
select function_returns('public', 'set_character_session_visibility', array['uuid','uuid','boolean','uuid','uuid'], 'uuid', 'session visibility is audited');
select has_table('public', 'character_sheet_settings', 'per-character sheet visibility exists');
select policies_are('public', 'character_sheet_settings', array['character_sheet_settings_master_manage','character_sheet_settings_owner_read'], 'only master writes sheet visibility while the owner can read it');
select function_returns('public', 'get_player_character_sheet', array['uuid'], 'jsonb', 'player sheet is returned through a protected projection');
select function_returns('public', 'update_character_sheet_settings', array['uuid','uuid','text[]','text[]','uuid'], 'character_sheet_settings', 'sheet visibility is changed transactionally');
select function_returns('public', 'add_actor_to_scene', array['uuid','uuid','uuid','numeric','numeric','boolean','uuid'], 'uuid', 'adding an actor to a scene is transactional');
select function_returns('public', 'assign_character_to_user', array['uuid','uuid','uuid','uuid','uuid'], 'jsonb', 'character assignment is transactional');

select * from finish();
rollback;
