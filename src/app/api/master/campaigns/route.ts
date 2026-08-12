import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, roleCanAccess } from "@/lib/auth/session";
import { isAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  ruleProfileId: z.string().uuid(),
  timezone: z.string().trim().min(3).max(80),
  premise: z.string().trim().max(5_000),
});

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "campanha"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  let createdCampaignId: string | null = null;
  try {
    const user = await getCurrentUser("master");
    if (!user || !roleCanAccess(user.role, "master")) {
      return NextResponse.json({ error: "Acesso restrito ao mestre." }, { status: 403 });
    }
    if (!isAdminConfigured) {
      return NextResponse.json(
        { error: "O servidor não possui a credencial necessária para criar campanhas." },
        { status: 503 },
      );
    }
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("rule_profiles")
      .select("id,code")
      .eq("id", input.ruleProfileId)
      .single();
    if (profileError) throw new Error(`Perfil de regras inválido: ${profileError.message}`);

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .insert({
        owner_user_id: user.id,
        rule_profile_id: profile.id,
        name: input.name,
        slug: slugify(input.name),
        system_code: profile.code,
        timezone: input.timezone,
        language_code: "pt-BR",
        status: "active",
        public_premise: input.premise || null,
      })
      .select("id")
      .single();
    if (campaignError) throw new Error(campaignError.message);
    createdCampaignId = campaign.id;

    const [memberResult, rulesResult, interfaceResult, auditResult] = await Promise.all([
      admin.from("campaign_members").insert({
        campaign_id: campaign.id,
        user_id: user.id,
        role: "campaign_owner",
        status: "active",
        joined_at: new Date().toISOString(),
      }),
      admin.from("campaign_rule_settings").insert({ campaign_id: campaign.id, pressure: 0 }),
      admin.from("campaign_ui_settings").insert({ campaign_id: campaign.id }),
      admin.from("audit_events").insert({
        campaign_id: campaign.id,
        actor_user_id: user.id,
        entity_type: "campaign",
        entity_id: campaign.id,
        event_type: "campaign_created",
        visibility: "gm_only",
        after_data: { name: input.name, systemCode: profile.code },
        idempotency_key: crypto.randomUUID(),
      }),
    ]);
    const setupError = memberResult.error ?? rulesResult.error ?? interfaceResult.error ?? auditResult.error;
    if (setupError) throw new Error(setupError.message);
    return NextResponse.json({ id: campaign.id }, { status: 201 });
  } catch (error) {
    if (createdCampaignId && isAdminConfigured) {
      await createAdminClient().from("campaigns").delete().eq("id", createdCampaignId);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a campanha." },
      { status: 400 },
    );
  }
}
