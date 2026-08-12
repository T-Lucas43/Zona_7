import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.uuid(), characterAbilityId: z.uuid(), useCriteria: z.string().trim().min(2).max(2_000),
  application: z.string().trim().min(2).max(2_000), testFormula: z.string().trim().min(2).max(80),
  difficulty: z.number().int().min(0).max(999).optional(), successEffect: z.string().trim().min(2).max(4_000),
  partialEffect: z.string().trim().max(4_000).optional(), failureEffect: z.string().trim().min(2).max(4_000),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    const { data: link, error: linkError } = await supabase.from("character_abilities").select("ability_id")
      .eq("id", input.characterAbilityId).eq("campaign_id", input.campaignId).single();
    if (linkError) throw new Error(linkError.message);
    const { error } = await supabase.from("abilities").update({
      use_criteria: input.useCriteria, application_text: input.application, test_formula: input.testFormula,
      difficulty: input.difficulty ?? null, success_effect: input.successEffect,
      partial_effect: input.partialEffect || null, failure_effect: input.failureEffect, updated_by: user.id,
    }).eq("id", link.ability_id).eq("campaign_id", input.campaignId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Informações inválidas." }, { status: 400 });
  }
}
