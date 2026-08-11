import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { characters, liveSession } from "@/lib/demo-data";
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

export async function getCurrentSession(
  campaignId = demoCampaignId,
  requestedSessionId?: string,
): Promise<SessionSummary> {
  if (!isSupabaseConfigured) return liveSession;
  const supabase = await createClient();
  let query = supabase
    .from("sessions")
    .select("id,campaign_id,title,status,current_scene_id")
    .eq("campaign_id", campaignId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (requestedSessionId?.match(/^[0-9a-f-]{36}$/i)) query = query.eq("id", requestedSessionId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return liveSession;
  const [sceneResult, participantResult, rulesResult] = await Promise.all([
    data.current_scene_id
      ? supabase.from("session_scenes").select("title").eq("id", data.current_scene_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("session_participants").select("id", { count: "exact", head: true }).eq("session_id", data.id).eq("status", "online"),
    supabase.from("campaign_rule_settings").select("pressure").eq("campaign_id", data.campaign_id).maybeSingle(),
  ]);
  return {
    id: data.id,
    title: data.title,
    status: data.status as SessionSummary["status"],
    scene: sceneResult.data?.title ?? data.title,
    round: 1,
    currentTurn: "Aguardando iniciativa",
    connected: participantResult.count ?? 0,
    pressure: rulesResult.data?.pressure ?? 0,
  };
}

export async function getSessionPublicState(
  campaignId = demoCampaignId,
  sessionId = liveSession.id,
): Promise<SessionPublicState> {
  const demo: SessionPublicState = {
    sessionId,
    campaignId,
    sceneTitle: liveSession.scene,
    publicSummary: "Uma câmera sem energia registra sete segundos do futuro.",
    publicObjective: "Descubram a origem da transmissão impossível.",
    version: 1,
  };
  if (!isSupabaseConfigured) return demo;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_public_state")
    .select("session_id,campaign_id,scene_title,public_summary,public_objective,version")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error || !data) return demo;
  return {
    sessionId: data.session_id,
    campaignId: data.campaign_id,
    sceneTitle: data.scene_title,
    publicSummary: data.public_summary,
    publicObjective: data.public_objective,
    version: data.version,
  };
}

export async function getSessionCast(campaignId = demoCampaignId): Promise<SessionCastMember[]> {
  if (!isSupabaseConfigured)
    return characters.map((character) => ({
      id: `actor-${character.id}`,
      characterId: character.id,
      name: character.name,
      description: character.codename ?? character.role,
      color: "#b52532",
    }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actors")
    .select("id,character_id,name,public_description,color")
    .eq("campaign_id", campaignId)
    .eq("actor_type", "player_character")
    .eq("visibility", "campaign")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao carregar personagens da sessão: ${error.message}`);
  return data.map((actor) => ({
    id: actor.id,
    characterId: actor.character_id,
    name: actor.name,
    description: actor.public_description ?? "Personagem jogável",
    color: actor.color,
  }));
}
