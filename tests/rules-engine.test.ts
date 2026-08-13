import { describe, expect, it } from "vitest";
import {
  advanceCriticalCondition,
  applyDamage,
  buildCheckPlan,
  calculateHelpBonus,
  clampMeter,
  extendedTestState,
  immutableSnapshot,
  peLimitForNex,
  pressureBand,
  resolveCheck,
  resourceBand,
  validatePeSpend,
} from "@/lib/rules/engine";

describe("motor de regras Zona 7", () => {
  it("monta teste de atributo e perícia sem somar atributo", () => {
    expect(buildCheckPlan({ attribute: 3, training: "trained" })).toEqual({ diceCount: 3, keep: "highest", modifier: 5, formula: "3d20kh1+5" });
    expect(buildCheckPlan({ attribute: 0 })).toMatchObject({ diceCount: 2, keep: "lowest" });
  });

  it("distingue 20 natural de escolher 20", () => {
    expect(resolveCheck({ rolls: [20, 3], modifier: -30, difficulty: 40 })).toMatchObject({ success: true, natural20: true });
    expect(resolveCheck({ rolls: [], modifier: 0, difficulty: 25, mode: "take_20" })).toMatchObject({ success: false, natural20: false });
  });

  it("calcula ajuda por patamares de dez", () => {
    expect([9, 10, 20, 30].map((value) => calculateHelpBonus(value))).toEqual([0, 1, 2, 3]);
  });

  it("encerra teste estendido por sucessos ou terceira falha", () => {
    expect(extendedTestState({ requiredSuccesses: 3, successes: 2, failures: 1, contributionSucceeded: true }).status).toBe("succeeded");
    expect(extendedTestState({ requiredSuccesses: 5, successes: 1, failures: 2, contributionSucceeded: false }).status).toBe("failed");
  });

  it("aplica limite de PE por turno", () => {
    expect(peLimitForNex(10)).toBe(2);
    expect(peLimitForNex(35)).toBe(7);
    expect(validatePeSpend({ nex: 10, spentThisTurn: 1, cost: 2 }).allowed).toBe(false);
  });

  it("aplica RD, dano massivo e zero sem valor negativo", () => {
    expect(applyDamage({ currentPv: 30, maximumPv: 40, damage: 25, resistance: 5 })).toMatchObject({ suffered: 20, currentPv: 10, massive: true, massiveDifficulty: 19 });
    expect(applyDamage({ currentPv: 3, maximumPv: 40, damage: 2, resistance: 9 })).toMatchObject({ suffered: 0, currentPv: 3 });
  });

  it("resolve limiares e condições críticas", () => {
    expect(resourceBand("pv", 10, 40)).toBe("critical");
    expect(resourceBand("san", 19, 40)).toBe("disturbed");
    expect(advanceCriticalCondition({ condition: "dying", turnStarts: 2, profile: "zona7_convergencia" }).terminal).toBe(true);
  });

  it("limita medidor, pressão e clona snapshot", () => {
    expect(clampMeter(5, 1)).toBe(5);
    expect(pressureBand(6)).toBe("critical");
    const source = { rule: { difficulty: 15 } };
    const snapshot = immutableSnapshot(source);
    source.rule.difficulty = 30;
    expect(snapshot.rule.difficulty).toBe(15);
  });
});
