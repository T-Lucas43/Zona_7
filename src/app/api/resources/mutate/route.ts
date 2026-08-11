import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isMasterRole } from "@/lib/permissions/visibility";
import { mutateResource } from "@/server/services/resource-service";

export async function POST(request: Request) {
  const user = await getCurrentUser("master");
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isMasterRole(user.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  try {
    const input = await request.json();
    if (user.demo)
      return NextResponse.json({ demo: true, eventId: crypto.randomUUID() }, { status: 201 });
    return NextResponse.json(await mutateResource(input, user.id), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operação inválida." },
      { status: 400 },
    );
  }
}
