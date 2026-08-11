import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { spendAbilityCost } from "@/server/services/domain-service";

const schema = z.object({
  characterAbilityId: z.string().min(2).max(100),
  resolvedCosts: z.partialRecord(
    z.enum(["pv", "pe", "san"]),
    z.number().int().nonnegative().max(999),
  ),
  sessionId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json(
        { error: "Entre na sua conta para usar a habilidade." },
        { status: 401 },
      );
    const result = await spendAbilityCost({
      characterAbilityId: input.characterAbilityId,
      actorUserId: user.id,
      resolvedCosts: input.resolvedCosts,
      sessionId: input.sessionId,
      idempotencyKey: input.idempotencyKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível usar a habilidade." },
      { status: 400 },
    );
  }
}
