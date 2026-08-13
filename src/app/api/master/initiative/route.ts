import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sortInitiativeCombatants } from "@/lib/initiative";
import { requireCampaignMaster } from "@/server/services/master-access";

const combatant = {
  campaignId: z.uuid(),
  encounterId: z.uuid(),
};

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    ...combatant,
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["character", "ally", "npc", "enemy"]),
    initiative: z.number().int().min(-100).max(999).nullable(),
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
      .select("id,display_name,kind,initiative,position,initiative_bonus,agility")
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
    nome: item.display_name,
    tipo: item.kind,
    iniciativa: item.initiative,
    posicao: position,
    atual: position === currentPosition,
  }));
}

async function snapshotInitiative(supabase: SupabaseClient, campaignId: string, encounterId: string) {
  const [{ data: encounter, error: encounterError }, { data, error }] = await Promise.all([
    supabase.from("encounters").select("current_turn_position,session_id").eq("id", encounterId).eq("campaign_id", campaignId).single(),
    supabase.from("encounter_combatants").select("id,character_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state,actions_state,private_notes,initiative_bonus,agility").eq("encounter_id", encounterId).eq("campaign_id", campaignId).order("position"),
  ]);
  if (encounterError) throw new Error(encounterError.message);
  if (error) throw new Error(error.message);
  return { combatants: data, turnPosition: encounter.current_turn_position, sessionId: encounter.session_id as string | null };
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
    if (input.action === "add") {
      const { error } = await supabase.from("encounter_combatants").insert({
        campaign_id: input.campaignId,
        encounter_id: input.encounterId,
        display_name: input.name,
        kind: input.kind,
        initiative: input.initiative,
        position: 9999,
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
    }
    const combatentes = await normalizeOrder(supabase, input.campaignId, input.encounterId);
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
      after_data: { combatants: combatentes },
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
