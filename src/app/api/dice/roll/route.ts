import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rollDice } from "@/server/services/dice-service";

export async function POST(request: Request) {
  const user = await getCurrentUser("player");
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const result = await rollDice(await request.json(), user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rolagem inválida." },
      { status: 400 },
    );
  }
}
