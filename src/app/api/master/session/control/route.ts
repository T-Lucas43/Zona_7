import { NextResponse } from "next/server";
import { sessionControlSchema } from "@/lib/validation/schemas";
import { endSession, pauseSession, startSession } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";

export async function POST(request: Request) {
  try {
    const input = sessionControlSchema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ demo: true, status: input.action });
    const result = input.action === "end"
      ? await endSession(input.sessionId)
      : input.action === "pause"
        ? await pauseSession(input.sessionId)
        : await startSession(input.sessionId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Controle inválido." }, { status: 400 });
  }
}
