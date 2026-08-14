import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { executeDiceRoll } from "@/lib/dice/parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"), campaignId: z.uuid(), sessionId: z.uuid(), characterId: z.uuid(), attackId: z.uuid(),
    targetCharacterIds: z.array(z.uuid()).max(20).default([]), targetActorIds: z.array(z.uuid()).max(20).default([]),
  }),
  z.object({ action: z.literal("resolve"), campaignId: z.uuid(), requestId: z.uuid(), approved: z.boolean() }),
  z.object({ action: z.literal("execute"), requestId: z.uuid() }),
  z.object({ action: z.literal("status"), requestId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    if (input.action === "resolve") {
      const user = await requireCampaignMaster(input.campaignId);
      const decision = input.approved ? "approved" : "rejected";
      const { error } = await admin.from("roll_requests").update({
        decision,
        status: input.approved ? "answered" : "revoked",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", input.requestId).eq("campaign_id", input.campaignId).eq("request_kind", "attack").eq("status", "pending");
      if (error) throw new Error(error.message);
      return NextResponse.json({ decision });
    }
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Entre na conta vinculada ao personagem." }, { status: 401 });
    if (input.action === "status") {
      const { data, error } = await admin.from("roll_requests").select("decision,rolled_at").eq("id", input.requestId).eq("requested_by", user.id).eq("request_kind", "attack").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ decision: data.decision, rolled: Boolean(data.rolled_at) });
    }
    if (input.action === "request") {
      const [{ data: ownership }, { data: attack, error: attackError }] = await Promise.all([
        admin.from("character_owners").select("character_id").eq("character_id", input.characterId).eq("user_id", user.id).not("confirmed_at", "is", null).maybeSingle(),
        admin.from("attacks").select("id,name,target_min,target_max").eq("id", input.attackId).eq("character_id", input.characterId).eq("is_active", true).single(),
      ]);
      if (!ownership) throw new Error("Você não controla este personagem.");
      if (attackError) throw new Error(attackError.message);
      const targetCount = input.targetCharacterIds.length + input.targetActorIds.length;
      if (targetCount < attack.target_min || targetCount > attack.target_max) throw new Error(`Este ataque exige de ${attack.target_min} a ${attack.target_max} alvo(s).`);
      const [{ data: characters }, { data: actors }] = await Promise.all([
        input.targetCharacterIds.length ? admin.from("characters").select("id,name").eq("campaign_id", input.campaignId).in("id", input.targetCharacterIds) : Promise.resolve({ data: [] }),
        input.targetActorIds.length ? admin.from("actors").select("id,name").eq("campaign_id", input.campaignId).in("id", input.targetActorIds) : Promise.resolve({ data: [] }),
      ]);
      if ((characters?.length ?? 0) + (actors?.length ?? 0) !== targetCount) throw new Error("Um ou mais alvos não pertencem à campanha.");
      const { data: encounter } = await admin.from("encounters").select("id").eq("session_id", input.sessionId).in("status", ["active", "paused"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await admin.from("roll_requests").insert({
        campaign_id: input.campaignId,
        session_id: input.sessionId,
        requested_by: user.id,
        character_id: input.characterId,
        character_attack_id: input.attackId,
        request_kind: "attack",
        encounter_id: encounter?.id ?? null,
        skill_or_attribute: "Ataque",
        context: `Solicitação de ataque: ${attack.name}`,
        visibility: "session",
        status: "pending",
        target_character_ids: input.targetCharacterIds,
        target_actor_ids: input.targetActorIds,
        target_snapshot: [
          ...(characters ?? []).map((target) => ({ type: "character", id: target.id, name: target.name })),
          ...(actors ?? []).map((target) => ({ type: "actor", id: target.id, name: target.name })),
        ],
        idempotency_key: crypto.randomUUID(),
      }).select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ requestId: data.id }, { status: 201 });
    }
    const { data: requestRow, error: requestError } = await admin.from("roll_requests").select("*,attack:attacks!roll_requests_character_attack_id_fkey(*)").eq("id", input.requestId).eq("request_kind", "attack").single();
    if (requestError) throw new Error(requestError.message);
    if (requestRow.requested_by !== user.id) throw new Error("Esta solicitação pertence a outro jogador.");
    if (requestRow.decision !== "approved" || requestRow.rolled_at) throw new Error("O ataque ainda não foi aprovado ou já foi executado.");
    const attack = Array.isArray(requestRow.attack) ? requestRow.attack[0] : requestRow.attack;
    if (!attack) throw new Error("Ataque não encontrado.");
    const { data: character } = await admin.from("characters").select("name,character_state").eq("id", requestRow.character_id).single();
    if (["dying", "dead"].includes(character?.character_state ?? "")) throw new Error("O personagem está sem ações neste estado.");
    const [{ data: targetCharacters }, { data: targetActors }] = await Promise.all([
      requestRow.target_character_ids.length ? admin.from("characters").select("id,name,defense").in("id", requestRow.target_character_ids) : Promise.resolve({ data: [] }),
      requestRow.target_actor_ids.length ? admin.from("actors").select("id,name,actor_combat_profiles(defense,current_hp,version)").in("id", requestRow.target_actor_ids) : Promise.resolve({ data: [] }),
    ]);
    const targets = [
      ...(targetCharacters ?? []).map((target) => ({ type: "character" as const, id: target.id, name: target.name, defense: target.defense })),
      ...(targetActors ?? []).map((target) => { const profile = Array.isArray(target.actor_combat_profiles) ? target.actor_combat_profiles[0] : target.actor_combat_profiles; return { type: "actor" as const, id: target.id, name: target.name, defense: profile?.defense ?? 10, profile }; }),
    ];
    const outcomes = [];
    for (const target of targets) {
      const attackRoll = executeDiceRoll(attack.attack_formula);
      const hit = attackRoll.total >= target.defense;
      const damageRoll = hit ? executeDiceRoll(attack.damage_formula) : null;
      const rolls = [{ roll: attackRoll, purpose: `${attack.name} contra ${target.name}${hit ? " — acerto" : " — falha"}` }, ...(damageRoll ? [{ roll: damageRoll, purpose: `Dano de ${attack.name} em ${target.name}` }] : [])];
      for (const item of rolls) {
        const { error } = await admin.from("dice_rolls").insert({ campaign_id: requestRow.campaign_id, session_id: requestRow.session_id, roll_request_id: requestRow.id, character_id: requestRow.character_id, user_id: user.id, roller_display_name: character?.name ?? "Personagem", formula: item.roll.normalized, rolls: item.roll.rolls, kept_indexes: item.roll.keptIndexes, modifier: item.roll.modifier, total: item.roll.total, purpose: item.purpose, visibility: "session" });
        if (error) throw new Error(error.message);
      }
      if (damageRoll && target.type === "character") {
        const { error } = await admin.rpc("mutate_character_resource", { p_character_id: target.id, p_resource: "pv", p_delta: -damageRoll.total, p_operation: "damage", p_source: character?.name ?? "Ataque", p_reason: attack.name, p_actor_user_id: user.id, p_session_id: requestRow.session_id, p_encounter_id: requestRow.encounter_id, p_visibility: "campaign", p_idempotency_key: crypto.randomUUID() });
        if (error) throw new Error(error.message);
      } else if (damageRoll && target.type === "actor" && target.profile) {
        const currentHp = Math.max(0, target.profile.current_hp - damageRoll.total);
        const { error } = await admin.from("actor_combat_profiles").update({ current_hp: currentHp, version: target.profile.version + 1, updated_at: new Date().toISOString() }).eq("actor_id", target.id);
        if (error) throw new Error(error.message);
        if (requestRow.encounter_id) await admin.from("encounter_combatants").update({ current_hp: currentHp }).eq("encounter_id", requestRow.encounter_id).eq("actor_id", target.id);
      }
      outcomes.push({ targetName: target.name, hit, attack: attackRoll.total, defense: target.defense, damage: damageRoll?.total ?? 0 });
    }
    if (attack.current_ammunition !== null) await admin.from("attacks").update({ current_ammunition: Math.max(0, attack.current_ammunition - 1) }).eq("id", attack.id);
    await admin.from("roll_requests").update({ rolled_at: new Date().toISOString() }).eq("id", requestRow.id);
    return NextResponse.json({ outcomes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Solicitação de combate inválida." }, { status: 400 });
  }
}
