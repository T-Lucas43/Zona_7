import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const restoreSchema = z.object({
  campaignId: z.uuid(),
  ruleDefinitionId: z.uuid(),
  logId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = z.uuid().parse(url.searchParams.get("campaignId"));
    const ruleDefinitionId = z.uuid().parse(url.searchParams.get("ruleDefinitionId"));
    await requireCampaignMaster(campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rule_change_log")
      .select("id,action,before_data,after_data,reason,created_at,profiles(display_name)")
      .eq("campaign_id", campaignId)
      .eq("rule_definition_id", ruleDefinitionId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ history: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar versões." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const input = restoreSchema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("restore_rule_override_version", {
      p_campaign_id: input.campaignId,
      p_rule_definition_id: input.ruleDefinitionId,
      p_log_id: input.logId,
      p_reason: input.reason,
      p_actor_user_id: user.id,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao restaurar versão." }, { status: 400 });
  }
}
