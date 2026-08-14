import { describe, expect, it } from "vitest";
import { buildRpgDiceFormula } from "@/lib/dice/options";

describe("opções do rolador de dados", () => {
  it("monta a fórmula somente a partir das opções selecionadas", () => {
    expect(buildRpgDiceFormula(3, 20, 5)).toBe("3d20+5");
    expect(buildRpgDiceFormula(2, 6, -1)).toBe("2d6-1");
    expect(buildRpgDiceFormula(1, 100, 0)).toBe("1d100");
  });

  it("recusa quantidade e bônus fora dos seletores", () => {
    expect(() => buildRpgDiceFormula(21, 20, 0)).toThrow("Quantidade");
    expect(() => buildRpgDiceFormula(1, 20, 51)).toThrow("Bônus");
  });
});
