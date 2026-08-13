import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCampaignMaster } from "@/server/services/master-access";
import { publishHelpArticle } from "@/server/services/rules-service";

const schema = z.object({ campaignId: z.uuid(), articleId: z.uuid(), title: z.string().trim().min(3).max(160), summary: z.string().trim().min(3).max(1000), content: z.string().trim().min(3).max(30000), keywords: z.array(z.string().trim().min(1).max(80)).max(30), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ version: 1, demo: true });
    return NextResponse.json(await publishHelpArticle({ ...input, actorUserId: user.id }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Artigo inválido." }, { status: 400 });
  }
}

