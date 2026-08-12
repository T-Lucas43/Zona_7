import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  campaignId: z.string().uuid(),
  sessionId: z.string().uuid(),
  characterId: z.string().uuid(),
  action: z.enum(["join", "heartbeat", "leave"]).default("heartbeat"),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!isAdminConfigured) throw new Error("Presença em tempo real indisponível no servidor.");

    const supabase = await createClient();
    const [sessionResult, ownerResult] = await Promise.all([
      supabase
        .from("sessions")
        .select("id")
        .eq("id", input.sessionId)
        .eq("campaign_id", input.campaignId)
        .maybeSingle(),
      supabase
        .from("character_owners")
        .select("id")
        .eq("campaign_id", input.campaignId)
        .eq("character_id", input.characterId)
        .eq("user_id", user.id)
        .not("confirmed_at", "is", null)
        .maybeSingle(),
    ]);
    if (sessionResult.error || !sessionResult.data) throw new Error("Sessão não autorizada.");
    if (ownerResult.error || !ownerResult.data) throw new Error("Personagem não vinculado a esta conta.");

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const status = input.action === "leave" ? "offline" : "online";
    const { error } = await admin.from("session_participants").upsert(
      {
        campaign_id: input.campaignId,
        session_id: input.sessionId,
        user_id: user.id,
        character_id: input.characterId,
        status,
        last_seen_at: now,
      },
      { onConflict: "session_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ status, lastSeenAt: now });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Presença inválida." },
      { status: 400 },
    );
  }
}
