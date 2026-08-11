import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { resourceMutationSchema } from "@/lib/validation/schemas";

export async function mutateResource(input: unknown, actorUserId: string) {
  const mutation = resourceMutationSchema.parse(input);
  if (!isSupabaseConfigured) {
    return {
      demo: true,
      eventId: mutation.idempotencyKey,
      characterId: mutation.characterId,
      resource: mutation.resource,
      delta: mutation.delta,
      thresholds: [],
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mutate_character_resource", {
    p_character_id: mutation.characterId,
    p_resource: mutation.resource,
    p_delta: mutation.delta,
    p_operation: mutation.operation,
    p_source: mutation.source,
    p_reason: mutation.reason,
    p_actor_user_id: actorUserId,
    p_session_id: mutation.sessionId ?? null,
    p_encounter_id: mutation.encounterId ?? null,
    p_visibility: mutation.visibility,
    p_idempotency_key: mutation.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}
