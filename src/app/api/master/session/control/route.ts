import { NextResponse } from "next/server";
import { sessionControlSchema } from "@/lib/validation/schemas";
import { advanceSessionTurnSynced, controlSessionRuntime } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";

export async function POST(request: Request) {
  try {
    const input = sessionControlSchema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ demo: true, status: input.action });
    let result;
    if (input.action === "advance") {
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
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Controle inválido." }, { status: 400 });
  }
}
