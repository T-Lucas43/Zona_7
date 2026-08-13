import { randomInt } from "node:crypto";

const DICE_PATTERN =
  /^(\d{0,2})d(4|6|8|10|12|20|100)(?:(kh|kl)(\d{1,2}))?([+-]\d{1,4})?(?:\s+([\p{L}][\p{L}\s-]{0,39}))?$/iu;
const ATTRIBUTE_DICE_PATTERN = /^([+-])(\d{0,2})d20$/i;

export interface ParsedDiceFormula {
  count: number;
  sides: 4 | 6 | 8 | 10 | 12 | 20 | 100;
  keep?: { mode: "highest" | "lowest"; count: number };
  modifier: number;
  label?: string;
  normalized: string;
}

export interface DiceResult extends ParsedDiceFormula {
  rolls: number[];
  keptIndexes: number[];
  total: number;
}

export function parseDiceFormula(input: string): ParsedDiceFormula {
  const value = input.trim().replace(/\s*([+-])\s*/g, "$1");
  const attributeDice = ATTRIBUTE_DICE_PATTERN.exec(value);
  if (attributeDice) {
    const adjustment = attributeDice[1] === "-" ? -1 : 1;
    const magnitude = attributeDice[2] ? Number(attributeDice[2]) : 1;
    if (magnitude < 1 || magnitude > 50) throw new Error("Use entre 1 e 50 dados.");
    const count = magnitude + 1;
    return {
      count,
      sides: 20,
      keep: { mode: adjustment > 0 ? "highest" : "lowest", count: 1 },
      modifier: 0,
      normalized: `${count}d20${adjustment > 0 ? "kh1" : "kl1"}`,
    };
  }
  const match = DICE_PATTERN.exec(value);
  if (!match) throw new Error("Fórmula de dados inválida.");

  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]) as ParsedDiceFormula["sides"];
  const keepCount = match[4] ? Number(match[4]) : undefined;
  const modifier = match[5] ? Number(match[5]) : 0;
  const label = match[6]?.trim();

  if (count < 1 || count > 50) throw new Error("Use entre 1 e 50 dados.");
  if (keepCount !== undefined && (keepCount < 1 || keepCount > count)) {
    throw new Error("A quantidade mantida deve caber no conjunto de dados.");
  }

  const keep = match[3]
    ? {
        mode: match[3].toLowerCase() === "kh" ? ("highest" as const) : ("lowest" as const),
        count: keepCount!,
      }
    : undefined;
  const keepNotation = keep ? `${keep.mode === "highest" ? "kh" : "kl"}${keep.count}` : "";
  const modifierNotation = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : String(modifier);
  const normalized = `${count}d${sides}${keepNotation}${modifierNotation}${label ? ` ${label}` : ""}`;

  return { count, sides, keep, modifier, label, normalized };
}

export function executeDiceRoll(
  formula: string,
  secureRandom: (min: number, max: number) => number = randomInt,
): DiceResult {
  const parsed = parseDiceFormula(formula);
  const rolls = Array.from({ length: parsed.count }, () => secureRandom(1, parsed.sides + 1));
  const ranked = rolls
    .map((value, index) => ({ value, index }))
    .sort((a, b) =>
      parsed.keep?.mode === "lowest"
        ? a.value - b.value || a.index - b.index
        : b.value - a.value || a.index - b.index,
    );
  const keptIndexes = parsed.keep
    ? ranked.slice(0, parsed.keep.count).map(({ index }) => index)
    : rolls.map((_, index) => index);
  const total = keptIndexes.reduce((sum, index) => sum + rolls[index], parsed.modifier);
  return { ...parsed, rolls, keptIndexes, total };
}
