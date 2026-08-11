import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  tokenId: z.string().uuid(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  reason: z.string().trim().min(2).max(300),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) return NextResponse.json({ x: input.x, y: input.y, demo: true });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("move_scene_token", {
      p_token_id: input.tokenId,
      p_x: input.x,
      p_y: input.y,
      p_reason: input.reason,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Movimento inválido." },
      { status: 400 },
    );
  }
}
