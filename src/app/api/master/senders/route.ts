import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  senderType: z.enum(["master", "system", "npc", "entity", "unknown", "custom"]),
  notificationLabel: z.string().trim().min(2).max(120),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  effect: z.enum(["terminal", "estática", "pulso", "falha", "nenhum"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) {
      return NextResponse.json({ id: crypto.randomUUID(), demo: true }, { status: 201 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("message_sender_profiles")
      .insert({
        campaign_id: input.campaignId,
        name: input.name,
        sender_type: input.senderType,
        notification_label: input.notificationLabel,
        visual_style: { color: input.color, effect: input.effect },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Remetente inválido." },
      { status: 400 },
    );
  }
}
