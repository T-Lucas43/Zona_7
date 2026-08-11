import { describe, expect, it } from "vitest";
import { characterSheetVisibilitySchema, deliverySchema, playableCharacterSchema, sessionPublicStateSchema } from "@/lib/validation/schemas";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("validação da central de sessão", () => {
  it("aceita a criação de um personagem jogável completo", () => {
    const result = playableCharacterSchema.parse({
      campaignId,
      name: "Novo Sobrevivente",
      resources: { pv: 20, pe: 10, san: 20 },
      attributes: { agi: 1, for: 1, int: 2, pre: 2, vig: 1 },
    });
    expect(result.name).toBe("Novo Sobrevivente");
    expect(result.nex).toBe(0);
  });

  it("exige ao menos um personagem em uma entrega", () => {
    expect(() => deliverySchema.parse({ kind: "item", campaignId, targetCharacterIds: [], name: "Chave", quantity: 1 })).toThrow();
  });

  it("aceita pista para vários personagens", () => {
    const result = deliverySchema.parse({
      kind: "handout",
      campaignId,
      targetCharacterIds: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000006"],
      title: "Fita 07",
      publicExcerpt: "Sete segundos ausentes",
    });
    expect(result.targetCharacterIds).toHaveLength(2);
  });

  it("separa o estado público dos dados secretos do roteiro", () => {
    const state = sessionPublicStateSchema.parse({
      campaignId,
      sessionId: "50000000-0000-4000-8000-000000000001",
      sceneTitle: "Estúdio",
      publicSummary: "A câmera ligou.",
      publicObjective: "Encontrem a fita.",
      gmNotes: "não deve atravessar o schema",
    });
    expect(state).not.toHaveProperty("gmNotes");
  });

  it("aceita somente campos e seções conhecidas da ficha", () => {
    const visibility = characterSheetVisibilitySchema.parse({
      campaignId,
      characterId: "davi",
      visibleFields: ["portrait", "nex"],
      visibleSections: ["resources", "abilities"],
    });
    expect(visibility.visibleFields).toEqual(["portrait", "nex"]);
    expect(() => characterSheetVisibilitySchema.parse({ ...visibility, visibleSections: ["roteiro_do_mestre"] })).toThrow();
  });
});
