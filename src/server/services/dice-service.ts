import { executeDiceRoll } from "@/lib/dice/parser";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { diceRollSchema } from "@/lib/validation/schemas";

export async function rollDice(input: unknown, actorUserId: string) {
  const request = diceRollSchema.parse(input);
  const result = executeDiceRoll(request.formula);
  if (!isSupabaseConfigured) return { ...result, id: crypto.randomUUID(), demo: true };

  const supabase = await createClient();
  const { data: rollerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", actorUserId)
    .maybeSingle();
  if (request.characterId) {
    const { data: character } = await supabase.from("characters").select("character_state").eq("id", request.characterId).maybeSingle();
    if (["dying", "dead"].includes(character?.character_state ?? ""))
      throw new Error("O personagem está sem ações neste estado.");
  }
  let campaignId: string | null = null;
  if (request.sessionId) {
    const { data } = await supabase.from("sessions").select("campaign_id").eq("id", request.sessionId).maybeSingle();
    campaignId = data?.campaign_id ?? null;
  } else if (request.characterId) {
    const { data } = await supabase.from("characters").select("campaign_id").eq("id", request.characterId).maybeSingle();
    campaignId = data?.campaign_id ?? null;
  }
  const { data, error } = await supabase
    .from("dice_rolls")
    .insert({
      campaign_id: campaignId,
      user_id: actorUserId,
      roller_display_name: rollerProfile?.display_name ?? "Jogador",
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
