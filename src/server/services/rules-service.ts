import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function resolveEffectiveRule(campaignId: string, key: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_effective_rule", {
    p_campaign_id: campaignId,
    p_rule_key: key,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function createRulesSnapshot(input: { campaignId: string; sessionId: string; actorUserId: string; reason: string }) {
  if (!isSupabaseConfigured) return { snapshotId: crypto.randomUUID(), demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_rules_snapshot", {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return { snapshotId: data as string, demo: false };
}

export async function applyRuleOverride(input: { campaignId: string; ruleDefinitionId: string; payload: Record<string, unknown>; reason: string; actorUserId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_rule_override", {
    p_campaign_id: input.campaignId,
    p_rule_definition_id: input.ruleDefinitionId,
    p_payload: input.payload,
    p_reason: input.reason,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reportHelpIssue(input: { campaignId: string; articleId: string; message: string; actorUserId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_help_issue", {
    p_campaign_id: input.campaignId,
    p_article_id: input.articleId,
    p_message: input.message,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function publishHelpArticle(input: { campaignId: string; articleId: string; title: string; summary: string; content: string; keywords: string[]; reason: string; actorUserId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_help_article", {
    p_campaign_id: input.campaignId,
    p_article_id: input.articleId,
    p_title: input.title,
    p_summary: input.summary,
    p_content: input.content,
    p_keywords: input.keywords,
    p_reason: input.reason,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function createSafetyEvent(input: { campaignId: string; sessionId: string; tool: string; privateToMaster: boolean; actorUserId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_safety_event", {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId,
    p_tool: input.tool,
    p_private: input.privateToMaster,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function processStartOfTurnEffects(input: { campaignId: string; sessionId: string; characterId: string; actorUserId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_start_of_turn_effects", {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId,
    p_character_id: input.characterId,
    p_actor_user_id: input.actorUserId,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message);
  return data;
}
