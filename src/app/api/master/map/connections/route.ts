import { NextResponse } from "next/server";

const removedResponse = () =>
  NextResponse.json(
    { error: "A conexão entre tokens foi removida do mapa." },
    { status: 410 },
  );

export const GET = removedResponse;
export const POST = removedResponse;
export const DELETE = removedResponse;
