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
});

const schema = z.discriminatedUnion("action", [
  encounterFields.extend({ action: z.literal("create"), campaignId: z.uuid() }),
  encounterFields.extend({
    action: z.literal("update"),
    campaignId: z.uuid(),
    encounterId: z.uuid(),
  }),
  z.object({ action: z.literal("delete"), campaignId: z.uuid(), encounterId: z.uuid() }),
]);

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
    const { data: combatantRows, error: combatantError } = await supabase
      .from("encounter_combatants")
      .select("id,character_id,actor_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state")
      .eq("encounter_id", data.id)
      .eq("campaign_id", input.campaignId)
      .order("position");
    if (combatantError) throw new Error(combatantError.message);
    return NextResponse.json(
      {
        item: {
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
        },
      },
      { status: input.action === "create" ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Encontro inválido." },
      { status: 400 },
    );
  }
}
