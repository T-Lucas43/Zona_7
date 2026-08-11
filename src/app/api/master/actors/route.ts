import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    campaignId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    actorType: z.enum(["npc", "entity", "environment", "threat", "narrator"]),
    description: z.string().trim().max(2_000),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    visibility: z.enum(["campaign", "gm_only"]),
  }),
  z.object({
    action: z.literal("archive"),
    campaignId: z.string().uuid(),
    actorId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("restore"),
    campaignId: z.string().uuid(),
    actorId: z.string().uuid(),
  }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured)
      return NextResponse.json(
        { id: "actorId" in input ? input.actorId : crypto.randomUUID(), demo: true },
        { status: input.action === "create" ? 201 : 200 },
      );
    const supabase = await createClient();
    if (input.action === "create") {
      const { data, error } = await supabase
        .from("actors")
        .insert({
          campaign_id: input.campaignId,
          name: input.name,
          actor_type: input.actorType,
          public_description: input.description,
          color: input.color,
          visibility: input.visibility,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await supabase.from("actor_controllers").insert({
        campaign_id: input.campaignId,
        actor_id: data.id,
        user_id: user.id,
        control_level: "full",
        granted_by: user.id,
      });
      return NextResponse.json(data, { status: 201 });
    }
    const { error } = await supabase
      .from("actors")
      .update(
        input.action === "archive"
          ? { state: "archived", deleted_at: new Date().toISOString() }
          : { state: "active", deleted_at: null },
      )
      .eq("id", input.actorId)
      .eq("campaign_id", input.campaignId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ator inválido." },
      { status: 400 },
    );
  }
}
