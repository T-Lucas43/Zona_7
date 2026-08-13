import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { executeDiceRoll } from "@/lib/dice/parser";
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
    const value = claim as {
      campaignId: string;
      sessionId: string;
      characterId: string;
      characterAbilityId: string;
      formula: string;
      abilityName: string;
      costs?: Record<string, string>;
    };
    let formula = value.formula;
    try { executeDiceRoll(formula, () => 1); } catch { formula = "1d20"; }
    const resolvedCosts = Object.fromEntries(
      Object.entries(value.costs ?? {}).map(([resource, cost]) => {
        const expression = String(cost);
        if (/^\d+$/.test(expression)) return [resource, Number(expression)];
        return [resource, executeDiceRoll(expression).total];
      }),
    );
    const result = executeDiceRoll(formula);
    const { data: completed, error: completeError } = await createAdminClient().rpc("complete_ability_roll", {
      p_request_id: input.requestId,
      p_actor_user_id: user.id,
      p_formula: result.normalized,
      p_rolls: result.rolls,
      p_kept_indexes: result.keptIndexes,
      p_modifier: result.modifier,
      p_total: result.total,
      p_resolved_costs: resolvedCosts,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (completeError) throw new Error(completeError.message);
    const completedValue = completed as { id: string; duplicate?: boolean };
    return NextResponse.json({ ...result, id: completedValue.id, demo: false, duplicate: completedValue.duplicate ?? false }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Solicitação inválida." },
      { status: 400 },
    );
  }
}
