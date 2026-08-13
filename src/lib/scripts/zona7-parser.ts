import { z } from "zod";
import { parse, stringify } from "yaml";
import { parseDiceFormula } from "@/lib/dice/parser";

export const nodeTypes = [
  "scene_start",
  "location_description",
  "master_speech",
  "narration",
  "player_prompt",
  "free_roleplay",
  "choice",
  "skill_test",
  "group_test",
  "dice_roll",
  "combat_start",
  "combat_end",
  "message",
  "handout",
  "media",
  "music",
  "map_change",
  "token_action",
  "resource_change",
  "condition_change",
  "meter_change",
  "ability_unlock",
  "inventory_change",
  "timer",
  "vote",
  "checkpoint",
  "branch",
  "scene_end",
  "session_end",
] as const;

const nodeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,80}$/),
    type: z.enum(nodeTypes),
    title: z.string().optional(),
    text: z.string().optional(),
    visibility: z.string().optional(),
    next: z.string().optional(),
  })
  .passthrough();

const documentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: z.string().min(2),
  title: z.string().min(2),
  executionMode: z.enum(["manual", "semi_automatic", "automatic"]).default("semi_automatic"),
  startNodeId: z.string().min(2),
  variables: z.record(z.string(), z.unknown()).default({}),
  references: z.object({
    actors: z.array(z.string()),
    maps: z.array(z.string()),
    media: z.array(z.string()),
    items: z.array(z.string()),
    abilities: z.array(z.string()),
  }),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.string(),
      label: z.string().optional(),
    }),
  ),
});

export type Zona7Script = z.infer<typeof documentSchema>;
export type ScriptIssue = {
  severity: "warning" | "error";
  code: string;
  message: string;
  nodeId?: string;
  line?: number;
  column?: number;
  suggestion?: string;
};

const portugueseVariableKey = /^[a-zà-ÿ_][a-z0-9à-ÿ_]*$/i;
const reservedEnglishVariables = new Map([
  ["zone_pressure", "pressao_zona"],
  ["pressure", "pressao_zona"],
  ["scene", "cena_atual"],
  ["round", "rodada_atual"],
  ["turn", "turno_atual"],
  ["successes", "sucessos"],
  ["failures", "falhas"],
  ["synchronized_targets", "alvos_sincronizados"],
]);

// A fórmula pode ser uma rolagem fixa (ex.: 2d20+5) ou uma referência que
// será resolvida com os valores atuais da ficha quando o nó for executado.
const dynamicFormulas = new Set(["character_skill", "character_attribute"]);

const forbiddenKeys = /^(script|code|javascript|executable|shell|sql|command)$/i;
const forbiddenText =
  /<script|javascript:|\beval\s*\(|\bfunction\s*\(|\bimport\s*\(|\brequire\s*\(|https?:\/\//i;

function assertSafe(value: unknown, path = "roteiro") {
  if (typeof value === "string" && forbiddenText.test(value))
    throw new Error(`Conteúdo executável ou URL não autorizada em ${path}.`);
  if (Array.isArray(value))
    return value.forEach((item, index) => assertSafe(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) throw new Error(`Propriedade não permitida: ${path}.${key}.`);
      assertSafe(child, `${path}.${key}`);
    }
  }
}

function collectReferences(nodes: Array<Record<string, unknown>>) {
  const references = {
    actors: new Set<string>(),
    maps: new Set<string>(),
    media: new Set<string>(),
    items: new Set<string>(),
    abilities: new Set<string>(),
  };
  for (const node of nodes) {
    for (const key of ["speaker", "real_sender"] as const)
      if (typeof node[key] === "string") references.actors.add(node[key] as string);
    for (const key of ["scene_ref", "map_ref"] as const)
      if (typeof node[key] === "string") references.maps.add(node[key] as string);
    for (const key of ["music_ref", "sound_ref", "image_ref", "video_ref", "portrait_ref"] as const)
      if (typeof node[key] === "string") references.media.add(node[key] as string);
    if (typeof node.item === "string") references.items.add(node.item);
    if (typeof node.ability === "string") references.abilities.add(node.ability);
  }
  return Object.fromEntries(
    Object.entries(references).map(([key, values]) => [key, [...values]]),
  ) as Zona7Script["references"];
}

function collectEdges(nodes: Array<Record<string, unknown>>) {
  const edges: Zona7Script["edges"] = [];
  const add = (source: string, target: unknown, type: string, label?: string) => {
    if (typeof target === "string")
      edges.push({ source, target, type, ...(label ? { label } : {}) });
  };
  for (const node of nodes) {
    const source = String(node.id);
    add(source, node.next, "next");
    add(source, node.on_success, "success");
    add(source, node.on_partial, "partial");
    add(source, node.on_failure, "failure");
    add(source, node.fallback, "fallback");
    if (Array.isArray(node.options))
      for (const option of node.options as Array<Record<string, unknown>>)
        add(source, option.goto, "choice", typeof option.id === "string" ? option.id : undefined);
    if (Array.isArray(node.conditions))
      for (const condition of node.conditions as Array<Record<string, unknown>>)
        add(source, condition.goto ?? condition.else, "condition");
  }
  return edges;
}

function parseFrontMatter(source: string) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match)
    throw new Error("O roteiro Markdown precisa começar com front matter entre marcadores ---. ");
  const metadata = parse(match[1] ?? "") as Record<string, unknown>;
  return { metadata, body: source.slice(match[0].length) };
}

function normalizeMarkdown(source: string): Zona7Script {
  const { metadata, body } = parseFrontMatter(source);
  const blocks = [...body.matchAll(/:::zona7\s*\r?\n([\s\S]*?)\r?\n:::/g)];
  if (!blocks.length) throw new Error("Nenhum bloco :::zona7 foi encontrado.");
  const nodes = blocks.map((match) => nodeSchema.parse(parse(match[1] ?? ""))) as Array<
    Record<string, unknown>
  >;
  const edges = collectEdges(nodes);
  return documentSchema.parse({
    schemaVersion: Number(metadata.zona7_script_version ?? 1),
    id: metadata.id,
    title: metadata.title,
    executionMode: metadata.execution_mode ?? "semi_automatic",
    startNodeId: metadata.start,
    variables: metadata.variables ?? {},
    references: collectReferences(nodes),
    nodes,
    edges,
  });
}

function normalizeJson(source: string): Zona7Script {
  const raw = JSON.parse(source) as Record<string, unknown>;
  const nodes = (raw.nodes ?? []) as Array<Record<string, unknown>>;
  return documentSchema.parse({
    ...raw,
    schemaVersion: raw.schemaVersion ?? 1,
    executionMode: raw.executionMode ?? "semi_automatic",
    variables: raw.variables ?? {},
    references: raw.references ?? collectReferences(nodes),
    edges: raw.edges ?? collectEdges(nodes),
  });
}

export function validateZona7Script(document: Zona7Script) {
  const issues: ScriptIssue[] = [];
  for (const key of Object.keys(document.variables)) {
    if (!portugueseVariableKey.test(key))
      issues.push({ severity: "error", code: "invalid_variable", message: `A variável “${key}” usa caracteres não permitidos.`, suggestion: "Use letras, números e sublinhado, começando por uma letra." });
    const suggestion = reservedEnglishVariables.get(key.toLowerCase());
    if (suggestion)
      issues.push({ severity: "error", code: "variable_in_portuguese", message: `A variável “${key}” está em inglês e não pode ser publicada.`, suggestion: `Use “${suggestion}” para manter o roteiro em português.` });
  }
  const ids = new Set<string>();
  for (const node of document.nodes) {
    if (ids.has(node.id))
      issues.push({
        severity: "error",
        code: "duplicate_node",
        message: `ID duplicado: ${node.id}.`,
        nodeId: node.id,
      });
    ids.add(node.id);
    for (const key of ["formula", "attack_formula", "damage_formula"] as const) {
      const formula = node[key];
      if (typeof formula === "string") {
        if (dynamicFormulas.has(formula.trim().toLowerCase())) continue;
        try {
          parseDiceFormula(formula);
        } catch {
          issues.push({
            severity: "error",
            code: "invalid_formula",
            message: `Fórmula inválida em ${node.id}: ${formula}.`,
            nodeId: node.id,
          });
        }
      }
    }
  }
  if (!ids.has(document.startNodeId))
    issues.push({ severity: "error", code: "missing_start", message: "O nó inicial não existe." });
  for (const edge of document.edges)
    if (!ids.has(edge.target))
      issues.push({
        severity: "error",
        code: "missing_target",
        message: `O destino ${edge.target} não existe.`,
        nodeId: edge.source,
      });
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const edge of document.edges.filter((item) => item.source === id)) visit(edge.target);
  };
  if (ids.has(document.startNodeId)) visit(document.startNodeId);
  for (const id of ids)
    if (!reachable.has(id))
      issues.push({
        severity: "warning",
        code: "unreachable_node",
        message: `O nó ${id} não é alcançado pelo caminho inicial.`,
        nodeId: id,
      });
  return issues;
}

export function parseZona7Script(source: string, format: "markdown" | "json") {
  if (source.length > 2_000_000) throw new Error("O roteiro ultrapassa o limite de 2 MB.");
  const document = format === "json" ? normalizeJson(source) : normalizeMarkdown(source);
  assertSafe(document);
  return {
    document,
    issues: validateZona7Script(document),
    normalizedMarkdown: stringify(document),
  };
}

function extractLocation(message: string) {
  const match = message.match(/(?:at line|line)\s+(\d+),\s*(?:column|col)\s+(\d+)/i);
  return match ? { line: Number(match[1]), column: Number(match[2]) } : {};
}

export function explainScriptError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const location = extractLocation(raw);
  const implicitKey = raw.match(/Implicit keys need to be on a single line[\s\S]*?:\s*([^\n]+)/i)?.[1]?.trim();
  if (/Implicit keys need to be on a single line/i.test(raw)) {
    const key = implicitKey?.split(/[\s:]/)[0] ?? "a chave indicada";
    return { message: `A chave “${key}” precisa ficar inteira em uma única linha.`, ...location, suggestion: "Revise a indentação e escreva no formato chave: valor. Para listas, coloque cada item em uma linha iniciada por dois espaços e um hífen.", technical: raw };
  }
  if (/bad indentation|indentation|All collection items must start/i.test(raw))
    return { message: "A indentação do YAML está incorreta.", ...location, suggestion: "Use dois espaços por nível e não utilize tabulação.", technical: raw };
  if (/Unexpected scalar|unexpected token|end of the stream/i.test(raw))
    return { message: "Há um valor ou marcador incompleto no roteiro.", ...location, suggestion: "Confira aspas, dois-pontos, colchetes e os marcadores :::zona7 próximos dessa posição.", technical: raw };
  if (raw.startsWith("["))
    return { message: "Alguns campos do roteiro estão fora do formato esperado.", ...location, suggestion: "Carregue o modelo pronto e compare os nomes e tipos dos campos.", technical: raw };
  return { message: raw, ...location, suggestion: "Confira o trecho indicado ou carregue o modelo pronto para comparar a estrutura.", technical: raw };
}
