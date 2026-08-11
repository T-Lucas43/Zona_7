import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { characterSheetVisibilitySchema } from "@/lib/validation/schemas";
import { requireCampaignMaster } from "@/server/services/master-access";

export async function POST(request: Request) {
  try {
    const input = characterSheetVisibilitySchema.parse(await request.json());
    const master = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured) {
      return NextResponse.json({ ...input, version: 1, demo: true });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_character_sheet_settings", {
      p_campaign_id: input.campaignId,
      p_character_id: input.characterId,
      p_visible_fields: input.visibleFields,
      p_visible_sections: input.visibleSections,
      p_actor_user_id: master.id,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Configuração de ficha inválida." },
      { status: 400 },
    );
  }
}
