import { NextResponse } from "next/server";
import { z } from "zod";
import { parseZona7Script } from "@/lib/scripts/zona7-parser";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  source: z.string().min(10).max(2_000_000),
  format: z.enum(["markdown", "json"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await requireCampaignMaster(input.campaignId);
    return NextResponse.json(parseZona7Script(input.source, input.format));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Roteiro inválido." },
      { status: 400 },
    );
  }
}
