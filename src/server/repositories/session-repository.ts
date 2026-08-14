import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { isAdminConfigured } from "@/lib/config";
import { characters, liveSession } from "@/lib/demo-data";
import { initiative } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SessionSummary } from "@/types/domain";

export const demoCampaignId = "11111111-1111-4111-8111-111111111111";

export type SessionPublicState = {
  sessionId: string;
  campaignId: string;
  sceneTitle: string;
  publicSummary: string;
  publicObjective: string;
  version: number;
};

export type SessionCastMember = {
  id: string;
  characterId: string | null;
  name: string;
  description: string;
  color: string;
};

export type InitiativeEntry = {
  id: string;
  name: string;
  value: number | null;
  active: boolean;
  kind: string;
  currentHp: number | null;
  maximumHp: number | null;
  hiddenHp: boolean;
  visibleState: string;
};

export async function getCurrentSession(
  campaignId?: string,
  requestedSessionId?: string,
): Promise<SessionSummary | null> {
  if (!isSupabaseConfigured) return liveSession;
  const supabase = await createClient();
  let query = supabase
    .from("sessions")
    .select("id,campaign_id,title,status,current_scene_id,elapsed_seconds,timer_started_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (requestedSessionId?.match(/^[0-9a-f-]{36}$/i)) query = query.eq("id", requestedSessionId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Falha ao carregar sessão: ${error.message}`);
  if (!data) return null;
  const [sceneResult, participantResult, rulesResult, encounterResult] = await Promise.all([
    data.current_scene_id
      ? supabase.from("session_scenes").select("title").eq("id", data.current_scene_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("session_participants").select("id", { count: "exact", head: true }).eq("session_id", data.id).eq("status", "online"),
    supabase.from("campaign_rule_settings").select("pressure").eq("campaign_id", data.campaign_id).maybeSingle(),
    supabase
      .from("encounters")
      .select("round,current_turn_position,encounter_combatants(display_name,position)")
      .eq("session_id", data.id)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (encounterResult.error) throw new Error(`Falha ao carregar encontro: ${encounterResult.error.message}`);
  const currentCombatant = encounterResult.data?.encounter_combatants.find(
    (combatant) => combatant.position === encounterResult.data?.current_turn_position,
  );
  return {
    id: data.id,
    campaignId: data.campaign_id,
    title: data.title,
    status: (data.status ?? "preparing") as SessionSummary["status"],
    scene: sceneResult.data?.title ?? data.title,
    round: encounterResult.data?.round ?? 0,
    currentTurn: currentCombatant?.display_name ?? "Nenhum turno ativo",
    connected: participantResult.count ?? 0,
    pressure: rulesResult.data?.pressure ?? 0,
    elapsedSeconds: Number(data.elapsed_seconds ?? 0),
    timerStartedAt: data.timer_started_at,
  };
}

export async function getSessionPublicState(
  campaignId = demoCampaignId,
  sessionId = liveSession.id,
): Promise<SessionPublicState> {
  const fallback: SessionPublicState = {
    sessionId,
    campaignId,
    sceneTitle: "",
    publicSummary: "",
    publicObjective: "",
    version: 0,
  };
  if (!isSupabaseConfigured)
    return {
      ...fallback,
      sceneTitle: liveSession.scene,
      publicSummary: "Uma câmera sem energia registra sete segundos do futuro.",
      publicObjective: "Descubram a origem da transmissão impossível.",
      version: 1,
    };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_public_state")
    .select("session_id,campaign_id,scene_title,public_summary,public_objective,version")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar estado público: ${error.message}`);
  if (!data) return fallback;
  return {
    sessionId: data.session_id,
    campaignId: data.campaign_id,
    sceneTitle: data.scene_title,
    publicSummary: data.public_summary,
    publicObjective: data.public_objective,
    version: data.version,
  };
}

export async function getSessionCast(campaignId = demoCampaignId, sessionId?: string): Promise<SessionCastMember[]> {
  if (!isSupabaseConfigured)
    return characters.map((character) => ({
      id: `actor-${character.id}`,
      characterId: character.id,
      name: character.name,
      description: character.codename ?? character.role,
      color: "#b52532",
    }));
  const supabase = await createClient();
  let characterIds: string[] | null = null;
  if (sessionId) {
    const { data: participants, error: participantError } = await supabase
      .from("session_participants")
      .select("character_id")
      .eq("campaign_id", campaignId)
      .eq("session_id", sessionId)
      .eq("status", "online")
      .gte("last_seen_at", new Date(Date.now() - 60_000).toISOString())
      .not("character_id", "is", null);
    if (participantError) throw new Error(`Falha ao carregar participantes ativos: ${participantError.message}`);
    characterIds = [...new Set(participants.flatMap((item) => item.character_id ? [item.character_id] : []))];
    if (characterIds.length === 0) return [];
  }
  let query = supabase
    .from("actors")
    .select("id,character_id,name,public_description,color")
    .eq("campaign_id", campaignId)
    .eq("actor_type", "player_character")
    .eq("visibility", "campaign")
    .is("deleted_at", null)
    .order("name");
  if (characterIds) query = query.in("character_id", characterIds);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar personagens da sessão: ${error.message}`);
  return data.map((actor) => ({
    id: actor.id,
    characterId: actor.character_id,
    name: actor.name,
    description: actor.public_description ?? "Personagem jogável",
    color: actor.color,
  }));
}

export async function getSessionInitiative(sessionId: string): Promise<InitiativeEntry[]> {
  if (!isSupabaseConfigured)
    return initiative.map((entry, index) => ({
      id: `demo-${index}`,
      name: entry.name,
      value: entry.value,
      active: entry.active,
      kind: entry.kind,
      currentHp: entry.kind === "enemy" ? 18 : null,
      maximumHp: entry.kind === "enemy" ? 24 : null,
      hiddenHp: entry.kind === "enemy",
      visibleState: "Ativo",
    }));
  const supabase = await createClient();
  const { data: authorizedSession, error: sessionError } = await supabase
    .from("sessions")
    .select("id,campaign_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(`Falha ao autorizar iniciativa: ${sessionError.message}`);
  if (!authorizedSession) return [];

  const reader = isAdminConfigured ? createAdminClient() : supabase;
  const { data: encounter, error: encounterError } = await reader
    .from("encounters")
    .select("id,current_turn_position")
    .eq("session_id", sessionId)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (encounterError) throw new Error(`Falha ao carregar iniciativa: ${encounterError.message}`);
  if (!encounter) return [];
  const { data, error } = await reader
    .from("encounter_combatants")
    .select("id,display_name,initiative,position,kind,current_hp,maximum_hp,hidden_hp,visible_state")
    .eq("encounter_id", encounter.id)
    .order("position");
  if (error) throw new Error(`Falha ao carregar participantes do encontro: ${error.message}`);
  return data.map((entry) => ({
    id: entry.id,
    name: entry.display_name,
    value: entry.initiative,
    active: entry.position === encounter.current_turn_position,
    kind: entry.kind,
    currentHp: entry.current_hp,
    maximumHp: entry.maximum_hp,
    hiddenHp: entry.hidden_hp,
    visibleState: entry.visible_state ?? "Ativo",
  }));
}
