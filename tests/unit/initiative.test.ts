import { describe, expect, it } from "vitest";
import { sortInitiativeCombatants } from "@/lib/initiative";

describe("ordem de iniciativa", () => {
  it("ordena o maior resultado primeiro e deixa valores não definidos no final", () => {
    const ordered = sortInitiativeCombatants([
      { id: "a", display_name: "Davi", initiative: 12, position: 0 },
      { id: "b", display_name: "Rivaldo", initiative: null, position: 1 },
      { id: "c", display_name: "Arya", initiative: 21, position: 2 },
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("usa o nome como desempate estável", () => {
    const ordered = sortInitiativeCombatants([
      { id: "m", display_name: "Magnus", initiative: 17, position: 0 },
      { id: "a", display_name: "Amber", initiative: 17, position: 1 },
    ]);
    expect(ordered.map((item) => item.display_name)).toEqual(["Amber", "Magnus"]);
  });
});
