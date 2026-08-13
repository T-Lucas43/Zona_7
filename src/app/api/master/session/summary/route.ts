import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";
import { generateAutomaticSessionSummary } from "@/server/services/session-summary-service";

const schema = z.object({
  campaignId: z.uuid(),
  sessionId: z.uuid(),
  action: z.enum(["generate", "save", "publish"]),
  summary: z.object({
    title: z.string().trim().min(2).max(200),
    overview: z.string().max(10_000).default(""),
    decisions: z.array(z.string().max(1_000)).max(100).default([]),
    clues: z.array(z.string().max(1_000)).max(100).default([]),
    items: z.array(z.string().max(1_000)).max(100).default([]),
    conditions: z.array(z.string().max(1_000)).max(100).default([]),
    deaths: z.array(z.string().max(1_000)).max(100).default([]),
    meters: z.array(z.string().max(1_000)).max(100).default([]),
    pendingTopics: z.array(z.string().max(1_000)).max(100).default([]),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (user.demo) return NextResponse.json({ revision: 1, ...(input.summary ?? {}) });
    const supabase = await createClient();
    if (input.action === "generate") return NextResponse.json(await generateAutomaticSessionSummary({ campaignId: input.campaignId, sessionId: input.sessionId, actorUserId: user.id }));
    if (!input.summary) throw new Error("Revise ou gere um resumo antes de salvar.");
    const existing = await supabase
      .from("session_summaries")
      .select("revision")
      .eq("session_id", input.sessionId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    const summary = input.summary;
    const revision = (existing.data?.revision ?? 0) + 1;
    const { data, error } = await supabase.from("session_summaries").insert({
      campaign_id: input.campaignId,
      session_id: input.sessionId,
      revision,
      title: summary.title,
      overview: summary.overview,
      decisions: summary.decisions,
      clues: summary.clues,
      items: summary.items,
      conditions: summary.conditions,
      deaths: summary.deaths,
      meters: summary.meters,
      pending_topics: summary.pendingTopics,
      generated_by: user.id,
      published_at: input.action === "publish" ? new Date().toISOString() : null,
    }).select("id,revision,published_at,updated_at").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ...summary, ...data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar o resumo." },
      { status: 400 },
    );
  }
}
