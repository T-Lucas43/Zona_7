import { describe, expect, it } from "vitest";
import { explainScriptError, parseZona7Script } from "@/lib/scripts/zona7-parser";

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
  it("orienta a correção do YAML em português com linha e coluna", () => {
    const explained = explainScriptError(new Error("Implicit keys need to be on a single line at line 14, column 1: synchronized_targets: master"));
    expect(explained.message).toMatch(/precisa ficar inteira/i);
    expect(explained.line).toBe(14);
    expect(explained.column).toBe(1);
    expect(explained.suggestion).toMatch(/indentação/i);
  });
  it("avisa quando uma variável conhecida está em inglês", () => {
    const result = parseZona7Script(valid.replace("pressao: 0", "zone_pressure: 0"), "markdown");
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "error", code: "variable_in_portuguese", suggestion: expect.stringMatching(/pressao_zona/) }));
  });
});
