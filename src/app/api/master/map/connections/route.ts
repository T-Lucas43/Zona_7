import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(), sceneId: z.uuid(), fromTokenId: z.uuid(), toTokenId: z.uuid(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (input.fromTokenId === input.toTokenId) throw new Error("Escolha dois tokens diferentes.");
    const [fromTokenId, toTokenId] = [input.fromTokenId, input.toTokenId].sort();
    if (!isSupabaseConfigured) return NextResponse.json({ connected: true, id: crypto.randomUUID(), fromTokenId, toTokenId, demo: true });
    const supabase = await createClient();
    const { data: tokens, error: tokenError } = await supabase.from("scene_tokens")
      .select("id").eq("campaign_id", input.campaignId).eq("scene_id", input.sceneId).in("id", [fromTokenId, toTokenId]);
    if (tokenError || tokens.length !== 2) throw new Error("Um dos tokens não pertence à cena ativa.");
    const { data: existing, error: existingError } = await supabase.from("scene_token_connections")
      .select("id").eq("scene_id", input.sceneId).eq("from_token_id", fromTokenId).eq("to_token_id", toTokenId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { error } = await supabase.from("scene_token_connections").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ connected: false, id: existing.id });
    }
    const { data, error } = await supabase.from("scene_token_connections").insert({
      campaign_id: input.campaignId, scene_id: input.sceneId, from_token_id: fromTokenId,
      to_token_id: toTokenId, created_by: user.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ connected: true, id: data.id, fromTokenId, toTokenId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conexão inválida no mapa." }, { status: 400 });
  }
}
