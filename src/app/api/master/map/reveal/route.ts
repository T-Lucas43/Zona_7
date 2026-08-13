import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const path = z.object({
  id: z.string().min(1).max(100),
  tool: z.enum(["cover", "erase"]),
  size: z.number().min(0.005).max(0.5),
  points: z.array(point).min(1).max(2_000),
});
const schema = z.object({
  campaignId: z.uuid(),
  sessionId: z.uuid(),
  sceneId: z.uuid(),
  enabled: z.boolean(),
  synchronized: z.boolean(),
  paths: z.array(path).max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ version: 1, ...input, demo: true });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_scene_reveal_state", {
      p_campaign_id: input.campaignId,
      p_session_id: input.sessionId,
      p_scene_id: input.sceneId,
      p_enabled: input.enabled,
      p_synchronized: input.synchronized,
      p_paths: input.paths,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar a revelação do mapa." },
      { status: 400 },
    );
  }
}
