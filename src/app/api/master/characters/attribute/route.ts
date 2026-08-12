import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(), characterId: z.uuid(), attribute: z.enum(["agi", "for", "int", "pre", "vig"]),
  value: z.number().int().min(0).max(20), reason: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("adjust_character_attribute", {
      p_campaign_id: input.campaignId, p_character_id: input.characterId, p_attribute: input.attribute,
      p_value: input.value, p_actor_user_id: user.id, p_reason: input.reason, p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Atributo inválido." }, { status: 400 });
  }
}
