import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
});

export async function POST(request: Request) {
  let sessionId: string | null = null;
  let gameSceneId: string | null = null;
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isAdminConfigured) {
      return NextResponse.json(
        { error: "O servidor não possui a credencial necessária para criar sessões." },
        { status: 503 },
      );
    }
    const admin = createAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({ campaign_id: input.campaignId, title: input.title, status: "draft" })
      .select("id")
      .single();
    if (sessionError) throw new Error(sessionError.message);
    sessionId = session.id;

    const [narrativeSceneResult, gameSceneResult] = await Promise.all([
      admin
        .from("session_scenes")
        .insert({
          campaign_id: input.campaignId,
          session_id: session.id,
          title: input.title,
          status: "pending",
          position: 0,
          public_summary: "",
        })
        .select("id")
        .single(),
      admin
        .from("game_scenes")
        .insert({
          campaign_id: input.campaignId,
          session_id: session.id,
          name: input.title,
          description: "",
          state: "draft",
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single(),
    ]);
    const sceneError = narrativeSceneResult.error ?? gameSceneResult.error;
    if (sceneError || !narrativeSceneResult.data || !gameSceneResult.data) {
      throw new Error(sceneError?.message ?? "Não foi possível criar as cenas da sessão.");
    }
    const narrativeScene = narrativeSceneResult.data;
    const gameScene = gameSceneResult.data;
    gameSceneId = gameScene.id;

    const [sessionUpdate, publicState, liveSession, audit] = await Promise.all([
      admin
        .from("sessions")
        .update({ current_scene_id: narrativeScene.id })
        .eq("id", session.id),
      admin.from("session_public_state").insert({
        session_id: session.id,
        campaign_id: input.campaignId,
        scene_title: input.title,
        public_summary: "",
        public_objective: "",
        updated_by: user.id,
      }),
      admin.from("live_sessions").insert({
        campaign_id: input.campaignId,
        session_id: session.id,
        current_scene_id: gameScene.id,
        state: "preparing",
      }),
      admin.from("audit_events").insert({
        campaign_id: input.campaignId,
        session_id: session.id,
        actor_user_id: user.id,
        entity_type: "session",
        entity_id: session.id,
        event_type: "session_created",
        visibility: "gm_only",
        after_data: { title: input.title },
        idempotency_key: crypto.randomUUID(),
      }),
    ]);
    const setupError = sessionUpdate.error ?? publicState.error ?? liveSession.error ?? audit.error;
    if (setupError) throw new Error(setupError.message);
    return NextResponse.json({ id: session.id }, { status: 201 });
  } catch (error) {
    if (isAdminConfigured) {
      const admin = createAdminClient();
      if (gameSceneId) await admin.from("game_scenes").delete().eq("id", gameSceneId);
      if (sessionId) await admin.from("sessions").delete().eq("id", sessionId);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a sessão." },
      { status: 400 },
    );
  }
}
