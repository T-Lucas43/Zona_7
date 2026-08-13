import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import {
  deliverySchema,
  playableCharacterSchema,
  sessionPublicStateSchema,
  sessionVisibilitySchema,
} from "@/lib/validation/schemas";

export async function createPlayableCharacter(input: unknown, actorUserId: string) {
  const value = playableCharacterSchema.parse(input);
  if (!isSupabaseConfigured)
    return { id: crypto.randomUUID(), name: value.name, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_playable_character", {
    p_campaign_id: value.campaignId,
    p_name: value.name,
    p_codename: value.codename,
    p_origin: value.origin,
    p_class_name: value.className,
    p_path_name: value.pathName,
    p_nex: value.nex,
    p_defense: value.defense,
    p_pv: value.resources.pv,
    p_pe: value.resources.pe,
    p_san: value.resources.san,
    p_agility: value.attributes.agi,
    p_strength: value.attributes.for,
    p_intellect: value.attributes.int,
    p_presence: value.attributes.pre,
    p_vigor: value.attributes.vig,
    p_owner_user_id: value.ownerUserId ?? null,
    p_actor_user_id: actorUserId,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message);
  return { id: data, name: value.name };
}

export async function deliverSessionContent(input: unknown, actorUserId: string) {
  const value = deliverySchema.parse(input);
  if (!isSupabaseConfigured) {
    const label = value.kind === "item" ? value.name : value.title;
    return {
      id: crypto.randomUUID(),
      demo: true,
      notification: {
        type: value.kind === "item" ? "item_received" : "handout_received",
        title:
          value.kind === "item" ? `Você recebeu ${label}` : `Você recebeu a pista ${label}`,
        targetCharacterIds: value.targetCharacterIds,
      },
    };
  }
  const supabase = await createClient();
  const idempotencyKey = crypto.randomUUID();
  const result =
    value.kind === "item"
      ? await supabase.rpc("deliver_item_to_characters", {
          p_campaign_id: value.campaignId,
          p_character_ids: value.targetCharacterIds,
          p_name: value.name,
          p_description: value.description,
          p_quantity: value.quantity,
          p_actor_user_id: actorUserId,
          p_idempotency_key: idempotencyKey,
        })
      : await supabase.rpc("deliver_handout_to_characters", {
          p_campaign_id: value.campaignId,
          p_character_ids: value.targetCharacterIds,
          p_title: value.title,
          p_public_excerpt: value.publicExcerpt,
          p_protected_text: value.protectedText,
          p_actor_user_id: actorUserId,
          p_idempotency_key: idempotencyKey,
        });
  if (result.error) throw new Error(result.error.message);
  if (value.sessionId && result.data) {
    const attachment = await supabase.rpc("attach_audit_event_to_session", {
      p_event_id: result.data,
      p_session_id: value.sessionId,
      p_actor_user_id: actorUserId,
    });
    if (attachment.error) throw new Error(attachment.error.message);
  }
  return { id: result.data };
}

export async function setSessionCharacterVisibility(input: unknown, actorUserId: string) {
  const value = sessionVisibilitySchema.parse(input);
  if (!isSupabaseConfigured) return { id: crypto.randomUUID(), demo: true, visible: value.visible };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_character_session_visibility", {
    p_campaign_id: value.campaignId,
    p_character_id: value.characterId,
    p_visible: value.visible,
    p_actor_user_id: actorUserId,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message);
  return { id: data, visible: value.visible };
}

export async function updateSessionPublicState(input: unknown, actorUserId: string) {
  const value = sessionPublicStateSchema.parse(input);
  if (!isSupabaseConfigured) return { version: 1, demo: true, ...value };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_session_public_state", {
    p_campaign_id: value.campaignId,
    p_session_id: value.sessionId,
    p_scene_title: value.sceneTitle,
    p_public_summary: value.publicSummary,
    p_public_objective: value.publicObjective,
    p_actor_user_id: actorUserId,
  });
  if (error) throw new Error(error.message);
  return { version: data };
}
