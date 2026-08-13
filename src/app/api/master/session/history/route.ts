import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(),
  sessionId: z.uuid(),
  eventId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ eventId: crypto.randomUUID(), demo: true });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reverse_session_event", {
      p_event_id: input.eventId,
      p_reason: input.reason,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível desfazer a ação." },
      { status: 400 },
    );
  }
}
