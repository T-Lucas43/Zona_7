import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { reportHelpIssue } from "@/server/services/rules-service";

const schema = z.object({ campaignId: z.uuid(), articleId: z.uuid(), message: z.string().trim().min(3).max(2000) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const id = user.demo ? crypto.randomUUID() : await reportHelpIssue({ ...input, actorUserId: user.id });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relato inválido." }, { status: 400 });
  }
}

