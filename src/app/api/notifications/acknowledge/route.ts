import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { acknowledgeNotification } from "@/server/services/domain-service";
import { getAuthorizedNotifications } from "@/server/repositories/character-repository";

const schema = z.object({ notificationId: z.uuid() });

export async function GET() {
  try {
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    return NextResponse.json({ items: await getAuthorizedNotifications() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar notificações." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const { notificationId } = schema.parse(await request.json());
    return NextResponse.json(await acknowledgeNotification(notificationId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notificação inválida." },
      { status: 400 },
    );
  }
}
