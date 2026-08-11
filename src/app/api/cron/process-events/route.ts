import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueEvents } from "@/server/services/event-service";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await processDueEvents());
  } catch {
    return NextResponse.json({ error: "Falha ao processar eventos." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
