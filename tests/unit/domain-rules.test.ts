import { describe, expect, it } from "vitest";
import { canUseWithinLimit, validateAbilityCosts } from "@/lib/abilities/costs";
import { tickCondition } from "@/lib/conditions/duration";
import { progressMeter } from "@/lib/meters/progression";
import { canViewContent } from "@/lib/permissions/visibility";

describe("custos de habilidade", () => {
  it("desconta todos os custos somente quando há saldo", () => {
    const result = validateAbilityCosts({ pv: 20, pe: 5, san: 10 }, [
      { resource: "pe", amount: 3 },
      { resource: "san", amount: 2 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.remaining).toEqual({ pv: 20, pe: 2, san: 8 });
  });

  it("não altera nenhum recurso quando um custo falha", () => {
    const result = validateAbilityCosts({ pv: 20, pe: 1, san: 10 }, [
      { resource: "pe", amount: 3 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.remaining.pe).toBe(1);
    expect(canUseWithinLimit(1, 1)).toBe(false);
  });
});

describe("duração e medidor", () => {
  it("expira condição no evento correspondente", () => {
    expect(tickCondition({ unit: "round", remaining: 1 }, "turn").expired).toBe(false);
    expect(tickCondition({ unit: "round", remaining: 1 }, "round")).toMatchObject({
      remaining: 0,
      expired: true,
    });
  });

  it("limita progressão do medidor", () => {
    expect(progressMeter(4, 3)).toBe(5);
    expect(progressMeter(1, -3)).toBe(0);
  });
});

describe("visibilidade", () => {
  it("não revela conteúdo gm_only a jogador", () => {
    expect(canViewContent({ visibility: "gm_only", role: "player", isOwner: true })).toBe(false);
    expect(canViewContent({ visibility: "gm_only", role: "game_master" })).toBe(true);
  });

  it("restringe seleção e propriedade", () => {
    expect(canViewContent({ visibility: "selected", role: "player", isSelected: false })).toBe(
      false,
    );
    expect(canViewContent({ visibility: "owner_only", role: "player", isOwner: true })).toBe(true);
  });
});
