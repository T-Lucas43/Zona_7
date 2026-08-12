import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { mutateResource } from "@/server/services/resource-service";

const demoResult = (type: string) => ({ id: crypto.randomUUID(), type, demo: true });

async function clientOrDemo() {
  return isSupabaseConfigured ? createClient() : null;
}

export async function createCampaign(input: {
  ownerUserId: string;
  name: string;
  slug: string;
  systemCode: "zona7_classic" | "zona7_convergencia";
  timezone?: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("campaign_created");
  const { data: rule } = await supabase
    .from("rule_profiles")
    .select("id")
    .eq("code", input.systemCode)
    .single();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      owner_user_id: input.ownerUserId,
      rule_profile_id: rule?.id ?? null,
      name: input.name,
      slug: input.slug,
      system_code: input.systemCode,
      timezone: input.timezone ?? "America/Belem",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function inviteMember(input: {
  campaignId: string;
  actorUserId: string;
  email: string;
  displayName: string;
  role: "game_master" | "co_master" | "player" | "spectator";
  expiresInHours?: number;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await clientOrDemo();
  if (!supabase) return { ...demoResult("invitation_created"), token };
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      campaign_id: input.campaignId,
      invited_by: input.actorUserId,
      email: input.email,
      display_name: input.displayName,
      role: input.role,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + (input.expiresInHours ?? 72) * 3_600_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, token };
}

export async function acceptInvitation(token: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("invitation_accepted");
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  return { campaignId: data };
}

export async function createCharacter(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("character_created");
  const { data, error } = await supabase.from("characters").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function assignCharacterOwner(input: {
  campaignId: string;
  characterId: string;
  userId: string;
  confirmed?: boolean;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("character_owner_assigned");
  const { data, error } = await supabase
    .from("character_owners")
    .upsert(
      {
        campaign_id: input.campaignId,
        character_id: input.characterId,
        user_id: input.userId,
        confirmed_at: input.confirmed ? new Date().toISOString() : null,
      },
      { onConflict: "character_id,user_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCharacterNarrativeFields(
  characterId: string,
  fields: { portrait_path?: string | null; player_private_history?: string | null },
) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("character_narrative_updated");
  const { data, error } = await supabase
    .from("characters")
    .update({ ...fields, version: undefined })
    .eq("id", characterId)
    .select("id,version")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function applyDamage(
  input: Omit<Parameters<typeof mutateResource>[0], never>,
  actorUserId: string,
) {
  return mutateResource(
    {
      ...(input as object),
      operation: "damage",
      delta: -Math.abs(Number((input as { delta: number }).delta)),
    },
    actorUserId,
  );
}

export async function applyHealing(
  input: Omit<Parameters<typeof mutateResource>[0], never>,
  actorUserId: string,
) {
  return mutateResource(
    {
      ...(input as object),
      operation: "healing",
      delta: Math.abs(Number((input as { delta: number }).delta)),
    },
    actorUserId,
  );
}

export async function spendAbilityCost(input: {
  characterAbilityId: string;
  actorUserId: string;
  resolvedCosts: Record<string, number>;
  sessionId?: string;
  idempotencyKey: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("ability_used");
  const { data, error } = await supabase.rpc("spend_ability_cost", {
    p_character_ability_id: input.characterAbilityId,
    p_actor_user_id: input.actorUserId,
    p_resolved_costs: input.resolvedCosts,
    p_session_id: input.sessionId ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return { eventId: data };
}

export async function unlockAbility(input: {
  characterAbilityId: string;
  actorUserId: string;
  state?: "sealed" | "masked" | "discovered" | "unlocked" | "altered" | "disabled" | "lost";
  reason: string;
  idempotencyKey: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("ability_state_changed");
  const { data, error } = await supabase.rpc("unlock_ability", {
    p_character_ability_id: input.characterAbilityId,
    p_actor_user_id: input.actorUserId,
    p_state: input.state ?? "unlocked",
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return { eventId: data };
}

export const alterAbility = unlockAbility;

export async function createCharacterAbility(input: {
  campaignId: string;
  characterId: string;
  name: string;
  description: string;
  actionType: string;
  costs: Record<string, string>;
  recommendedNex: number;
  initialState: "sealed" | "masked" | "discovered" | "unlocked" | "altered" | "disabled" | "lost";
  actorUserId: string;
  idempotencyKey: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("ability_created");
  const { data, error } = await supabase.rpc("create_character_ability", {
    p_campaign_id: input.campaignId,
    p_character_id: input.characterId,
    p_name: input.name,
    p_public_description: input.description,
    p_action_type: input.actionType,
    p_costs: input.costs,
    p_recommended_nex: input.recommendedNex,
    p_initial_state: input.initialState,
    p_actor_user_id: input.actorUserId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function applyCondition(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("condition_applied");
  const { data, error } = await supabase
    .from("character_conditions")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeCondition(conditionId: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("condition_removed");
  const { data, error } = await supabase
    .from("character_conditions")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", conditionId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSession(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("session_created");
  const { data, error } = await supabase.from("sessions").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

async function setSessionStatus(sessionId: string, status: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult(`session_${status}`);
  const now = new Date().toISOString();
  const timestamps =
    status === "active" ? { started_at: now } : status === "ended" ? { ended_at: now } : {};
  const { data, error } = await supabase
    .from("sessions")
    .update({ status, ...timestamps })
    .eq("id", sessionId)
    .select("id,status")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const startSession = (sessionId: string) => setSessionStatus(sessionId, "active");
export const pauseSession = (sessionId: string) => setSessionStatus(sessionId, "paused");
export const endSession = (sessionId: string) => setSessionStatus(sessionId, "ended");

export async function createEncounter(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("encounter_created");
  const { data, error } = await supabase.from("encounters").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function advanceTurn(encounterId: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("turn_advanced");
  const { data: encounter, error: readError } = await supabase
    .from("encounters")
    .select("round,current_turn_position,version,encounter_combatants(count)")
    .eq("id", encounterId)
    .single();
  if (readError) throw new Error(readError.message);
  const count = Number(encounter.encounter_combatants?.[0]?.count ?? 0);
  if (count < 1) throw new Error("Encontro sem combatentes.");
  const current = encounter.current_turn_position ?? -1;
  const wrapped = current + 1 >= count;
  const { data, error } = await supabase
    .from("encounters")
    .update({
      current_turn_position: wrapped ? 0 : current + 1,
      round: wrapped ? encounter.round + 1 : encounter.round,
      version: encounter.version + 1,
    })
    .eq("id", encounterId)
    .eq("version", encounter.version)
    .select("id,round,current_turn_position,version")
    .single();
  if (error) throw new Error("O turno mudou em outro dispositivo; atualize o snapshot.");
  return data;
}

export async function advanceSessionTurnSynced(input: {
  campaignId: string;
  sessionId: string;
  actorUserId: string;
  idempotencyKey: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return { ...demoResult("turn_advanced"), round: 0 };
  const { data, error } = await supabase.rpc("advance_encounter_turn_synced", {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function controlSessionRuntime(input: {
  campaignId: string;
  sessionId: string;
  actorUserId: string;
  action: "start" | "pause" | "resume" | "reopen" | "restart" | "end";
  idempotencyKey: string;
}) {
  const supabase = await clientOrDemo();
  if (!supabase) return { ...demoResult(`session_${input.action}`), status: input.action };
  const { data, error } = await supabase.rpc("control_session_runtime", {
    p_campaign_id: input.campaignId,
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
    p_action: input.action,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function requestRoll(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("roll_requested");
  const { data, error } = await supabase.from("roll_requests").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function scheduleEvent(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("event_scheduled");
  const { data, error } = await supabase
    .from("scheduled_events")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function grantHandout(input: Record<string, unknown>) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("handout_granted");
  const { data, error } = await supabase.from("handout_access").insert(input).select("id").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function acknowledgeNotification(notificationId: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("notification_acknowledged");
  const { data, error } = await supabase
    .from("notifications")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function undoAuditEvent(eventId: string, reason: string, idempotencyKey: string) {
  const supabase = await clientOrDemo();
  if (!supabase) return demoResult("audit_event_compensated");
  const { data, error } = await supabase.rpc("undo_audit_event", {
    p_event_id: eventId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return { eventId: data };
}
