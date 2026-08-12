import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  characterId: z.string().min(2),
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(2).max(140),
  codename: z.string().trim().max(140),
  pronouns: z.string().trim().max(80),
  origin: z.string().trim().max(140),
  className: z.string().trim().max(140),
  pathName: z.string().trim().max(140),
  nex: z.number().int().min(0).max(100),
  narrativeStatus: z.string().trim().max(160),
  teamRole: z.string().trim().max(300),
  affinities: z.array(z.string().trim().min(1).max(80)).max(12),
  shortDescription: z.string().trim().max(1000),
  tagline: z.string().trim().max(300),
  publicHistory: z.string().trim().max(10_000),
  characterState: z.string().trim().min(1).max(80),
  identificationColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defense: z.number().int().min(0).max(999),
  blockValue: z.number().int().min(0).max(999),
  dodgeValue: z.number().int().min(0).max(999),
  movement: z.number().min(0).max(999),
  mainDc: z.number().int().min(0).max(999),
  pePerTurn: z.number().int().min(0).max(999),
  attributes: z.object({
    agi: z.number().int().min(0).max(99),
    for: z.number().int().min(0).max(99),
    int: z.number().int().min(0).max(99),
    pre: z.number().int().min(0).max(99),
    vig: z.number().int().min(0).max(99),
  }),
  resistances: z.object({
    fortitude: z.number().int().min(0).max(999),
    reflexes: z.number().int().min(0).max(999),
    willpower: z.number().int().min(0).max(999),
  }),
  reason: z.string().trim().min(2).max(500),
});
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    if (!isSupabaseConfigured)
      return NextResponse.json({ version: input.expectedVersion + 1, demo: true });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_character_profile", {
      p_character_id: input.characterId,
      p_expected_version: input.expectedVersion,
      p_name: input.name,
      p_codename: input.codename,
      p_pronouns: input.pronouns,
      p_origin: input.origin,
      p_class_name: input.className,
      p_path_name: input.pathName,
      p_nex: input.nex,
      p_narrative_status: input.narrativeStatus,
      p_team_role: input.teamRole,
      p_affinities: input.affinities,
      p_short_description: input.shortDescription,
      p_tagline: input.tagline,
      p_public_history: input.publicHistory,
      p_character_state: input.characterState,
      p_identification_color: input.identificationColor,
      p_defense: input.defense,
      p_block_value: input.blockValue,
      p_dodge_value: input.dodgeValue,
      p_movement: input.movement,
      p_main_dc: input.mainDc,
      p_pe_per_turn: input.pePerTurn,
      p_agility: input.attributes.agi,
      p_strength: input.attributes.for,
      p_intellect: input.attributes.int,
      p_presence: input.attributes.pre,
      p_vigor: input.attributes.vig,
      p_fortitude: input.resistances.fortitude,
      p_reflexes: input.resistances.reflexes,
      p_willpower: input.resistances.willpower,
      p_reason: input.reason,
      p_actor_user_id: user.id,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ficha inválida." },
      { status: 400 },
    );
  }
}
