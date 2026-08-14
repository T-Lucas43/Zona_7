import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { executeDiceRoll } from "@/lib/dice/parser";
import { buildCheckPlan, resolveCheck } from "@/lib/rules/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";
import { sortInitiativeCombatants } from "@/lib/initiative";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    campaignId: z.uuid(),
    sessionId: z.uuid(),
    characterId: z.uuid(),
    attribute: z.enum(["agi", "for", "int", "pre", "vig"]),
    skill: z.string().trim().max(80).default(""),
    difficulty: z.number().int().min(0).max(99),
    context: z.string().trim().min(3).max(1_000),
    consequences: z.string().trim().max(1_000).default(""),
    favorableDice: z.number().int().min(0).max(20).default(0),
    unfavorableDice: z.number().int().min(0).max(20).default(0),
    numericModifier: z.number().int().min(-999).max(999).default(0),
    method: z.enum(["roll", "take_10", "take_20"]).default("roll"),
  }),
  z.object({ action: z.literal("roll"), requestId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (!isSupabaseConfigured) {
      if (input.action === "request") return NextResponse.json({ requestId: crypto.randomUUID(), demo: true }, { status: 201 });
      const result = executeDiceRoll("1d20");
      return NextResponse.json({ ...result, id: crypto.randomUUID(), success: true, natural20: result.total === 20, demo: true }, { status: 201 });
    }
    if (input.action === "request") {
      const user = await requireCampaignMaster(input.campaignId);
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("request_character_check", {
        p_campaign_id: input.campaignId,
        p_session_id: input.sessionId,
        p_character_id: input.characterId,
        p_attribute_key: input.attribute,
        p_skill_name: input.skill,
        p_difficulty: input.difficulty,
        p_context: input.context,
        p_consequences: input.consequences,
        p_favorable_dice: input.favorableDice,
        p_unfavorable_dice: input.unfavorableDice,
        p_numeric_modifier: input.numericModifier,
        p_method: input.method,
        p_actor_user_id: user.id,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ requestId: data }, { status: 201 });
    }
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Entre na conta vinculada ao personagem." }, { status: 401 });
    const admin = createAdminClient();
    const { data: requestMeta } = await admin
      .from("roll_requests")
      .select("request_kind,encounter_id,encounter_combatant_id")
      .eq("id", input.requestId)
      .maybeSingle();
    const playerClient = await createClient();
    const { data: claim, error: claimError } = await playerClient.rpc("claim_character_check", {
      p_request_id: input.requestId,
      p_actor_user_id: user.id,
    });
    if (claimError) throw new Error(claimError.message);
    const check = claim as {
      attribute: number;
      skillBonus: number;
      favorableDice: number;
      unfavorableDice: number;
      numericModifier: number;
      difficulty: number;
      method: "roll" | "take_10" | "take_20";
    };
    const plan = buildCheckPlan({
      attribute: check.attribute,
      skillBonus: check.skillBonus,
      favorableDice: check.favorableDice,
      unfavorableDice: check.unfavorableDice,
      numericModifier: check.numericModifier,
    });
    const rolled = check.method === "roll"
      ? executeDiceRoll(plan.formula)
      : {
          count: 1,
          sides: 20 as const,
          modifier: plan.modifier,
          normalized: check.method === "take_10" ? `10 fixo${plan.modifier >= 0 ? "+" : ""}${plan.modifier}` : `20 fixo${plan.modifier >= 0 ? "+" : ""}${plan.modifier}`,
          rolls: [check.method === "take_10" ? 10 : 20],
          keptIndexes: [0],
          total: (check.method === "take_10" ? 10 : 20) + plan.modifier,
        };
    const resolution = resolveCheck({
      rolls: rolled.rolls,
      modifier: rolled.modifier,
      difficulty: check.difficulty,
      keep: plan.keep,
      mode: check.method,
    });
    const { data: completed, error: completeError } = await admin.rpc("complete_character_check", {
      p_request_id: input.requestId,
      p_actor_user_id: user.id,
      p_formula: rolled.normalized,
      p_rolls: rolled.rolls,
      p_kept_indexes: rolled.keptIndexes,
      p_modifier: rolled.modifier,
      p_total: resolution.total,
      p_success: resolution.success,
      p_natural_twenty: resolution.natural20,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (completeError) throw new Error(completeError.message);
    if (requestMeta?.request_kind === "initiative" && requestMeta.encounter_id && requestMeta.encounter_combatant_id) {
      const { error: memberError } = await admin.from("encounter_combatants").update({
        initiative: resolution.total,
        visible_state: "Pronto",
      }).eq("id", requestMeta.encounter_combatant_id).eq("encounter_id", requestMeta.encounter_id);
      if (memberError) throw new Error(memberError.message);
      const { data: members, error: membersError } = await admin
        .from("encounter_combatants")
        .select("id,display_name,initiative,position,initiative_bonus,agility")
        .eq("encounter_id", requestMeta.encounter_id);
      if (membersError) throw new Error(membersError.message);
      const ordered = sortInitiativeCombatants(members);
      const updates = await Promise.all(ordered.map((member, position) => admin.from("encounter_combatants").update({ position }).eq("id", member.id)));
      const orderError = updates.find((update) => update.error)?.error;
      if (orderError) throw new Error(orderError.message);
      if (ordered.length > 0 && ordered.every((member) => member.initiative !== null)) {
        const { error: encounterError } = await admin.from("encounters").update({
          initiative_state: "active",
          current_turn_position: 0,
          round: 1,
        }).eq("id", requestMeta.encounter_id);
        if (encounterError) throw new Error(encounterError.message);
      }
    }
    return NextResponse.json({
      ...rolled,
      total: resolution.total,
      success: resolution.success,
      natural20: resolution.natural20,
      difficulty: check.difficulty,
      id: (completed as { id: string }).id,
      demo: false,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Teste inválido." }, { status: 400 });
  }
}
