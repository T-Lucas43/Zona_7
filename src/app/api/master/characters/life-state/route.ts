import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(), characterId: z.uuid(), state: z.enum(["active", "dying", "dead"]), reason: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("set_character_life_state", {
      p_campaign_id: input.campaignId, p_character_id: input.characterId, p_state: input.state,
      p_actor_user_id: user.id, p_reason: input.reason, p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Estado inválido." }, { status: 400 });
  }
}
