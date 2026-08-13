import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCampaignMaster } from "@/server/services/master-access";
import { applyRuleOverride } from "@/server/services/rules-service";

const schema = z.object({ campaignId: z.uuid(), ruleDefinitionId: z.uuid(), payload: z.record(z.string(), z.unknown()), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ version: 1, demo: true });
    return NextResponse.json(await applyRuleOverride({ ...input, actorUserId: user.id }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Regra inválida." }, { status: 400 });
  }
}

