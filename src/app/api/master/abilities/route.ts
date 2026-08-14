import { NextResponse } from "next/server";
import { z } from "zod";
import { createCharacterAbility } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  characterId: z.string().min(2),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(2).max(4_000),
  actionType: z.string().trim().min(2).max(60),
  costs: z.object({
    pv: z.string().optional(),
    pe: z.string().optional(),
    san: z.string().optional(),
  }),
  recommendedNex: z.number().int().min(0).max(100),
  initialState: z.enum([
    "sealed",
    "masked",
    "discovered",
    "unlocked",
    "altered",
    "disabled",
    "lost",
  ]),
  useCriteria: z.string().trim().min(2).max(2_000),
  application: z.string().trim().min(2).max(2_000),
  testFormula: z.string().trim().min(2).max(80),
  difficulty: z.number().int().min(0).max(999).optional(),
  successEffect: z.string().trim().min(2).max(4_000),
  partialEffect: z.string().trim().max(4_000).optional(),
  failureEffect: z.string().trim().min(2).max(4_000),
  targetScope: z.enum(["self", "ally", "enemy", "any"]),
  targetMin: z.number().int().min(0).max(20),
  targetMax: z.number().int().min(0).max(20),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (input.targetMax < input.targetMin) throw new Error("O máximo de alvos não pode ser menor que o mínimo.");
    const user = await requireCampaignMaster(input.campaignId);
    const result = await createCharacterAbility({
      ...input,
      costs: Object.fromEntries(Object.entries(input.costs).filter(([, value]) => value?.trim())),
      actorUserId: user.id,
      idempotencyKey: crypto.randomUUID(),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Habilidade inválida." },
      { status: 400 },
    );
  }
}
