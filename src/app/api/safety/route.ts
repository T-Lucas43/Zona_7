import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSafetyEvent } from "@/server/services/rules-service";

const schema = z.object({ campaignId: z.uuid(), sessionId: z.uuid(), tool: z.enum(["pause","cut","rewind","open_door","check_in","debrief"]), privateToMaster: z.boolean().default(true) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const id = user.demo ? crypto.randomUUID() : await createSafetyEvent({ ...input, actorUserId: user.id });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ferramenta inválida." }, { status: 400 });
  }
}

