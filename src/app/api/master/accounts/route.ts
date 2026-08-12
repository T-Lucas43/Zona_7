import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig, isAdminConfigured, isSupabaseConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    campaignId: z.uuid(),
    memberId: z.string().min(2),
    userId: z.uuid(),
    action: z.enum(["reset", "suspend", "activate"]),
  }),
  z.object({
    campaignId: z.uuid(),
    memberId: z.string().min(2),
    userId: z.uuid(),
    characterId: z.string().min(2).max(100).nullable(),
    action: z.literal("assign"),
  }),
  z.object({
    campaignId: z.uuid(),
    memberId: z.uuid(),
    userId: z.uuid(),
    displayName: z.string().trim().min(2).max(100),
    email: z.email(),
    role: z.enum(["player", "co_master", "spectator"]),
    action: z.literal("edit"),
  }),
  z.object({
    campaignId: z.uuid(),
    memberId: z.uuid(),
    userId: z.uuid(),
    action: z.literal("delete"),
  }),
]);

const roleLabels = {
  player: "Jogador",
  co_master: "Mestre auxiliar",
  spectator: "Espectador",
} as const;

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const master = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) return NextResponse.json({ ok: true, characterId: "characterId" in input ? input.characterId : undefined, demo: true });

    if (input.action === "edit" || input.action === "delete") {
      if (!isAdminConfigured) throw new Error("A administração segura de contas não está configurada no servidor.");
      if (input.userId === master.id) throw new Error("Você não pode editar ou excluir sua própria conta por esta tela.");
      const admin = createAdminClient();
      const { data: member, error: memberError } = await admin
        .from("campaign_members")
        .select("id,user_id,role")
        .eq("id", input.memberId)
        .eq("campaign_id", input.campaignId)
        .eq("user_id", input.userId)
        .maybeSingle();
      if (memberError || !member) throw new Error("Usuário não encontrado nesta campanha.");
      if (["campaign_owner", "game_master"].includes(member.role))
        throw new Error("A conta responsável ou de mestre principal não pode ser alterada por esta tela.");

      if (input.action === "edit") {
        const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(input.userId);
        if (authLookupError || !authData.user) throw new Error("Login do usuário não encontrado.");
        const { error: authError } = await admin.auth.admin.updateUserById(input.userId, {
          email: input.email.trim().toLowerCase(),
          email_confirm: true,
          user_metadata: { ...authData.user.user_metadata, display_name: input.displayName },
        });
        if (authError) throw new Error(authError.message);
        const { error: profileError } = await admin
          .from("profiles")
          .update({ display_name: input.displayName })
          .eq("id", input.userId);
        if (profileError) throw new Error(profileError.message);
        const { error: roleError } = await admin
          .from("campaign_members")
          .update({ role: input.role, updated_at: new Date().toISOString() })
          .eq("id", input.memberId)
          .eq("campaign_id", input.campaignId);
        if (roleError) throw new Error(roleError.message);
        if (input.role !== "player") {
          const { error: controllerError } = await admin
            .from("actor_controllers")
            .delete()
            .eq("campaign_id", input.campaignId)
            .eq("user_id", input.userId);
          if (controllerError) throw new Error(controllerError.message);
          const { error: ownerError } = await admin
            .from("character_owners")
            .delete()
            .eq("campaign_id", input.campaignId)
            .eq("user_id", input.userId);
          if (ownerError) throw new Error(ownerError.message);
        }
        await admin.from("audit_events").insert({
          campaign_id: input.campaignId,
          actor_user_id: master.id,
          entity_type: "campaign_member",
          entity_id: input.memberId,
          event_type: "campaign_user_updated",
          visibility: "gm_only",
          after_data: { userId: input.userId, displayName: input.displayName, email: input.email.trim().toLowerCase(), role: input.role },
          idempotency_key: crypto.randomUUID(),
        });
        return NextResponse.json({
          ok: true,
          displayName: input.displayName,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          roleLabel: roleLabels[input.role],
        });
      }

      for (const table of ["actor_controllers", "character_owners", "session_participants", "message_recipients", "message_responses", "handout_access", "notifications"] as const) {
        const { error } = await admin.from(table).delete().eq("campaign_id", input.campaignId).eq("user_id", input.userId);
        if (error) throw new Error(`Falha ao revogar acesso em ${table}: ${error.message}`);
      }
      const { error: deleteMemberError } = await admin
        .from("campaign_members")
        .delete()
        .eq("id", input.memberId)
        .eq("campaign_id", input.campaignId);
      if (deleteMemberError) throw new Error(deleteMemberError.message);
      await admin.from("audit_events").insert({
        campaign_id: input.campaignId,
        actor_user_id: master.id,
        entity_type: "campaign_member",
        entity_id: input.memberId,
        event_type: "campaign_user_deleted",
        visibility: "gm_only",
        before_data: { userId: input.userId, role: member.role },
        after_data: { accessRevoked: true },
        idempotency_key: crypto.randomUUID(),
      });
      const { count, error: remainingError } = await admin
        .from("campaign_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId);
      if (remainingError) throw new Error(remainingError.message);
      let accountDeleted = false;
      let warning: string | null = null;
      if ((count ?? 0) === 0) {
        const { error: authDeleteError } = await admin.auth.admin.deleteUser(input.userId, true);
        if (authDeleteError) warning = `O acesso à campanha foi removido, mas a exclusão definitiva do login falhou: ${authDeleteError.message}`;
        else accountDeleted = true;
      }
      return NextResponse.json({ ok: true, accountDeleted, warning });
    }

    if (input.action === "reset") {
      if (!isAdminConfigured) throw new Error("A administração segura de contas não está configurada no servidor.");
      const admin = createAdminClient();
      const { data: member, error: memberError } = await admin
        .from("campaign_members")
        .select("id,user_id")
        .eq("id", input.memberId)
        .eq("campaign_id", input.campaignId)
        .eq("user_id", input.userId)
        .maybeSingle();
      if (memberError || !member) throw new Error("Usuário não encontrado nesta campanha.");
      const { data: authData, error: authError } = await admin.auth.admin.getUserById(input.userId);
      if (authError || !authData.user?.email) throw new Error("E-mail de acesso não encontrado.");
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(authData.user.email, {
        redirectTo: `${appConfig.appUrl}/reset-password`,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (input.action === "assign") {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("assign_character_to_user", {
        p_campaign_id: input.campaignId,
        p_member_id: input.memberId,
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_actor_user_id: master.id,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    const status = input.action === "suspend" ? "suspended" : "active";
    if (!isAdminConfigured) throw new Error("A administração segura de contas não está configurada no servidor.");
    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("campaign_members")
      .select("id,user_id,role")
      .eq("id", input.memberId)
      .eq("campaign_id", input.campaignId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (targetError || !target) throw new Error("Usuário não encontrado nesta campanha.");
    if (target.user_id === master.id) throw new Error("Você não pode suspender sua própria conta.");
    if (["campaign_owner", "game_master"].includes(target.role)) throw new Error("A conta responsável ou de mestre principal não pode ser suspensa.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("campaign_members")
      .update({ status })
      .eq("id", input.memberId)
      .eq("campaign_id", input.campaignId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ação inválida." },
      { status: 400 },
    );
  }
}
