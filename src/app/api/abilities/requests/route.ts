import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { executeDiceRoll } from "@/lib/dice/parser";
import { rollDice } from "@/server/services/dice-service";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    campaignId: z.string().min(1).max(100),
    sessionId: z.string().min(1).max(100),
    characterId: z.string().min(1).max(100),
    characterAbilityId: z.string().min(1).max(100),
    context: z.string().trim().max(1_000).default("Solicitação durante a sessão"),
  }),
  z.object({
    action: z.literal("resolve"),
    campaignId: z.string().min(1).max(100),
    requestId: z.string().min(1).max(100),
    approved: z.boolean(),
  }),
  z.object({ action: z.literal("roll"), requestId: z.string().min(1).max(100) }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!isSupabaseConfigured) {
      if (input.action === "request") return NextResponse.json({ requestId: crypto.randomUUID(), demo: true }, { status: 201 });
      if (input.action === "resolve") return NextResponse.json({ approved: input.approved, demo: true });
      const result = executeDiceRoll("1d20");
      return NextResponse.json({ ...result, id: crypto.randomUUID(), demo: true }, { status: 201 });
    }
    const supabase = await createClient();
    if (input.action === "resolve") {
      const user = await requireCampaignMaster(input.campaignId);
      const { data, error } = await supabase.rpc("resolve_ability_use_request", {
        p_campaign_id: input.campaignId,
        p_request_id: input.requestId,
        p_approved: input.approved,
        p_actor_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    if (input.action === "request") {
      const { data, error } = await supabase.rpc("request_ability_use", {
        p_campaign_id: input.campaignId,
        p_session_id: input.sessionId,
        p_character_id: input.characterId,
        p_character_ability_id: input.characterAbilityId,
        p_context: input.context,
        p_actor_user_id: user.id,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ requestId: data }, { status: 201 });
    }
    const { data: claim, error: claimError } = await supabase.rpc("claim_ability_roll_request", {
      p_request_id: input.requestId,
      p_actor_user_id: user.id,
    });
    if (claimError) throw new Error(claimError.message);
    const value = claim as { campaignId: string; sessionId: string; characterId: string; formula: string; abilityName: string };
    let formula = value.formula;
    try { executeDiceRoll(formula, () => 1); } catch { formula = "1d20"; }
    const result = await rollDice({
      formula,
      characterId: value.characterId,
      sessionId: value.sessionId,
      requestId: input.requestId,
      purpose: `Uso de ${value.abilityName}`,
      visibility: "session",
    }, user.id);
    await supabase.rpc("notify_ability_roll", {
      p_request_id: input.requestId,
      p_roll_id: result.id,
      p_total: result.total,
      p_actor_user_id: user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Solicitação inválida." },
      { status: 400 },
    );
  }
}
