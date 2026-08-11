import { NextResponse } from "next/server";
import { createPlayableCharacter } from "@/server/services/live-hub-service";
import { requireCampaignMaster } from "@/server/services/master-access";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { campaignId?: string };
    if (!input.campaignId) throw new Error("Campanha obrigatória.");
    const user = await requireCampaignMaster(input.campaignId);
    return NextResponse.json(await createPlayableCharacter(input, user.id), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o personagem." },
      { status: 400 },
    );
  }
}
