import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(), sceneId: z.uuid(), actorId: z.uuid(), action: z.enum(["hide", "show", "remove"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("manage_scene_actor", {
      p_campaign_id: input.campaignId,
      p_scene_id: input.sceneId,
      p_actor_id: input.actorId,
      p_action: input.action,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ação inválida." }, { status: 400 });
  }
}
