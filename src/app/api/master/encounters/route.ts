import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const encounterFields = z.object({
  name: z.string().trim().min(2).max(160),
  status: z.enum(["draft", "active", "paused", "ended"]),
  round: z.number().int().min(0).max(9999),
  notes: z.string().trim().max(20_000),
});

const schema = z.discriminatedUnion("action", [
  encounterFields.extend({ action: z.literal("create"), campaignId: z.uuid() }),
  encounterFields.extend({ action: z.literal("update"), campaignId: z.uuid(), encounterId: z.uuid() }),
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
    };
    const query = input.action === "create"
      ? supabase.from("encounters").insert({ campaign_id: input.campaignId, ...values })
      : supabase.from("encounters").update(values).eq("id", input.encounterId).eq("campaign_id", input.campaignId);
    const { data, error } = await query.select("id,name,status,round,gm_notes").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({
      item: {
        id: data.id,
        nome: data.name,
        estado: data.status,
        rodada: data.round,
        participantes: 0,
        observacoes: data.gm_notes ?? "",
      },
    }, { status: input.action === "create" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Encontro inválido." },
      { status: 400 },
    );
  }
}
