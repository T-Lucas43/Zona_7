import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type SessionTimelineEntry = {
  id: string;
  type: string;
  label: string;
  entity: string;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  reversalStatus: "available" | "reversed" | "blocked";
  reversible: boolean;
  compensatesEventId?: string;
};

export type SessionSummaryData = {
  id?: string;
  revision: number;
  title: string;
  overview: string;
  decisions: string[];
  clues: string[];
  items: string[];
  conditions: string[];
  deaths: string[];
  meters: string[];
  pendingTopics: string[];
  publishedAt?: string;
  updatedAt?: string;
};

const labels: Record<string, string> = {
  resource_mutated: "Recurso alterado",
  meter_changed: "Medidor alterado",
  condition_applied: "Condição aplicada",
  condition_removed: "Condição removida",
  item_delivered: "Item entregue",
  handout_delivered: "Pista revelada",
  combat_turn_advanced: "Turno avançado",
  initiative_current: "Turno selecionado",
  initiative_update: "Iniciativa atualizada",
  initiative_add: "Combatente incluído",
  initiative_remove: "Combatente removido",
  session_event_reversed: "Ação desfeita",
  character_dead: "Personagem morto",
  script_advance: "Roteiro avançado",
  script_rewind: "Roteiro retrocedido",
  scene_reveal_updated: "Revelação do mapa atualizada",
};

const reversibleTypes = new Set([
  "resource_mutated",
  "meter_changed",
  "condition_applied",
  "condition_removed",
  "item_delivered",
  "handout_delivered",
  "combat_turn_advanced",
  "initiative_current",
  "initiative_update",
  "initiative_add",
  "initiative_remove",
]);

export async function getSessionTimeline(
  campaignId: string,
  sessionId: string,
  limit = 80,
): Promise<SessionTimelineEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,event_type,entity_type,created_at,before_data,after_data,metadata,reversal_status,compensates_event_id")
    .eq("campaign_id", campaignId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao carregar a linha do tempo: ${error.message}`);
  return data.map((event) => ({
    id: event.id,
    type: event.event_type,
    label: labels[event.event_type] ?? event.event_type.replaceAll("_", " "),
    entity: event.entity_type,
    createdAt: event.created_at,
    before: (event.before_data ?? null) as Record<string, unknown> | null,
    after: (event.after_data ?? null) as Record<string, unknown> | null,
    metadata: (event.metadata ?? {}) as Record<string, unknown>,
    reversalStatus: (event.reversal_status ?? "available") as SessionTimelineEntry["reversalStatus"],
    reversible:
      reversibleTypes.has(event.event_type) &&
      (event.reversal_status ?? "available") === "available" &&
      !event.compensates_event_id,
    compensatesEventId: event.compensates_event_id ?? undefined,
  }));
}

export async function getLatestSessionSummary(sessionId: string): Promise<SessionSummaryData | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_summaries")
    .select("id,revision,title,overview,decisions,clues,items,conditions,deaths,meters,pending_topics,published_at,updated_at")
    .eq("session_id", sessionId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar o resumo da sessão: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    revision: data.revision,
    title: data.title,
    overview: data.overview,
    decisions: (data.decisions ?? []) as string[],
    clues: (data.clues ?? []) as string[],
    items: (data.items ?? []) as string[],
    conditions: (data.conditions ?? []) as string[],
    deaths: (data.deaths ?? []) as string[],
    meters: (data.meters ?? []) as string[],
    pendingTopics: (data.pending_topics ?? []) as string[],
    publishedAt: data.published_at ?? undefined,
    updatedAt: data.updated_at ?? undefined,
  };
}
