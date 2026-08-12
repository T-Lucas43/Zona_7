import { describe, expect, it } from "vitest";
import { parseZona7Script } from "@/lib/scripts/zona7-parser";

const valid = `---
zona7_script_version: 1
id: teste-roteiro
title: Roteiro de teste
execution_mode: semi_automatic
start: abertura
variables:
  pressao: 0
---
:::zona7
id: abertura
type: narration
text: A porta abre sete segundos antes.
next: escolha
:::
:::zona7
id: escolha
type: choice
prompt: Por onde seguir?
options:
  - id: esquerda
    label: Esquerda
    goto: fim
:::
:::zona7
id: fim
type: session_end
title: Encerramento
:::`;

describe("roteiro Zona 7", () => {
  it("converte Markdown em documento canônico e arestas", () => {
    const result = parseZona7Script(valid, "markdown");
    expect(result.document.nodes).toHaveLength(3);
    expect(result.document.edges).toContainEqual({
      source: "abertura",
      target: "escolha",
      type: "next",
    });
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });
  it("rejeita código executável", () => {
    expect(() =>
      parseZona7Script(valid.replace("A porta abre", "javascript:alert(1)"), "markdown"),
    ).toThrow(/não autorizada/i);
  });
  it("detecta destino inexistente", () => {
    const result = parseZona7Script(valid.replace("goto: fim", "goto: ausente"), "markdown");
    expect(result.issues.some((issue) => issue.code === "missing_target")).toBe(true);
  });
  it("aceita perícia da ficha como fórmula dinâmica", () => {
    const source = valid.replace(
      "type: narration",
      "type: skill_test\nformula: character_skill\nskill: Percepção",
    );
    const result = parseZona7Script(source, "markdown");
    expect(result.issues.some((issue) => issue.code === "invalid_formula")).toBe(false);
  });
});
