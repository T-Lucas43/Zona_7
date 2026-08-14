import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const encounterFields = z.object({
  name: z.string().trim().min(2).max(160),
  status: z.enum(["draft", "active", "paused", "ended"]),
  round: z.number().int().min(0).max(9999),
  notes: z.string().trim().max(20_000),
  sessionId: z.uuid().nullable().optional(),
  actorIds: z.array(z.uuid()).max(100).optional(),
});

const schema = z.discriminatedUnion("action", [
  encounterFields.extend({ action: z.literal("create"), campaignId: z.uuid() }),
  encounterFields.extend({
    action: z.literal("update"),
    campaignId: z.uuid(),
    encounterId: z.uuid(),
  }),
  z.object({
    action: z.literal("set_actor"),
    campaignId: z.uuid(),
    encounterId: z.uuid(),
    actorId: z.uuid(),
    linked: z.boolean(),
  }),
  z.object({ action: z.literal("delete"), campaignId: z.uuid(), encounterId: z.uuid() }),
]);

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function encounterKind(actorType: string): "ally" | "npc" | "enemy" {
  if (actorType === "narrator") return "ally";
  if (actorType === "npc") return "npc";
  return "enemy";
}

async function normalizeEncounterPositions(
  supabase: SupabaseClient,
  campaignId: string,
  encounterId: string,
) {
  const [{ data: encounter, error: encounterError }, { data: combatants, error: combatantsError }] =
    await Promise.all([
      supabase
        .from("encounters")
        .select("current_turn_position")
        .eq("campaign_id", campaignId)
        .eq("id", encounterId)
        .single(),
      supabase
        .from("encounter_combatants")
        .select("id,position")
        .eq("campaign_id", campaignId)
        .eq("encounter_id", encounterId)
        .order("position"),
    ]);
  if (encounterError) throw new Error(encounterError.message);
  if (combatantsError) throw new Error(combatantsError.message);
  const currentId = (combatants ?? []).find(
    (combatant) => combatant.position === encounter.current_turn_position,
  )?.id;
  const updates = await Promise.all(
    (combatants ?? []).map((combatant, position) =>
      supabase
        .from("encounter_combatants")
        .update({ position })
        .eq("campaign_id", campaignId)
        .eq("id", combatant.id),
    ),
  );
  const updateError = updates.find((result) => result.error)?.error;
  if (updateError) throw new Error(updateError.message);
  const currentPosition = currentId
    ? (combatants ?? []).findIndex((combatant) => combatant.id === currentId)
    : null;
  const { error: turnError } = await supabase
    .from("encounters")
    .update({ current_turn_position: currentPosition === -1 ? null : currentPosition })
    .eq("campaign_id", campaignId)
    .eq("id", encounterId);
  if (turnError) throw new Error(turnError.message);
}

async function getLinkedNonPlayerActorIds(
  supabase: SupabaseClient,
  campaignId: string,
  encounterId: string,
) {
  const { data: links, error: linksError } = await supabase
    .from("encounter_combatants")
    .select("id,actor_id")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .not("actor_id", "is", null);
  if (linksError) throw new Error(linksError.message);
  const actorIds = [...new Set((links ?? []).flatMap((item) => item.actor_id ? [item.actor_id] : []))];
  if (actorIds.length === 0) return { ids: [] as string[], combatantIds: new Map<string, string>() };
  const { data: actors, error: actorsError } = await supabase
    .from("actors")
    .select("id,actor_type")
    .eq("campaign_id", campaignId)
    .in("id", actorIds)
    .is("deleted_at", null);
  if (actorsError) throw new Error(actorsError.message);
  const nonPlayerIds = new Set(
    (actors ?? []).filter((actor) => actor.actor_type !== "player_character").map((actor) => actor.id),
  );
  return {
    ids: [...nonPlayerIds],
    combatantIds: new Map(
      (links ?? []).flatMap((item) => item.actor_id && nonPlayerIds.has(item.actor_id)
        ? [[item.actor_id, item.id] as const]
        : []),
    ),
  };
}

async function syncEncounterActors(
  supabase: SupabaseClient,
  campaignId: string,
  encounterId: string,
  requestedActorIds: string[],
) {
  const actorIds = [...new Set(requestedActorIds)];
  const linked = await getLinkedNonPlayerActorIds(supabase, campaignId, encounterId);
  const desired = new Set(actorIds);
  const removeIds = linked.ids
    .filter((actorId) => !desired.has(actorId))
    .flatMap((actorId) => linked.combatantIds.get(actorId) ? [linked.combatantIds.get(actorId)!] : []);
  if (removeIds.length > 0) {
    const { error } = await supabase
      .from("encounter_combatants")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("encounter_id", encounterId)
      .in("id", removeIds);
    if (error) throw new Error(error.message);
  }
  const addIds = actorIds.filter((actorId) => !linked.ids.includes(actorId));
  if (addIds.length === 0) {
    await normalizeEncounterPositions(supabase, campaignId, encounterId);
    return;
  }
  const { data: actors, error: actorsError } = await supabase
    .from("actors")
    .select("id,name,actor_type,actor_combat_profiles(current_hp,maximum_hp,initiative_bonus,agility)")
    .eq("campaign_id", campaignId)
    .in("id", addIds)
    .neq("actor_type", "player_character")
    .is("deleted_at", null);
  if (actorsError) throw new Error(actorsError.message);
  if ((actors ?? []).length !== addIds.length)
    throw new Error("Uma das entidades ou NPCs selecionados não pertence a esta campanha.");
  const { data: lastPosition, error: positionError } = await supabase
    .from("encounter_combatants")
    .select("position")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) throw new Error(positionError.message);
  const basePosition = Number(lastPosition?.position ?? -1) + 1;
  const rows = (actors ?? []).map((actor, index) => {
    const rawProfile = actor.actor_combat_profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    const kind = encounterKind(actor.actor_type);
    return {
      campaign_id: campaignId,
      encounter_id: encounterId,
      actor_id: actor.id,
      character_id: null,
      display_name: actor.name,
      kind,
      initiative: null,
      position: basePosition + index,
      current_hp: profile?.current_hp ?? null,
      maximum_hp: profile?.maximum_hp ?? null,
      hidden_hp: kind === "enemy",
      visible_state: "Vinculado ao encontro",
      initiative_bonus: profile?.initiative_bonus ?? 0,
      agility: profile?.agility ?? 0,
    };
  });
  const { error: insertError } = await supabase.from("encounter_combatants").insert(rows);
  if (insertError) throw new Error(insertError.message);
  await normalizeEncounterPositions(supabase, campaignId, encounterId);
}

async function loadEncounterItem(
  supabase: SupabaseClient,
  campaignId: string,
  encounterId: string,
) {
  const { data, error } = await supabase
    .from("encounters")
    .select("id,name,status,round,current_turn_position,gm_notes,initiative_state")
    .eq("id", encounterId)
    .eq("campaign_id", campaignId)
    .single();
  if (error) throw new Error(error.message);
  const { data: combatantRows, error: combatantError } = await supabase
    .from("encounter_combatants")
    .select("id,character_id,actor_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state")
    .eq("encounter_id", data.id)
    .eq("campaign_id", campaignId)
    .order("position");
  if (combatantError) throw new Error(combatantError.message);
  return {
    id: data.id,
    nome: data.name,
    estado: data.status,
    rodada: data.round,
    participantes: combatantRows.length,
    observacoes: data.gm_notes ?? "",
    turnoAtual: data.current_turn_position,
    iniciativaEstado: data.initiative_state ?? "idle",
    combatentes: combatantRows.map((combatente) => ({
      id: combatente.id,
      characterId: combatente.character_id,
      actorId: combatente.actor_id,
      nome: combatente.display_name,
      tipo: combatente.kind,
      iniciativa: combatente.initiative,
      posicao: combatente.position,
      atual: combatente.position === data.current_turn_position,
      pvAtual: combatente.current_hp,
      pvMaximo: combatente.maximum_hp,
      pvOculto: combatente.hidden_hp,
      estadoVisivel: combatente.visible_state ?? "Ativo",
    })),
  };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();

    if (input.action === "delete") {
      const { error } = await supabase
        .from("encounters")
        .delete()
        .eq("id", input.encounterId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true });
    }

    if (input.action === "set_actor") {
      const linked = await getLinkedNonPlayerActorIds(supabase, input.campaignId, input.encounterId);
      const nextActorIds = input.linked
        ? [...new Set([...linked.ids, input.actorId])]
        : linked.ids.filter((actorId) => actorId !== input.actorId);
      await syncEncounterActors(supabase, input.campaignId, input.encounterId, nextActorIds);
      return NextResponse.json({ item: await loadEncounterItem(supabase, input.campaignId, input.encounterId) });
    }

    const values = {
      name: input.name,
      status: input.status,
      round: input.round,
      gm_notes: input.notes || null,
      session_id: input.sessionId ?? null,
      started_at: input.status === "active" ? new Date().toISOString() : null,
      ended_at: input.status === "ended" ? new Date().toISOString() : null,
    };
    const query =
      input.action === "create"
        ? supabase.from("encounters").insert({ campaign_id: input.campaignId, ...values })
        : supabase
            .from("encounters")
            .update(values)
            .eq("id", input.encounterId)
            .eq("campaign_id", input.campaignId);
    const { data, error } = await query
      .select("id,name,status,round,current_turn_position,gm_notes,initiative_state")
      .single();
    if (error) throw new Error(error.message);
    if (input.actorIds) await syncEncounterActors(supabase, input.campaignId, data.id, input.actorIds);
    return NextResponse.json(
      { item: await loadEncounterItem(supabase, input.campaignId, data.id) },
      { status: input.action === "create" ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Encontro inválido." },
      { status: 400 },
    );
  }
}
