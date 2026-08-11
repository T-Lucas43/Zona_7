import { NextResponse } from "next/server";
import { z } from "zod";
import { sendMessage } from "@/server/services/message-service";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  apparentSenderName: z.string().trim().min(1).max(100),
  recipientUserIds: z.array(z.string().min(2)).min(1),
  body: z.string().trim().min(1).max(20_000),
  format: z.enum(["text", "audio", "image", "choice"]).default("text"),
  visibility: z.enum(["selected", "gm_only"]).default("selected"),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const result = await sendMessage({ ...input, idempotencyKey: crypto.randomUUID() }, user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mensagem inválida." },
      { status: 400 },
    );
  }
}
