import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const position = {
  campaignId: z.uuid(),
  sceneId: z.string().min(2).max(100),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  visibleToPlayers: z.boolean().default(false),
};
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("actor"), ...position, actorId: z.string().min(2).max(100) }),
  z.object({ action: z.literal("item"), ...position, itemId: z.uuid() }),
  z.object({ action: z.literal("remove_item"), campaignId: z.uuid(), tokenId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const input = schema.parse({ ...raw, action: raw.action ?? "actor" });
    const master = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) {
      return NextResponse.json({ id: crypto.randomUUID(), ...input, demo: true }, { status: 201 });
    }
    const supabase = await createClient();
    if (input.action === "remove_item") {
      const { error } = await supabase
        .from("scene_tokens")
        .delete()
        .eq("id", input.tokenId)
        .eq("campaign_id", input.campaignId)
        .not("item_id", "is", null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ removed: true });
    }
    const result =
      input.action === "item"
        ? await supabase.rpc("add_item_to_scene", {
            p_campaign_id: input.campaignId,
            p_scene_id: input.sceneId,
            p_item_id: input.itemId,
            p_x: input.x,
            p_y: input.y,
            p_visible_to_players: input.visibleToPlayers,
            p_actor_user_id: master.id,
          })
        : await supabase.rpc("add_actor_to_scene", {
            p_campaign_id: input.campaignId,
            p_scene_id: input.sceneId,
            p_actor_id: input.actorId,
            p_x: input.x,
            p_y: input.y,
            p_visible_to_players: input.visibleToPlayers,
            p_actor_user_id: master.id,
          });
    const { data, error } = result;
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Não foi possível inserir o ator na cena.",
      },
      { status: 400 },
    );
  }
}
