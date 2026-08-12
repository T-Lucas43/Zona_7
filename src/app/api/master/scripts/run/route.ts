import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";
import { getScriptRunSnapshot } from "@/server/repositories/script-repository";

const schema = z.object({
  campaignId: z.string().uuid(),
  sessionId: z.string().uuid(),
  action: z.enum(["start", "advance", "pause", "resume", "improvise", "complete"]),
  scriptPackageId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  targetNodeKey: z.string().min(2).max(80).optional(),
  reason: z.string().trim().min(2).max(500),
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (input.action === "start" && !input.scriptPackageId)
      throw new Error("Escolha um roteiro publicado.");
    if (input.action !== "start" && !input.runId) throw new Error("Inicie a execução primeiro.");
    if (!isSupabaseConfigured)
      return NextResponse.json({
        runId: input.runId ?? crypto.randomUUID(),
        status:
          input.action === "pause"
            ? "paused"
            : input.action === "improvise"
              ? "improvising"
              : input.action === "complete"
                ? "completed"
                : "running",
        currentNodeKey: input.targetNodeKey,
        demo: true,
      });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("control_session_script_run", {
      p_campaign_id: input.campaignId,
      p_session_id: input.sessionId,
      p_actor_user_id: user.id,
      p_action: input.action,
      p_script_package_id: input.scriptPackageId ?? null,
      p_run_id: input.runId ?? null,
      p_target_stable_key: input.targetNodeKey ?? null,
      p_reason: input.reason,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    const result = data as { runId?: string };
    const snapshot = result.runId ? await getScriptRunSnapshot(result.runId) : null;
    return NextResponse.json(snapshot ? { ...data, ...snapshot } : data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha no controle do roteiro." },
      { status: 400 },
    );
  }
}
