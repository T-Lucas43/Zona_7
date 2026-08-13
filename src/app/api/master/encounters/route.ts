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
      .select("id,name,status,round,current_turn_position,gm_notes")
      .single();
    if (error) throw new Error(error.message);
    if (input.action === "create" && input.sessionId) {
      const { data: participants, error: participantsError } = await supabase
        .from("session_participants")
        .select("character_id,characters(name)")
        .eq("campaign_id", input.campaignId)
        .eq("session_id", input.sessionId)
        .eq("status", "online")
        .not("character_id", "is", null);
      if (participantsError) throw new Error(participantsError.message);
      const initialCombatants = (participants ?? []).flatMap((participant, position) => {
        const related = Array.isArray(participant.characters)
          ? participant.characters[0]
          : participant.characters;
        return related?.name && participant.character_id
          ? [
              {
                campaign_id: input.campaignId,
                encounter_id: data.id,
                character_id: participant.character_id,
                display_name: related.name,
                kind: "character" as const,
                position,
              },
            ]
          : [];
      });
      if (initialCombatants.length > 0) {
        const { error: insertError } = await supabase
          .from("encounter_combatants")
          .insert(initialCombatants);
        if (insertError) throw new Error(insertError.message);
      }
    }
    const { data: combatantRows, error: combatantError } = await supabase
      .from("encounter_combatants")
      .select("id,display_name,kind,initiative,position")
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
          combatentes: combatantRows.map((combatente) => ({
            id: combatente.id,
            nome: combatente.display_name,
            tipo: combatente.kind,
            iniciativa: combatente.initiative,
            posicao: combatente.position,
            atual: combatente.position === data.current_turn_position,
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
