import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { parseDiceFormula } from "@/lib/dice/parser";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const base = {
  campaignId: z.string().uuid(),
  characterId: z.string().min(2).max(100),
};

const schema = z.discriminatedUnion("area", [
  z.object({
    ...base,
    area: z.literal("skill"),
    operation: z.enum(["create", "update", "archive"]),
    id: z.string().min(2).max(100).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    attribute: z.enum(["AGI", "FOR", "INT", "PRE", "VIG"]).optional(),
    bonus: z.number().int().min(-99).max(99).optional(),
    training: z.enum(["destreinado", "treinado", "veterano", "expert"]).optional(),
    information: z.string().trim().max(2_000).optional(),
  }),
  z.object({
    ...base,
    area: z.literal("action"),
    operation: z.enum(["create", "update", "archive"]),
    id: z.string().min(2).max(100).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    test: z.string().trim().min(1).max(80).optional(),
    damage: z.string().trim().min(1).max(80).optional(),
    range: z.string().trim().max(100).optional(),
    damageType: z.string().trim().max(100).optional(),
    information: z.string().trim().max(4_000).optional(),
  }),
  z.object({
    ...base,
    area: z.literal("weakness"),
    operation: z.enum(["create", "update", "archive"]),
    id: z.string().min(2).max(100).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    effect: z.string().trim().min(2).max(2_000).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (input.operation !== "create" && !input.id) throw new Error("Registro inválido.");
    if (input.operation !== "archive" && (!input.name || input.name.trim().length < 2))
      throw new Error("Informe o nome do registro.");
    if (input.area === "action" && input.operation !== "archive") {
      if (!input.test || !input.damage) throw new Error("Informe as fórmulas de teste e efeito.");
      parseDiceFormula(input.test);
      parseDiceFormula(input.damage);
    }
    if (
      input.area === "skill" &&
      input.operation !== "archive" &&
      (!input.attribute || input.bonus === undefined || !input.training)
    )
      throw new Error("Complete atributo, bônus e treinamento.");
    if (input.area === "weakness" && input.operation !== "archive" && !input.effect)
      throw new Error("Descreva o efeito da fraqueza.");
    if (!isSupabaseConfigured)
      return NextResponse.json({ id: input.id ?? crypto.randomUUID(), demo: true });

    const supabase = await createClient();
    const { data: character } = await supabase
      .from("characters")
      .select("id")
      .eq("id", input.characterId)
      .eq("campaign_id", input.campaignId)
      .maybeSingle();
    if (!character) throw new Error("O personagem não pertence a esta campanha.");

    const table =
      input.area === "skill"
        ? "character_skills"
        : input.area === "action"
          ? "attacks"
          : "character_weaknesses";
    let id = input.id;
    if (input.operation === "archive") {
      const { error } = await supabase
        .from(table)
        .update({ is_active: false, deleted_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", input.id!)
        .eq("campaign_id", input.campaignId)
        .eq("character_id", input.characterId);
      if (error) throw new Error(error.message);
    } else {
      const payload =
        input.area === "skill"
          ? {
              campaign_id: input.campaignId,
              character_id: input.characterId,
              name: input.name!,
              related_attribute: input.attribute!.toLowerCase(),
              bonus: input.bonus!,
              base_bonus: input.bonus!,
              training_degree: input.training!,
              trained: input.training !== "destreinado",
              formula: `${input.attribute!.toLowerCase()}+${input.bonus!}`,
              notes: input.information || null,
              updated_by: user.id,
            }
          : input.area === "action"
            ? {
                campaign_id: input.campaignId,
                character_id: input.characterId,
                name: input.name!,
                attack_formula: input.test!,
                damage_formula: input.damage!,
                range_text: input.range || null,
                damage_type: input.damageType || null,
                description: input.information || null,
                updated_by: user.id,
              }
            : {
                campaign_id: input.campaignId,
                character_id: input.characterId,
                name: input.name!,
                narrative_description: input.effect!,
                mechanical_effect: input.effect!,
                updated_by: user.id,
              };
      if (input.operation === "create") {
        const { data, error } = await supabase
          .from(table)
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        id = data.id;
      } else {
        const { error } = await supabase
          .from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", input.id!)
          .eq("campaign_id", input.campaignId)
          .eq("character_id", input.characterId);
        if (error) throw new Error(error.message);
      }
    }
    await supabase.from("audit_events").insert({
      campaign_id: input.campaignId,
      actor_user_id: user.id,
      entity_type: input.area,
      entity_id: id,
      event_type: `${input.area}_${input.operation}`,
      visibility: "owner_only",
      after_data: input,
      metadata: { characterId: input.characterId },
      idempotency_key: crypto.randomUUID(),
    });
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível salvar o registro." },
      { status: 400 },
    );
  }
}
