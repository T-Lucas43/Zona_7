import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  characterId: z.string().min(2),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(20_000),
  visibility: z.enum(["gm_only", "owner_only", "campaign"]),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured)
      return NextResponse.json({ id: crypto.randomUUID(), demo: true }, { status: 201 });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("character_notes")
      .insert({
        campaign_id: input.campaignId,
        character_id: input.characterId,
        note_type: "narrative",
        title: input.title,
        body: input.body,
        visibility: input.visibility,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_events").insert({
      campaign_id: input.campaignId,
      actor_user_id: user.id,
      entity_type: "character_note",
      entity_id: data.id,
      event_type: "note_created",
      visibility: input.visibility,
      after_data: { title: input.title },
      idempotency_key: crypto.randomUUID(),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nota inválida." },
      { status: 400 },
    );
  }
}
