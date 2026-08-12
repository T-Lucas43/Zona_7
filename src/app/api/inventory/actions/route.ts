import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { mutateInventoryItem } from "@/server/services/domain-service";

const schema = z.object({
  characterItemId: z.uuid(),
  action: z.enum(["use", "discard", "donate"]),
  targetCharacterId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(999).default(1),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    if (input.action === "donate" && !input.targetCharacterId)
      throw new Error("Escolha quem receberá o item.");
    return NextResponse.json(await mutateInventoryItem({ ...input, actorUserId: user.id }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ação de inventário inválida." },
      { status: 400 },
    );
  }
}
