import { describe, expect, it } from "vitest";
import {
  crossedDownward,
  defaultThresholds,
  resourcePercent,
  updateThresholdStates,
} from "@/lib/resources/thresholds";

describe("recursos e alertas", () => {
  it("calcula percentual com limites seguros", () => {
    expect(resourcePercent(25, 100)).toBe(25);
    expect(resourcePercent(120, 100)).toBe(100);
    expect(resourcePercent(3, 0)).toBe(0);
  });

  it("detecta somente o cruzamento descendente", () => {
    expect(crossedDownward(60, 50, 100, 50)).toBe(true);
    expect(crossedDownward(40, 30, 100, 50)).toBe(false);
    expect(crossedDownward(40, 60, 100, 50)).toBe(false);
  });

  it("não repete alerta enquanto continua abaixo do limite", () => {
    const rules = defaultThresholds.filter((rule) => rule.resource === "pv");
    const first = updateThresholdStates(rules, [], 60, 20, 100);
    expect(first.crossed.map((rule) => rule.key)).toEqual(["pv_wounded", "pv_critical"]);
    const second = updateThresholdStates(rules, first.states, 20, 10, 100);
    expect(second.crossed).toHaveLength(0);
  });

  it("rearma depois da recuperação e alerta em novo cruzamento", () => {
    const rules = defaultThresholds.filter((rule) => rule.key === "pv_critical");
    const crossed = updateThresholdStates(rules, [], 30, 20, 100);
    const recovered = updateThresholdStates(rules, crossed.states, 20, 80, 100);
    expect(recovered.states[0].armed).toBe(true);
    const crossedAgain = updateThresholdStates(rules, recovered.states, 80, 25, 100);
    expect(crossedAgain.crossed).toHaveLength(1);
  });
});
