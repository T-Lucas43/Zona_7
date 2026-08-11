import { describe, expect, it } from "vitest";
import { executeDiceRoll, parseDiceFormula } from "@/lib/dice/parser";

describe("parser seguro de dados", () => {
  it.each([
    ["d20", "1d20"],
    ["1d20 + 5", "1d20+5"],
    ["4d20kh1+10", "4d20kh1+10"],
    ["2d8+4", "2d8+4"],
    ["1d4 SAN", "1d4 SAN"],
    ["2d6 mental", "2d6 mental"],
  ])("normaliza %s", (input, normalized) => {
    expect(parseDiceFormula(input).normalized).toBe(normalized);
  });

  it("rejeita código e notações fora do contrato", () => {
    expect(() => parseDiceFormula("1d20; process.exit()")).toThrow();
    expect(() => parseDiceFormula("99d20")).toThrow("entre 1 e 50");
    expect(() => parseDiceFormula("2d20kh3")).toThrow("quantidade mantida");
  });

  it("mantém o maior resultado sem eval", () => {
    const values = [3, 18, 7, 12];
    let index = 0;
    const result = executeDiceRoll("4d20kh1+2", () => values[index++]);
    expect(result.rolls).toEqual(values);
    expect(result.keptIndexes).toEqual([1]);
    expect(result.total).toBe(20);
  });

  it("mantém os menores resultados", () => {
    const values = [8, 2, 5];
    let index = 0;
    const result = executeDiceRoll("3d10kl2", () => values[index++]);
    expect(result.keptIndexes.sort()).toEqual([1, 2]);
    expect(result.total).toBe(7);
  });
});
