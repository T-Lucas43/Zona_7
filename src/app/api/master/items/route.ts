import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const fields = z.object({
  campaignId: z.uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5_000),
  category: z.string().trim().min(2).max(100),
});
const schema = z.discriminatedUnion("action", [
  fields.extend({ action: z.literal("create") }),
  fields.extend({ action: z.literal("update"), itemId: z.uuid() }),
  z.object({ action: z.literal("delete"), campaignId: z.uuid(), itemId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await requireCampaignMaster(input.campaignId);
    const supabase = await createClient();
    if (input.action === "delete") {
      const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() })
        .eq("id", input.itemId).eq("campaign_id", input.campaignId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true });
    }
    const values = {
      name: input.name,
      description: input.description || null,
      category: input.category,
      visibility: "owner_only",
      updated_at: new Date().toISOString(),
    };
    const query = input.action === "create"
      ? supabase.from("items").insert({ campaign_id: input.campaignId, ...values })
      : supabase.from("items").update(values).eq("id", input.itemId).eq("campaign_id", input.campaignId);
    const { data, error } = await query.select("id,name,description,category,visibility").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ item: {
      id: data.id, nome: data.name, descricao: data.description ?? "",
      categoria: data.category ?? "Item de sessão", visibilidade: "Dono da ficha e mestres",
    } }, { status: input.action === "create" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Item inválido." }, { status: 400 });
  }
}
