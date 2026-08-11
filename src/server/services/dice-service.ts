import { executeDiceRoll } from "@/lib/dice/parser";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { diceRollSchema } from "@/lib/validation/schemas";

export async function rollDice(input: unknown, actorUserId: string) {
  const request = diceRollSchema.parse(input);
  const result = executeDiceRoll(request.formula);
  if (!isSupabaseConfigured) return { ...result, id: crypto.randomUUID(), demo: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dice_rolls")
    .insert({
      user_id: actorUserId,
      character_id: request.characterId ?? null,
      session_id: request.sessionId ?? null,
      roll_request_id: request.requestId ?? null,
      formula: result.normalized,
      rolls: result.rolls,
      kept_indexes: result.keptIndexes,
      modifier: result.modifier,
      total: result.total,
      purpose: request.purpose,
      visibility: request.visibility,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ...result, id: data.id, demo: false };
}
