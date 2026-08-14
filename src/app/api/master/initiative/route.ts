import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeDiceRoll } from "@/lib/dice/parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortInitiativeCombatants } from "@/lib/initiative";
import { requireCampaignMaster } from "@/server/services/master-access";

const combatant = {
  campaignId: z.uuid(),
  encounterId: z.uuid(),
};

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    ...combatant,
    sessionId: z.uuid(),
    sceneId: z.uuid(),
  }),
  z.object({
    action: z.literal("roll_actor"),
    ...combatant,
    combatantId: z.uuid(),
    sessionId: z.uuid(),
  }),
  z.object({
    action: z.literal("add"),
    ...combatant,
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["character", "ally", "npc", "enemy"]),
    initiative: z.number().int().min(-100).max(999).nullable(),
    characterId: z.uuid().nullable().optional(),
    currentHp: z.number().int().min(0).max(99999).default(10),
    maximumHp: z.number().int().min(1).max(99999).default(10),
    hiddenHp: z.boolean().default(true),
    visibleState: z.string().trim().max(120).default("Ativo"),
  }),
  z.object({
    action: z.literal("update"),
    ...combatant,
    combatantId: z.uuid(),
    initiative: z.number().int().min(-100).max(999).nullable(),
  }),
  z.object({
    action: z.literal("remove"),
    ...combatant,
    combatantId: z.uuid(),
  }),
  z.object({
    action: z.literal("current"),
    ...combatant,
    combatantId: z.uuid(),
  }),
  z.object({
    action: z.literal("hp"),
    ...combatant,
    combatantId: z.uuid(),
    currentHp: z.number().int().min(0).max(99999),
    maximumHp: z.number().int().min(1).max(99999),
    hiddenHp: z.boolean(),
    visibleState: z.string().trim().max(120),
    reason: z.string().trim().min(3).max(500),
  }),
]);

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function normalizeOrder(supabase: SupabaseClient, campaignId: string, encounterId: string) {
  const [{ data: encounter, error: encounterError }, { data, error }] = await Promise.all([
    supabase
      .from("encounters")
      .select("current_turn_position")
      .eq("id", encounterId)
      .eq("campaign_id", campaignId)
      .single(),
    supabase
      .from("encounter_combatants")
      .select("id,character_id,actor_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state,initiative_bonus,agility")
      .eq("encounter_id", encounterId)
      .eq("campaign_id", campaignId),
  ]);
  if (encounterError) throw new Error(encounterError.message);
  if (error) throw new Error(error.message);
  const currentId = data.find((item) => item.position === encounter.current_turn_position)?.id;
  const ordered = sortInitiativeCombatants(data);
  const updates = await Promise.all(
    ordered.map((item, position) =>
      supabase
        .from("encounter_combatants")
        .update({ position })
        .eq("id", item.id)
        .eq("campaign_id", campaignId),
    ),
  );
  const updateError = updates.find((result) => result.error)?.error;
  if (updateError) throw new Error(updateError.message);
  const currentPosition = currentId ? ordered.findIndex((item) => item.id === currentId) : null;
  const { error: turnError } = await supabase
    .from("encounters")
    .update({ current_turn_position: currentPosition === -1 ? null : currentPosition })
    .eq("id", encounterId)
    .eq("campaign_id", campaignId);
  if (turnError) throw new Error(turnError.message);
  return ordered.map((item, position) => ({
    id: item.id,
    characterId: item.character_id,
    actorId: item.actor_id,
    nome: item.display_name,
    tipo: item.kind,
    iniciativa: item.initiative,
    posicao: position,
    atual: position === currentPosition,
    pvAtual: item.current_hp,
    pvMaximo: item.maximum_hp,
    pvOculto: item.hidden_hp,
    estadoVisivel: item.visible_state ?? "Ativo",
  }));
}

async function snapshotInitiative(supabase: SupabaseClient, campaignId: string, encounterId: string) {
  const [{ data: encounter, error: encounterError }, { data, error }] = await Promise.all([
    supabase.from("encounters").select("current_turn_position,session_id,initiative_state").eq("id", encounterId).eq("campaign_id", campaignId).single(),
    supabase.from("encounter_combatants").select("id,character_id,actor_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state,actions_state,private_notes,initiative_bonus,agility").eq("encounter_id", encounterId).eq("campaign_id", campaignId).order("position"),
  ]);
  if (encounterError) throw new Error(encounterError.message);
  if (error) throw new Error(error.message);
  return { combatants: data, turnPosition: encounter.current_turn_position, sessionId: encounter.session_id as string | null, initiativeState: encounter.initiative_state as string };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) {
      return NextResponse.json({ combatentes: [], demo: true });
    }
    const supabase = await createClient();
    const before = await snapshotInitiative(supabase, input.campaignId, input.encounterId);
    if (input.action === "current" && before.initiativeState !== "active")
      throw new Error("Solicite e conclua as rolagens de iniciativa antes de definir o turno.");
    if (input.action === "request") {
      const { data: tokens, error: tokenError } = await supabase
        .from("scene_tokens")
        .select("actor_id,actors(id,character_id,name,actor_type,actor_combat_profiles(current_hp,maximum_hp,initiative_bonus,agility))")
        .eq("campaign_id", input.campaignId)
        .eq("scene_id", input.sceneId)
        .not("actor_id", "is", null);
      if (tokenError) throw new Error(tokenError.message);
      const roster = (tokens as unknown as Array<{
        actor_id: string;
        actors: {
          id: string; character_id: string | null; name: string; actor_type: string;
          actor_combat_profiles: { current_hp: number; maximum_hp: number; initiative_bonus: number; agility: number } | Array<{ current_hp: number; maximum_hp: number; initiative_bonus: number; agility: number }> | null;
        } | null;
      }>).flatMap((token) => token.actors ? [token.actors] : []);
      if (roster.length === 0) throw new Error("Insira personagens, NPCs ou inimigos no mapa antes de solicitar iniciativa.");
      const characterIds = roster.flatMap((actor) => actor.character_id ? [actor.character_id] : []);
      const [{ data: resources, error: resourcesError }, { data: attributes, error: attributesError }] = await Promise.all([
        characterIds.length
          ? supabase.from("character_resources").select("character_id,current_value,maximum_value").in("character_id", characterIds).eq("resource", "pv")
          : Promise.resolve({ data: [], error: null }),
        characterIds.length
          ? supabase.from("character_attributes").select("character_id,agility").in("character_id", characterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (resourcesError) throw new Error(resourcesError.message);
      if (attributesError) throw new Error(attributesError.message);
      const resourcesByCharacter = new Map((resources ?? []).map((value) => [value.character_id, value]));
      const agilityByCharacter = new Map((attributes ?? []).map((value) => [value.character_id, value.agility]));
      const { error: deleteError } = await supabase.from("encounter_combatants").delete().eq("encounter_id", input.encounterId).eq("campaign_id", input.campaignId);
      if (deleteError) throw new Error(deleteError.message);
      const rows = roster.map((actor, position) => {
        const rawProfile = actor.actor_combat_profiles;
        const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
        const resource = actor.character_id ? resourcesByCharacter.get(actor.character_id) : null;
        const kind = actor.actor_type === "player_character"
          ? "character"
          : actor.actor_type === "npc" || actor.actor_type === "narrator"
            ? "npc"
            : "enemy";
        return {
          campaign_id: input.campaignId,
          encounter_id: input.encounterId,
          character_id: actor.character_id,
          actor_id: actor.id,
          display_name: actor.name,
          kind,
          initiative: null,
          position,
          current_hp: resource?.current_value ?? profile?.current_hp ?? null,
          maximum_hp: resource?.maximum_value ?? profile?.maximum_hp ?? null,
          hidden_hp: kind !== "character",
          visible_state: "Aguardando iniciativa",
          initiative_bonus: profile?.initiative_bonus ?? 0,
          agility: actor.character_id ? (agilityByCharacter.get(actor.character_id) ?? 0) : (profile?.agility ?? 0),
        };
      });
      const { data: inserted, error: insertError } = await supabase.from("encounter_combatants").insert(rows).select("id,character_id");
      if (insertError) throw new Error(insertError.message);
      const { error: encounterUpdateError } = await supabase.from("encounters").update({
        initiative_state: "requested",
        initiative_requested_at: new Date().toISOString(),
        current_turn_position: null,
        round: 0,
      }).eq("id", input.encounterId).eq("campaign_id", input.campaignId);
      if (encounterUpdateError) throw new Error(encounterUpdateError.message);
      await supabase.from("roll_requests").update({ status: "revoked" }).eq("encounter_id", input.encounterId).eq("request_kind", "initiative").eq("status", "pending");
      for (const member of inserted ?? []) {
        if (!member.character_id) continue;
        const { data: requestId, error: requestError } = await supabase.rpc("request_character_check", {
          p_campaign_id: input.campaignId,
          p_session_id: input.sessionId,
          p_character_id: member.character_id,
          p_attribute_key: "agi",
          p_skill_name: "Iniciativa",
          p_difficulty: 0,
          p_context: "O mestre solicitou a iniciativa do combate.",
          p_consequences: "O resultado define a ordem de turnos.",
          p_favorable_dice: 0,
          p_unfavorable_dice: 0,
          p_numeric_modifier: 0,
          p_method: "roll",
          p_actor_user_id: user.id,
          p_idempotency_key: crypto.randomUUID(),
        });
        if (requestError) throw new Error(requestError.message);
        const { error: linkError } = await supabase.from("roll_requests").update({
          request_kind: "initiative",
          encounter_id: input.encounterId,
          encounter_combatant_id: member.id,
        }).eq("id", requestId);
        if (linkError) throw new Error(linkError.message);
      }
    } else if (input.action === "roll_actor") {
      const admin = createAdminClient();
      const { data: member, error: memberError } = await admin
        .from("encounter_combatants")
        .select("id,actor_id,display_name,initiative_bonus,agility")
        .eq("id", input.combatantId)
        .eq("encounter_id", input.encounterId)
        .eq("campaign_id", input.campaignId)
        .single();
      if (memberError) throw new Error(memberError.message);
      if (!member.actor_id) throw new Error("Este combatente deve rolar pela conta vinculada ao personagem.");
      const modifier = Number(member.initiative_bonus ?? 0);
      const result = executeDiceRoll(`1d20${modifier >= 0 ? "+" : ""}${modifier}`);
      const { error: rollError } = await admin.from("dice_rolls").insert({
        campaign_id: input.campaignId,
        session_id: input.sessionId,
        actor_id: member.actor_id,
        user_id: user.id,
        roller_display_name: member.display_name,
        formula: result.normalized,
        rolls: result.rolls,
        kept_indexes: result.keptIndexes,
        modifier: result.modifier,
        total: result.total,
        purpose: "Iniciativa",
        visibility: "session",
      });
      if (rollError) throw new Error(rollError.message);
      const { error: memberUpdateError } = await admin.from("encounter_combatants").update({ initiative: result.total, visible_state: "Pronto" }).eq("id", member.id);
      if (memberUpdateError) throw new Error(memberUpdateError.message);
    } else if (input.action === "add") {
      const maximumHp = Math.max(1, input.maximumHp);
      const { error } = await supabase.from("encounter_combatants").insert({
        campaign_id: input.campaignId,
        encounter_id: input.encounterId,
        character_id: input.characterId ?? null,
        actor_id: null,
        display_name: input.name,
        kind: input.kind,
        initiative: input.initiative,
        position: 9999,
        current_hp: Math.min(input.currentHp, maximumHp),
        maximum_hp: maximumHp,
        hidden_hp: input.hiddenHp,
        visible_state: input.visibleState || "Ativo",
      });
      if (error) throw new Error(error.message);
    } else if (input.action === "update") {
      const { error } = await supabase
        .from("encounter_combatants")
        .update({ initiative: input.initiative })
        .eq("id", input.combatantId)
        .eq("encounter_id", input.encounterId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
    } else if (input.action === "remove") {
      const { error } = await supabase
        .from("encounter_combatants")
        .delete()
        .eq("id", input.combatantId)
        .eq("encounter_id", input.encounterId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
    } else if (input.action === "hp") {
      const maximumHp = Math.max(1, input.maximumHp);
      const { error } = await supabase
        .from("encounter_combatants")
        .update({
          current_hp: Math.min(input.currentHp, maximumHp),
          maximum_hp: maximumHp,
          hidden_hp: input.hiddenHp,
          visible_state: input.visibleState || "Ativo",
        })
        .eq("id", input.combatantId)
        .eq("encounter_id", input.encounterId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
    }
    const combatentes = await normalizeOrder(supabase, input.campaignId, input.encounterId);
    if ((input.action === "roll_actor" || input.action === "update") && combatentes.length > 0 && combatentes.every((item) => item.iniciativa !== null)) {
      const { error } = await supabase.from("encounters").update({ initiative_state: "active", current_turn_position: 0, round: 1 }).eq("id", input.encounterId).eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
      combatentes.forEach((item, index) => { item.atual = index === 0; });
    }
    if (input.action === "current") {
      const selected = combatentes.find((item) => item.id === input.combatantId);
      if (!selected) throw new Error("Combatente não encontrado.");
      const { error } = await supabase
        .from("encounters")
        .update({ current_turn_position: selected.posicao })
        .eq("id", input.encounterId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
      combatentes.forEach((item) => {
        item.atual = item.id === selected.id;
      });
    }
    const { error: auditError } = await supabase.from("audit_events").insert({
      campaign_id: input.campaignId,
      session_id: before.sessionId,
      encounter_id: input.encounterId,
      actor_user_id: user.id,
      entity_type: "encounter",
      entity_id: input.encounterId,
      event_type: `initiative_${input.action}`,
      visibility: "gm_only",
      before_data: { combatants: before.combatants, turnPosition: before.turnPosition },
      after_data: {
        combatants: combatentes,
        ...(input.action === "hp" ? { reason: input.reason } : {}),
      },
      idempotency_key: crypto.randomUUID(),
    });
    if (auditError) throw new Error(auditError.message);
    return NextResponse.json({ combatentes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar a iniciativa." },
      { status: 400 },
    );
  }
}
