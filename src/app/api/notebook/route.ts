import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { isMasterRole } from "@/lib/permissions/visibility";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    campaignId: z.uuid(),
    characterId: z.string().min(1).max(100),
    ownerUserId: z.string().min(1).max(100).optional(),
    pageId: z.string().min(1).max(100).optional(),
    title: z.string().max(180).default(""),
    content: z.string().max(100_000).default(""),
    linkedHandoutIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  }),
  z.object({
    action: z.literal("delete"),
    campaignId: z.uuid(),
    characterId: z.string().min(1).max(100),
    ownerUserId: z.string().min(1).max(100).optional(),
    pageId: z.string().min(1).max(100),
  }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await getCurrentUser("player");
    if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    const master = isMasterRole(user.role);
    if (master) await requireCampaignMaster(input.campaignId);
    const ownerUserId = master ? input.ownerUserId : user.id;
    if (!ownerUserId) throw new Error("Selecione a conta proprietária do caderno.");
    if (!isSupabaseConfigured) {
      return NextResponse.json({
        item: input.action === "save" ? {
          id: input.pageId ?? crypto.randomUUID(),
          pageNumber: 1,
          title: input.title,
          content: input.content,
          linkedHandoutIds: input.linkedHandoutIds,
          updatedAt: new Date().toISOString(),
        } : undefined,
        deleted: input.action === "delete",
        demo: true,
      });
    }
    const supabase = await createClient();
    const { data: owner, error: ownerError } = await supabase
      .from("character_owners")
      .select("campaign_id")
      .eq("campaign_id", input.campaignId)
      .eq("character_id", input.characterId)
      .eq("user_id", ownerUserId)
      .not("confirmed_at", "is", null)
      .maybeSingle();
    if (ownerError || !owner) throw new Error("Caderno não vinculado a esta conta e personagem.");

    if (input.action === "delete") {
      const { error } = await supabase
        .from("player_notebook_pages")
        .delete()
        .eq("id", input.pageId)
        .eq("campaign_id", input.campaignId)
        .eq("character_id", input.characterId)
        .eq("user_id", ownerUserId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ deleted: true });
    }

    if (input.linkedHandoutIds.length > 0) {
      const { data: allowedHandouts, error } = await supabase
        .from("handouts")
        .select("id")
        .eq("campaign_id", input.campaignId)
        .in("id", input.linkedHandoutIds)
        .is("deleted_at", null);
      if (error || allowedHandouts.length !== input.linkedHandoutIds.length)
        throw new Error("Uma das pistas vinculadas não está disponível neste caderno.");
    }

    let pageId = input.pageId;
    if (!pageId) {
      const { data: lastPage, error: pageNumberError } = await supabase
        .from("player_notebook_pages")
        .select("page_number")
        .eq("user_id", ownerUserId)
        .eq("character_id", input.characterId)
        .order("page_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pageNumberError) throw new Error(pageNumberError.message);
      const { data, error } = await supabase
        .from("player_notebook_pages")
        .insert({
          campaign_id: input.campaignId,
          user_id: ownerUserId,
          character_id: input.characterId,
          page_number: (lastPage?.page_number ?? 0) + 1,
          title: input.title.trim(),
          content: input.content,
          linked_handout_ids: input.linkedHandoutIds,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      pageId = data.id;
    } else {
      const { error } = await supabase
        .from("player_notebook_pages")
        .update({
          title: input.title.trim(),
          content: input.content,
          linked_handout_ids: input.linkedHandoutIds,
        })
        .eq("id", pageId)
        .eq("campaign_id", input.campaignId)
        .eq("character_id", input.characterId)
        .eq("user_id", ownerUserId);
      if (error) throw new Error(error.message);
    }
    const { data: saved, error: savedError } = await supabase
      .from("player_notebook_pages")
      .select("id,page_number,title,content,linked_handout_ids,updated_at")
      .eq("id", pageId)
      .single();
    if (savedError) throw new Error(savedError.message);
    return NextResponse.json({ item: {
      id: saved.id,
      pageNumber: saved.page_number,
      title: saved.title,
      content: saved.content,
      linkedHandoutIds: saved.linked_handout_ids ?? [],
      updatedAt: saved.updated_at,
    } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operação inválida no caderno." },
      { status: 400 },
    );
  }
}
