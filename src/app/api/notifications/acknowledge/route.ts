import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { acknowledgeNotification } from "@/server/services/domain-service";

const schema = z.object({ notificationId: z.uuid() });

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
