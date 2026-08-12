import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export const resourceMutationSchema = z.object({
  characterId: z.string().min(2).max(100),
  resource: z.enum(["pv", "pe", "san"]),
  delta: z.number().int().min(-9999).max(9999),
  operation: z.enum(["damage", "healing", "loss", "recovery", "spend", "set", "transfer"]),
  source: z.string().trim().min(2).max(160),
  reason: z.string().trim().min(2).max(500),
  idempotencyKey: z.uuid(),
  sessionId: z.uuid().optional(),
  encounterId: z.uuid().optional(),
  visibility: z
    .enum(["public", "campaign", "selected", "owner_only", "gm_only"])
    .default("campaign"),
});

export const diceRollSchema = z.object({
  formula: z.string().trim().min(2).max(80),
  characterId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
  purpose: z.string().trim().min(2).max(160),
  visibility: z.enum(["session", "player_master", "master", "hidden"]).default("session"),
  requestId: z.uuid().optional(),
});

export const messageSchema = z.object({
  campaignId: z.uuid(),
  apparentSenderName: z.string().trim().min(1).max(100),
  recipientUserIds: z.array(z.uuid()).min(1).max(100),
  body: z.string().trim().min(1).max(10000),
  format: z.enum([
    "text",
    "image",
    "audio",
    "video",
    "document",
    "clue",
    "roll_request",
    "choice",
    "manifestation",
  ]),
  visibility: z.enum(["selected", "gm_only"]),
  expiresAt: z.iso.datetime().optional(),
  idempotencyKey: z.uuid(),
});

const shortText = z.string().trim().max(160);

export const playableCharacterSchema = z.object({
  campaignId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  codename: shortText.default(""),
  origin: shortText.default(""),
  className: shortText.default(""),
  pathName: shortText.default(""),
  nex: z.number().int().min(0).max(100).default(0),
  defense: z.number().int().min(0).max(99).default(10),
  resources: z.object({
    pv: z.number().int().min(0).max(9999),
    pe: z.number().int().min(0).max(9999),
    san: z.number().int().min(0).max(9999),
  }),
  attributes: z.object({
    agi: z.number().int().min(0).max(10),
    for: z.number().int().min(0).max(10),
    int: z.number().int().min(0).max(10),
    pre: z.number().int().min(0).max(10),
    vig: z.number().int().min(0).max(10),
  }),
  ownerUserId: z.uuid().nullable().optional(),
});

export const deliverySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("item"),
    campaignId: z.uuid(),
    targetCharacterIds: z.array(z.string().min(2).max(100)).min(1).max(100),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).default(""),
    quantity: z.number().int().min(1).max(999).default(1),
  }),
  z.object({
    kind: z.literal("handout"),
    campaignId: z.uuid(),
    targetCharacterIds: z.array(z.string().min(2).max(100)).min(1).max(100),
    title: z.string().trim().min(2).max(200),
    publicExcerpt: z.string().trim().max(1000).default(""),
    protectedText: z.string().trim().max(20000).default(""),
  }),
]);

export const sessionVisibilitySchema = z.object({
  campaignId: z.uuid(),
  characterId: z.string().min(2),
  visible: z.boolean(),
});

export const sessionPublicStateSchema = z.object({
  campaignId: z.uuid(),
  sessionId: z.string().min(2),
  sceneTitle: z.string().trim().min(2).max(200),
  publicSummary: z.string().trim().max(5000),
  publicObjective: z.string().trim().max(1000),
});

export const sessionControlSchema = z.object({
  campaignId: z.uuid(),
  sessionId: z.string().min(2),
  action: z.enum(["start", "pause", "resume", "reopen", "restart", "advance", "end"]),
});

const characterSheetFields = [
  "portrait", "codename", "origin", "class", "path", "nex", "status", "role",
  "defense", "movement", "attributes", "meter", "conditions",
] as const;

const characterSheetSections = [
  "resources", "skills", "combat", "abilities", "weaknesses", "inventory",
  "messages", "handouts", "history",
] as const;

export const characterSheetVisibilitySchema = z.object({
  campaignId: z.uuid(),
  characterId: z.string().min(2).max(100),
  visibleFields: z.array(z.enum(characterSheetFields)).max(characterSheetFields.length),
  visibleSections: z.array(z.enum(characterSheetSections)).max(characterSheetSections.length),
});
