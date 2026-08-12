import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({ campaignId: z.uuid(), sessionId: z.uuid(), sceneId: z.uuid(), enabled: z.boolean() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_session_scene_sync", {
      p_campaign_id: input.campaignId,
      p_session_id: input.sessionId,
      p_scene_id: input.sceneId,
      p_enabled: input.enabled,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sincronização inválida." }, { status: 400 });
  }
}
