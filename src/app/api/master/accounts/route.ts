import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    campaignId: z.uuid(),
    memberId: z.string().min(2),
    email: z.email(),
    action: z.enum(["reset", "suspend", "activate"]),
  }),
  z.object({
    campaignId: z.uuid(),
    memberId: z.string().min(2),
    userId: z.uuid(),
    characterId: z.string().min(2).max(100).nullable(),
    action: z.literal("assign"),
  }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const master = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) return NextResponse.json({ ok: true, characterId: "characterId" in input ? input.characterId : undefined, demo: true });

    if (input.action === "reset") {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo: `${appConfig.appUrl}/reset-password`,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "assign") {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("assign_character_to_user", {
        p_campaign_id: input.campaignId,
        p_member_id: input.memberId,
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_actor_user_id: master.id,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    const status = input.action === "suspend" ? "suspended" : "active";
    const supabase = await createClient();
    const { error } = await supabase
      .from("campaign_members")
      .update({ status })
      .eq("id", input.memberId)
      .eq("campaign_id", input.campaignId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ação inválida." },
      { status: 400 },
    );
  }
}
