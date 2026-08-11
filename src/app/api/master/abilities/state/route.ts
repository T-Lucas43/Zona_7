import { NextResponse } from "next/server";
import { z } from "zod";
import { unlockAbility } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  characterAbilityId: z.string().min(2),
  state: z.enum(["sealed", "masked", "discovered", "unlocked", "altered", "disabled", "lost"]),
  reason: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const result = await unlockAbility({
      characterAbilityId: input.characterAbilityId,
      actorUserId: user.id,
      state: input.state,
      reason: input.reason,
      idempotencyKey: crypto.randomUUID(),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Estado inválido." },
      { status: 400 },
    );
  }
}
