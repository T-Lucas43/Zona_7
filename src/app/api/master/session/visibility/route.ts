import { NextResponse } from "next/server";
import { setSessionCharacterVisibility } from "@/server/services/live-hub-service";
import { requireCampaignMaster } from "@/server/services/master-access";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { campaignId?: string };
    if (!input.campaignId) throw new Error("Campanha obrigatória.");
    const user = await requireCampaignMaster(input.campaignId);
    return NextResponse.json(await setSessionCharacterVisibility(input, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Visibilidade inválida." },
      { status: 400 },
    );
  }
}
