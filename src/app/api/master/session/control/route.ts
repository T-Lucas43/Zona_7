import { NextResponse } from "next/server";
import { sessionControlSchema } from "@/lib/validation/schemas";
import { advanceSessionTurnSynced, controlSessionRuntime } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";
import { generateAutomaticSessionSummary } from "@/server/services/session-summary-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const input = sessionControlSchema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({
      demo: true,
      status: input.action === "pause" ? "paused" : input.action === "end" ? "ended" : "active",
      elapsedSeconds: 0,
      timerStartedAt: ["start", "resume", "reopen", "restart"].includes(input.action) ? new Date().toISOString() : null,
    });
    let result;
    if (input.action === "advance") {
      const supabase = await createClient();
      const { data: encounter, error } = await supabase.from("encounters").select("initiative_state").eq("campaign_id", input.campaignId).eq("session_id", input.sessionId).in("status", ["active", "paused"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!encounter || encounter.initiative_state !== "active") throw new Error("Solicite e conclua a iniciativa antes de avançar o turno.");
      result = await advanceSessionTurnSynced({
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        actorUserId: user.id,
        idempotencyKey: crypto.randomUUID(),
      });
    } else {
      result = await controlSessionRuntime({
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        actorUserId: user.id,
        action: input.action,
        idempotencyKey: crypto.randomUUID(),
      });
    }
    if (input.action === "end") {
      const summary = await generateAutomaticSessionSummary({ campaignId: input.campaignId, sessionId: input.sessionId, actorUserId: user.id });
      return NextResponse.json({ ...(result as Record<string, unknown>), summaryRevision: summary.revision });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Controle inválido." }, { status: 400 });
  }
}
