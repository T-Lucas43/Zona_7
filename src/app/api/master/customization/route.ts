import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const base = z.object({ campaignId: z.string().uuid() });
const settingsSchema = base.extend({
  action: z.literal("settings"),
  name: z.string().trim().min(2).max(160),
  timezone: z.string().trim().min(3).max(80),
  labels: z.record(z.string(), z.string().trim().min(1).max(80)),
  theme: z.object({ accent: z.string(), energy: z.string(), background: z.string() }),
  featureFlags: z.record(z.string(), z.boolean()),
  rules: z.object({
    zeroHp: z.string(),
    zeroSan: z.string(),
    pressure: z.number().int().min(0).max(7),
  }),
});
const fieldSchema = base.extend({
  action: z.literal("field"),
  entityType: z.enum([
    "character",
    "ability",
    "item",
    "session",
    "encounter",
    "message",
    "handout",
  ]),
  fieldKey: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  label: z.string().trim().min(2).max(100),
  inputType: z.enum([
    "text",
    "textarea",
    "number",
    "boolean",
    "select",
    "multiselect",
    "date",
    "datetime",
    "url",
    "color",
  ]),
  visibility: z.enum(["public", "campaign", "selected", "owner_only", "gm_only"]),
});

export async function POST(request: Request) {
  try {
    const input = z
      .discriminatedUnion("action", [settingsSchema, fieldSchema])
      .parse(await request.json());
    await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) return NextResponse.json({ id: crypto.randomUUID(), demo: true });
    const supabase = await createClient();
    if (input.action === "field") {
      const { data, error } = await supabase
        .from("campaign_custom_fields")
        .insert({
          campaign_id: input.campaignId,
          entity_type: input.entityType,
          field_key: input.fieldKey,
          label: input.label,
          input_type: input.inputType,
          visibility: input.visibility,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json(data, { status: 201 });
    }
    const [campaignResult, interfaceResult, rulesResult] = await Promise.all([
      supabase
        .from("campaigns")
        .update({ name: input.name, timezone: input.timezone })
        .eq("id", input.campaignId),
      supabase.from("campaign_ui_settings").upsert({
        campaign_id: input.campaignId,
        labels: input.labels,
        theme: input.theme,
        feature_flags: input.featureFlags,
      }),
      supabase.from("campaign_rule_settings").upsert({
        campaign_id: input.campaignId,
        zero_hp_mode: input.rules.zeroHp,
        zero_sanity_mode: input.rules.zeroSan,
        pressure: input.rules.pressure,
      }),
    ]);
    const error = campaignResult.error ?? interfaceResult.error ?? rulesResult.error;
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Configuração inválida." },
      { status: 400 },
    );
  }
}
