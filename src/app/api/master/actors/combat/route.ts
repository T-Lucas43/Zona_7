import { NextResponse } from "next/server";
import { z } from "zod";
import { executeDiceRoll } from "@/lib/dice/parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const profileFields = z.object({
  classification: z.string().trim().min(2).max(80),
  threatLevel: z.number().int().min(0).max(999),
  defense: z.number().int().min(0).max(999),
  movement: z.number().int().min(0).max(999),
  initiativeBonus: z.number().int().min(-999).max(999),
  attributes: z.object({
    agi: z.number().int().min(0).max(99),
    for: z.number().int().min(0).max(99),
    int: z.number().int().min(0).max(99),
    pre: z.number().int().min(0).max(99),
    vig: z.number().int().min(0).max(99),
  }),
  resources: z.object({
    pv: z.object({ current: z.number().int().min(0).max(99999), maximum: z.number().int().min(1).max(99999) }),
    pe: z.object({ current: z.number().int().min(0).max(99999), maximum: z.number().int().min(0).max(99999) }),
    san: z.object({ current: z.number().int().min(0).max(99999), maximum: z.number().int().min(0).max(99999) }),
  }),
  resistances: z.record(z.string().max(80), z.number().int().min(-999).max(999)).default({}),
  skills: z.record(z.string().max(80), z.number().int().min(-999).max(999)).default({}),
  conditions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  notes: z.string().trim().max(10_000).default(""),
});

const attackFields = z.object({
  name: z.string().trim().min(2).max(120),
  attackFormula: z.string().trim().min(2).max(80),
  damageFormula: z.string().trim().min(2).max(80),
  damageType: z.string().trim().max(80).default(""),
  rangeText: z.string().trim().max(120).default(""),
  actionType: z.string().trim().min(2).max(80).default("Padrão"),
  description: z.string().trim().max(2_000).default(""),
  requirements: z.string().trim().max(1_000).default(""),
  additionalEffects: z.string().trim().max(2_000).default(""),
  resourceKind: z.enum(["pv", "pe", "san"]).nullable().default(null),
  resourceCost: z.number().int().min(0).max(9999).default(0),
  targetScope: z.enum(["self", "ally", "enemy", "any"]).default("enemy"),
  targetMin: z.number().int().min(0).max(20).default(1),
  targetMax: z.number().int().min(0).max(20).default(1),
});

const common = { campaignId: z.uuid(), actorId: z.uuid() };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_profile"), ...common, profile: profileFields }),
  z.object({ action: z.literal("create_attack"), ...common, attack: attackFields }),
  z.object({ action: z.literal("update_attack"), ...common, attackId: z.uuid(), attack: attackFields }),
  z.object({ action: z.literal("delete_attack"), ...common, attackId: z.uuid() }),
  z.object({
    action: z.literal("execute_attack"),
    ...common,
    attackId: z.uuid(),
    sessionId: z.uuid(),
    encounterId: z.uuid().nullable().optional(),
    targetCharacterIds: z.array(z.uuid()).max(20).default([]),
    targetActorIds: z.array(z.uuid()).max(20).default([]),
  }),
]);

function attackValues(attack: z.infer<typeof attackFields>) {
  if (attack.targetMax < attack.targetMin) throw new Error("O máximo de alvos não pode ser menor que o mínimo.");
  executeDiceRoll(attack.attackFormula, () => 1);
  executeDiceRoll(attack.damageFormula, () => 1);
  return {
    name: attack.name,
    attack_formula: attack.attackFormula,
    damage_formula: attack.damageFormula,
    damage_type: attack.damageType || null,
    range_text: attack.rangeText || null,
    action_type: attack.actionType,
    description: attack.description || null,
    requirements: attack.requirements || null,
    additional_effects: attack.additionalEffects || null,
    resource_kind: attack.resourceKind,
    resource_cost: attack.resourceCost,
    target_scope: attack.targetScope,
    target_min: attack.targetMin,
    target_max: attack.targetMax,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ ok: true, demo: true });
    const supabase = await createClient();
    const { data: actor, error: actorError } = await supabase
      .from("actors")
      .select("id,name")
      .eq("id", input.actorId)
      .eq("campaign_id", input.campaignId)
      .is("deleted_at", null)
      .single();
    if (actorError) throw new Error(actorError.message);

    if (input.action === "save_profile") {
      const value = input.profile;
      const maximumHp = Math.max(1, value.resources.pv.maximum);
      const maximumPe = Math.max(0, value.resources.pe.maximum);
      const maximumSan = Math.max(0, value.resources.san.maximum);
      const { error } = await supabase.from("actor_combat_profiles").upsert({
        actor_id: input.actorId,
        campaign_id: input.campaignId,
        classification: value.classification,
        threat_level: value.threatLevel,
        defense: value.defense,
        movement: value.movement,
        initiative_bonus: value.initiativeBonus,
        agility: value.attributes.agi,
        strength: value.attributes.for,
        intellect: value.attributes.int,
        presence: value.attributes.pre,
        vigor: value.attributes.vig,
        current_hp: Math.min(value.resources.pv.current, maximumHp),
        maximum_hp: maximumHp,
        current_pe: Math.min(value.resources.pe.current, maximumPe),
        maximum_pe: maximumPe,
        current_san: Math.min(value.resources.san.current, maximumSan),
        maximum_san: maximumSan,
        resistances: value.resistances,
        skills: value.skills,
        conditions: value.conditions,
        notes: value.notes || null,
        version: 1,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "create_attack" || input.action === "update_attack") {
      const values = attackValues(input.attack);
      const query = input.action === "create_attack"
        ? supabase.from("actor_attacks").insert({ campaign_id: input.campaignId, actor_id: input.actorId, ...values })
        : supabase.from("actor_attacks").update(values).eq("id", input.attackId).eq("actor_id", input.actorId);
      const { data, error } = await query.select("id").single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: data.id }, { status: input.action === "create_attack" ? 201 : 200 });
    }

    if (input.action === "delete_attack") {
      const { error } = await supabase.from("actor_attacks").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", input.attackId).eq("actor_id", input.actorId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true });
    }

    const admin = createAdminClient();
    const [{ data: attack, error: attackError }, { data: profile, error: profileError }] = await Promise.all([
      admin.from("actor_attacks").select("*").eq("id", input.attackId).eq("actor_id", input.actorId).eq("is_active", true).single(),
      admin.from("actor_combat_profiles").select("*").eq("actor_id", input.actorId).single(),
    ]);
    if (attackError) throw new Error(attackError.message);
    if (profileError) throw new Error("Preencha e salve a ficha de combate antes de atacar.");
    const targetCount = input.targetCharacterIds.length + input.targetActorIds.length;
    if (targetCount < attack.target_min || targetCount > attack.target_max)
      throw new Error(`Este ataque exige de ${attack.target_min} a ${attack.target_max} alvo(s).`);
    if (attack.resource_kind && attack.resource_cost > 0) {
      const currentColumn = `current_${attack.resource_kind}` as "current_pv" | "current_pe" | "current_san";
      const available = Number(profile[currentColumn] ?? 0);
      if (available < attack.resource_cost) throw new Error(`Recurso ${attack.resource_kind.toUpperCase()} insuficiente.`);
      const { error } = await admin.from("actor_combat_profiles").update({ [currentColumn]: available - attack.resource_cost, version: profile.version + 1, updated_at: new Date().toISOString() }).eq("actor_id", input.actorId);
      if (error) throw new Error(error.message);
    }

    const [{ data: characters }, { data: targetActors }] = await Promise.all([
      input.targetCharacterIds.length
        ? admin.from("characters").select("id,name,defense").in("id", input.targetCharacterIds).eq("campaign_id", input.campaignId)
        : Promise.resolve({ data: [] }),
      input.targetActorIds.length
        ? admin.from("actors").select("id,name,actor_combat_profiles(defense,current_hp,maximum_hp,version)").in("id", input.targetActorIds).eq("campaign_id", input.campaignId)
        : Promise.resolve({ data: [] }),
    ]);
    const targets = [
      ...(characters ?? []).map((target) => ({ type: "character" as const, id: target.id, name: target.name, defense: target.defense })),
      ...(targetActors ?? []).map((target) => {
        const targetProfile = Array.isArray(target.actor_combat_profiles) ? target.actor_combat_profiles[0] : target.actor_combat_profiles;
        return { type: "actor" as const, id: target.id, name: target.name, defense: targetProfile?.defense ?? 10, profile: targetProfile };
      }),
    ];
    if (targets.length !== targetCount) throw new Error("Um ou mais alvos não pertencem à campanha.");

    const outcomes = [];
    for (const target of targets) {
      const attackRoll = executeDiceRoll(attack.attack_formula);
      const hit = attackRoll.total >= target.defense;
      const damageRoll = hit ? executeDiceRoll(attack.damage_formula) : null;
      const { error: rollError } = await admin.from("dice_rolls").insert({
        campaign_id: input.campaignId,
        session_id: input.sessionId,
        actor_id: input.actorId,
        user_id: user.id,
        roller_display_name: actor.name,
        formula: attackRoll.normalized,
        rolls: attackRoll.rolls,
        kept_indexes: attackRoll.keptIndexes,
        modifier: attackRoll.modifier,
        total: attackRoll.total,
        purpose: `${attack.name} contra ${target.name}${hit ? " — acerto" : " — falha"}`,
        visibility: "session",
      });
      if (rollError) throw new Error(rollError.message);
      if (hit && damageRoll) {
        const { error: damageRollError } = await admin.from("dice_rolls").insert({
          campaign_id: input.campaignId,
          session_id: input.sessionId,
          actor_id: input.actorId,
          user_id: user.id,
          roller_display_name: actor.name,
          formula: damageRoll.normalized,
          rolls: damageRoll.rolls,
          kept_indexes: damageRoll.keptIndexes,
          modifier: damageRoll.modifier,
          total: damageRoll.total,
          purpose: `Dano de ${attack.name} em ${target.name}`,
          visibility: "session",
        });
        if (damageRollError) throw new Error(damageRollError.message);
        if (target.type === "character") {
          const { error } = await admin.rpc("mutate_character_resource", {
            p_character_id: target.id,
            p_resource: "pv",
            p_delta: -damageRoll.total,
            p_operation: "damage",
            p_source: actor.name,
            p_reason: attack.name,
            p_actor_user_id: user.id,
            p_session_id: input.sessionId,
            p_encounter_id: input.encounterId ?? null,
            p_visibility: "campaign",
            p_idempotency_key: crypto.randomUUID(),
          });
          if (error) throw new Error(error.message);
        } else if (target.profile) {
          const currentHp = Math.max(0, target.profile.current_hp - damageRoll.total);
          const { error } = await admin.from("actor_combat_profiles").update({ current_hp: currentHp, version: target.profile.version + 1, updated_at: new Date().toISOString() }).eq("actor_id", target.id);
          if (error) throw new Error(error.message);
          if (input.encounterId) await admin.from("encounter_combatants").update({ current_hp: currentHp }).eq("encounter_id", input.encounterId).eq("actor_id", target.id);
        }
      }
      outcomes.push({ targetId: target.id, targetName: target.name, attackTotal: attackRoll.total, defense: target.defense, hit, damage: damageRoll?.total ?? 0 });
    }
    return NextResponse.json({ outcomes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ação de combate inválida." }, { status: 400 });
  }
}
