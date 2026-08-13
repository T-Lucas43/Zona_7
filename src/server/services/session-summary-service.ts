import "server-only";

import { createClient } from "@/lib/supabase/server";

function text(data: unknown, ...keys: string[]) {
  const record = (data ?? {}) as Record<string, unknown>;
  for (const key of keys) if (record[key] !== undefined && record[key] !== null && String(record[key]).trim()) return String(record[key]);
  return "";
}

export async function generateAutomaticSessionSummary(input: { campaignId: string; sessionId: string; actorUserId: string; publish?: boolean }) {
  const supabase = await createClient();
  const [{ data: session, error: sessionError }, { data: events, error: eventsError }, latest] = await Promise.all([
    supabase.from("sessions").select("title,started_at,ended_at").eq("id", input.sessionId).eq("campaign_id", input.campaignId).single(),
    supabase.from("audit_events").select("event_type,after_data,metadata,created_at,reversal_status").eq("campaign_id", input.campaignId).eq("session_id", input.sessionId).order("created_at"),
    supabase.from("session_summaries").select("revision").eq("session_id", input.sessionId).order("revision", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (sessionError) throw new Error(sessionError.message);
  if (eventsError) throw new Error(eventsError.message);
  if (latest.error) throw new Error(latest.error.message);
  const effective = events.filter((event) => event.reversal_status !== "reversed");
  const payload = {
    title: `Relatório - ${session.title}`,
    overview: `A sessão terminou com ${effective.length} evento(s) efetivo(s), de ${session.started_at ? new Date(session.started_at).toLocaleString("pt-BR") : "horário não informado"} até ${session.ended_at ? new Date(session.ended_at).toLocaleString("pt-BR") : "agora"}.`,
    decisions: effective.filter((event) => /choice|script_advance|decision/.test(event.event_type)).map((event) => text(event.after_data, "label", "currentNodeKey", "reason")).filter(Boolean),
    clues: effective.filter((event) => event.event_type === "handout_delivered").map((event) => text(event.after_data, "title")).filter(Boolean),
    items: effective.filter((event) => event.event_type === "item_delivered").map((event) => `${text(event.after_data, "name")}${text(event.after_data, "quantity") ? ` x${text(event.after_data, "quantity")}` : ""}`).filter(Boolean),
    conditions: effective.filter((event) => /condition/.test(event.event_type)).map((event) => text(event.after_data, "name", "condition", "state") || event.event_type),
    deaths: effective.filter((event) => /dead|death/.test(event.event_type) || text(event.after_data, "state") === "dead").map((event) => text(event.after_data, "characterName", "name") || "Morte registrada"),
    meters: effective.filter((event) => event.event_type === "meter_changed").map((event) => `${text(event.metadata, "reason") || "Medidor"}: ${text(event.after_data, "value")}`).filter(Boolean),
    pendingTopics: [] as string[],
  };
  const revision = (latest.data?.revision ?? 0) + 1;
  const { data, error } = await supabase.from("session_summaries").insert({ campaign_id: input.campaignId, session_id: input.sessionId, revision, title: payload.title, overview: payload.overview, decisions: payload.decisions, clues: payload.clues, items: payload.items, conditions: payload.conditions, deaths: payload.deaths, meters: payload.meters, pending_topics: payload.pendingTopics, generated_from_event_at: effective.at(-1)?.created_at ?? null, generated_by: input.actorUserId, published_at: input.publish ? new Date().toISOString() : null }).select("id,revision,published_at,updated_at").single();
  if (error) throw new Error(error.message);
  return { ...payload, ...data };
}
