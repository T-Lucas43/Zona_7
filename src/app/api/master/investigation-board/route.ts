import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"), campaignId: z.uuid(), handoutId: z.uuid(),
    x: z.number().min(0).max(0.88), y: z.number().min(0).max(0.78),
    rotation: z.number().min(-8).max(8), zIndex: z.number().int().positive(),
    style: z.enum(["polaroid", "postit", "paper"]),
  }),
  z.object({
    action: z.literal("toggle_connection"), campaignId: z.uuid(),
    fromHandoutId: z.uuid(), toHandoutId: z.uuid(),
  }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) {
      return NextResponse.json(input.action === "move"
        ? { saved: true, demo: true }
        : { connected: true, id: crypto.randomUUID(), fromHandoutId: input.fromHandoutId, toHandoutId: input.toHandoutId, demo: true });
    }
    const supabase = await createClient();
    if (input.action === "move") {
      const { data: handout, error: handoutError } = await supabase.from("handouts")
        .select("id").eq("id", input.handoutId).eq("campaign_id", input.campaignId).is("deleted_at", null).maybeSingle();
      if (handoutError || !handout) throw new Error("Pista não encontrada nesta campanha.");
      const { error } = await supabase.from("investigation_board_items").upsert({
        campaign_id: input.campaignId, handout_id: input.handoutId, x: input.x, y: input.y,
        rotation: input.rotation, z_index: input.zIndex, display_style: input.style,
        updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "handout_id" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ saved: true });
    }
    if (input.fromHandoutId === input.toHandoutId) throw new Error("Escolha duas pistas diferentes.");
    const [fromHandoutId, toHandoutId] = [input.fromHandoutId, input.toHandoutId].sort();
    const { data: handouts, error: handoutsError } = await supabase.from("handouts")
      .select("id").eq("campaign_id", input.campaignId).in("id", [fromHandoutId, toHandoutId]).is("deleted_at", null);
    if (handoutsError || handouts.length !== 2) throw new Error("Uma das pistas não pertence à campanha.");
    const { data: existing, error: existingError } = await supabase.from("investigation_board_connections")
      .select("id").eq("campaign_id", input.campaignId).eq("from_handout_id", fromHandoutId).eq("to_handout_id", toHandoutId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { error } = await supabase.from("investigation_board_connections").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ connected: false, id: existing.id });
    }
    const { data, error } = await supabase.from("investigation_board_connections").insert({
      campaign_id: input.campaignId, from_handout_id: fromHandoutId,
      to_handout_id: toHandoutId, created_by: user.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ connected: true, id: data.id, fromHandoutId, toHandoutId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operação inválida no mural." }, { status: 400 });
  }
}
