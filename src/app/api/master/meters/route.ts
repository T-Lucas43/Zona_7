import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  characterId: z.string().min(2),
  delta: z.number().int().min(-5).max(5),
  targetValue: z.number().int().min(0).max(20).nullable(),
  reason: z.string().trim().min(2).max(500),
  playerVisibleReason: z.string().trim().max(500).nullable(),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured)
      return NextResponse.json({
        after: input.targetValue ?? Math.max(0, input.delta),
        demo: true,
      });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mutate_character_meter", {
      p_character_id: input.characterId,
      p_delta: input.delta,
      p_target_value: input.targetValue,
      p_reason: input.reason,
      p_player_visible_reason: input.playerVisibleReason,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Alteração inválida." },
      { status: 400 },
    );
  }
}
