import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(),
  displayName: z.string().trim().min(2).max(100),
  email: z.email(),
  temporaryPassword: z.string().min(12).max(128),
  role: z.enum(["player", "co_master", "spectator"]),
  characterId: z.string().min(2).max(100).nullable().optional(),
});

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const input = schema.parse(await request.json());
    const master = await requireCampaignMaster(input.campaignId);
    if (input.characterId && input.role !== "player")
      throw new Error("Somente contas de jogador podem receber uma ficha.");
    if (!isAdminConfigured) {
      return NextResponse.json({
        id: crypto.randomUUID(),
        memberId: crypto.randomUUID(),
        name: input.displayName,
        email: input.email,
        role: input.role,
        characterId: input.characterId ?? null,
        demo: true,
      }, { status: 201 });
    }

    const admin = createAdminClient();
    let characterName: string | null = null;
    if (input.characterId) {
      const { data: character, error: characterError } = await admin
        .from("characters")
        .select("id,name")
        .eq("id", input.characterId)
        .eq("campaign_id", input.campaignId)
        .eq("is_npc", false)
        .is("deleted_at", null)
        .maybeSingle();
      if (characterError || !character) throw new Error("Personagem jogável não encontrado.");
      const { data: owner } = await admin
        .from("character_owners")
        .select("user_id")
        .eq("character_id", input.characterId)
        .not("confirmed_at", "is", null)
        .limit(1)
        .maybeSingle();
      if (owner) throw new Error("Este personagem já está vinculado a outra conta.");
      characterName = character.name;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: input.displayName },
    });
    if (createError || !created.user) throw new Error(createError?.message ?? "Falha ao criar login.");
    createdUserId = created.user.id;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ display_name: input.displayName, must_change_password: true })
      .eq("id", createdUserId);
    if (profileError) throw new Error(profileError.message);
    const { data: member, error: memberError } = await admin
      .from("campaign_members")
      .insert({ campaign_id: input.campaignId, user_id: createdUserId, role: input.role, status: "active", joined_at: new Date().toISOString() })
      .select("id")
      .single();
    if (memberError) throw new Error(memberError.message);

    if (input.characterId) {
      const { error: ownerError } = await admin.from("character_owners").insert({
        campaign_id: input.campaignId,
        character_id: input.characterId,
        user_id: createdUserId,
        confirmed_at: new Date().toISOString(),
      });
      if (ownerError) throw new Error(ownerError.message);
      const { data: actor } = await admin.from("actors").select("id").eq("character_id", input.characterId).maybeSingle();
      if (actor) {
        const { error: controllerError } = await admin.from("actor_controllers").upsert({
          campaign_id: input.campaignId,
          actor_id: actor.id,
          user_id: createdUserId,
          control_level: "owner",
          granted_by: master.id,
        }, { onConflict: "actor_id,user_id" });
        if (controllerError) throw new Error(controllerError.message);
      }
      await admin.from("notifications").insert({
        campaign_id: input.campaignId,
        user_id: createdUserId,
        character_id: input.characterId,
        type: "character_assigned",
        title: `Você recebeu ${characterName}`,
        safe_preview: "Uma ficha foi vinculada à sua conta.",
        protected_payload: { characterId: input.characterId, characterName },
      });
    }
    await admin.from("audit_events").insert({
      campaign_id: input.campaignId,
      actor_user_id: master.id,
      entity_type: "campaign_member",
      entity_id: member.id,
      event_type: "account_created_and_assigned",
      visibility: "gm_only",
      after_data: { userId: createdUserId, role: input.role, characterId: input.characterId ?? null },
      idempotency_key: crypto.randomUUID(),
    });
    return NextResponse.json({
      id: createdUserId,
      memberId: member.id,
      name: input.displayName,
      email: input.email,
      role: input.role,
      characterId: input.characterId ?? null,
      characterName,
    }, { status: 201 });
  } catch (error) {
    if (createdUserId && isAdminConfigured) {
      await createAdminClient().auth.admin.deleteUser(createdUserId);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a conta." },
      { status: 400 },
    );
  }
}
