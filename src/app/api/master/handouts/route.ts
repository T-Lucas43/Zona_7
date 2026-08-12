import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const handoutFields = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.string().trim().min(2).max(80),
  state: z.enum(["hidden", "discovered", "shared", "corrupted"]),
  visibility: z.enum(["public", "campaign", "selected", "owner_only", "gm_only"]),
  excerpt: z.string().trim().max(1_000),
  content: z.string().trim().max(20_000),
});

const schema = z.discriminatedUnion("action", [
  handoutFields.extend({ action: z.literal("create"), campaignId: z.uuid() }),
  handoutFields.extend({ action: z.literal("update"), campaignId: z.uuid(), handoutId: z.uuid() }),
  z.object({ action: z.literal("delete"), campaignId: z.uuid(), handoutId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();

    if (input.action === "delete") {
      const { error } = await supabase
        .from("handouts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", input.handoutId)
        .eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true });
    }

    const values = {
      title: input.title,
      type: input.type,
      state: input.state,
      visibility: input.visibility,
      public_excerpt: input.excerpt || null,
      updated_at: new Date().toISOString(),
    };
    const handoutQuery = input.action === "create"
      ? supabase.from("handouts").insert({ campaign_id: input.campaignId, created_by: user.id, ...values })
      : supabase.from("handouts").update(values).eq("id", input.handoutId).eq("campaign_id", input.campaignId);
    const { data, error } = await handoutQuery.select("id,title,type,state,visibility,public_excerpt").single();
    if (error) throw new Error(error.message);
    const { error: contentError } = await supabase.from("handout_contents").upsert({
      handout_id: data.id,
      protected_text: input.content || null,
    });
    if (contentError) throw new Error(contentError.message);
    return NextResponse.json({
      item: {
        id: data.id,
        titulo: data.title,
        tipo: data.type,
        estado: data.state,
        visibilidade: data.visibility,
        resumo: data.public_excerpt ?? "",
        conteudo: input.content,
      },
    }, { status: input.action === "create" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pista ou material inválido." },
      { status: 400 },
    );
  }
}
