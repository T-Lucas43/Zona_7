export type TrainingRank = "untrained" | "trained" | "veteran" | "expert";
export type CheckMode = "roll" | "take_10" | "take_20";

export const TRAINING_BONUS: Record<TrainingRank, number> = {
  untrained: 0,
  trained: 5,
  veteran: 10,
  expert: 15,
};

export type CheckPlan = {
  diceCount: number;
  keep: "highest" | "lowest";
  modifier: number;
  formula: string;
};

export function buildCheckPlan(input: {
  attribute: number;
  training?: TrainingRank;
  skillBonus?: number;
  favorableDice?: number;
  unfavorableDice?: number;
  numericModifier?: number;
}): CheckPlan {
  const attribute = Math.max(0, Math.trunc(input.attribute));
  const circumstance = Math.trunc(input.favorableDice ?? 0) - Math.trunc(input.unfavorableDice ?? 0);
  const baseDice = attribute === 0 ? 2 : attribute;
  const effective = attribute === 0 ? baseDice - circumstance : baseDice + circumstance;
  const diceCount = Math.max(1, Math.abs(effective));
  const keep = attribute === 0 || effective < 1 ? "lowest" : "highest";
  const modifier =
    (input.skillBonus ?? TRAINING_BONUS[input.training ?? "untrained"]) +
    Math.trunc(input.numericModifier ?? 0);
  return {
    diceCount,
    keep,
    modifier,
    formula: `${diceCount}d20${diceCount > 1 ? keep === "highest" ? "kh1" : "kl1" : ""}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : modifier}`,
  };
}

export function resolveCheck(input: {
  rolls: number[];
  modifier: number;
  difficulty: number;
  keep?: "highest" | "lowest";
  mode?: CheckMode;
}) {
  const mode = input.mode ?? "roll";
  const chosen = mode === "take_10" ? 10 : mode === "take_20" ? 20 :
    (input.keep === "lowest" ? Math.min(...input.rolls) : Math.max(...input.rolls));
  const total = chosen + input.modifier;
  return {
    chosen,
    total,
    success: mode === "roll" && chosen === 20 ? true : total >= input.difficulty,
    natural20: mode === "roll" && chosen === 20,
    natural1: mode === "roll" && chosen === 1,
  };
}

export function calculateHelpBonus(total: number, difficulty = 10) {
  if (total < difficulty) return 0;
  return 1 + Math.floor((total - difficulty) / 10);
}

export function extendedTestState(input: {
  requiredSuccesses: number;
  successes: number;
  failures: number;
  contributionSucceeded: boolean;
}) {
  const successes = input.successes + (input.contributionSucceeded ? 1 : 0);
  const failures = input.failures + (input.contributionSucceeded ? 0 : 1);
  return {
    successes,
    failures,
    status: successes >= input.requiredSuccesses ? "succeeded" as const : failures >= 3 ? "failed" as const : "active" as const,
  };
}

export function peLimitForNex(nex: number) {
  return Math.max(1, Math.floor(Math.max(0, nex) / 5));
}

export function validatePeSpend(input: { nex: number; spentThisTurn: number; cost: number; exception?: boolean }) {
  const cost = Math.max(0, Math.trunc(input.cost));
  const limit = peLimitForNex(input.nex);
  const next = input.spentThisTurn + cost;
  return { limit, next, allowed: Boolean(input.exception) || next <= limit };
}

export function applyResourceChange(current: number, maximum: number, delta: number) {
  return Math.max(0, Math.min(maximum, current + delta));
}

export function applyDamage(input: { currentPv: number; maximumPv: number; damage: number; resistance?: number; ignoresResistance?: boolean }) {
  const raw = Math.max(0, Math.trunc(input.damage));
  const resistance = input.ignoresResistance ? 0 : Math.max(0, Math.trunc(input.resistance ?? 0));
  const suffered = Math.max(0, raw - resistance);
  const currentPv = applyResourceChange(input.currentPv, input.maximumPv, -suffered);
  const massive = suffered >= input.maximumPv / 2 && currentPv > 0;
  return {
    suffered,
    currentPv,
    massive,
    massiveDifficulty: massive ? 15 + 2 * Math.floor(suffered / 10) : null,
    dying: currentPv === 0,
  };
}

export type ResourceBand = "healthy" | "wounded" | "critical" | "zero" | "stable" | "disturbed" | "low";

export function resourceBand(resource: "pv" | "pe" | "san", current: number, maximum: number): ResourceBand {
  if (current <= 0) return "zero";
  const ratio = maximum > 0 ? current / maximum : 0;
  if (resource === "pv") return ratio <= 0.25 ? "critical" : ratio <= 0.5 ? "wounded" : "healthy";
  if (resource === "san") return ratio <= 0.25 ? "critical" : ratio < 0.5 ? "disturbed" : "stable";
  return ratio <= 0.25 ? "low" : "stable";
}

export function advanceCriticalCondition(input: { condition: "dying" | "insane"; turnStarts: number; profile: "zona7_convergencia" | "zona7_classic" }) {
  const next = input.turnStarts + 1;
  if (input.condition === "insane" && input.profile === "zona7_classic") return { turnStarts: next, terminal: false };
  return { turnStarts: next, terminal: next >= 3 };
}

export function evolveCondition(current: string, repeated: string) {
  if (current === "abalado" && repeated === "abalado") return "apavorado";
  return current;
}

export function clampMeter(value: number, delta: number, minimum = 0, maximum = 5) {
  return Math.min(maximum, Math.max(minimum, value + delta));
}

export function pressureBand(value: number) {
  const pressure = Math.min(7, Math.max(0, Math.trunc(value)));
  return pressure === 7 ? "limit" as const : pressure >= 5 ? "critical" as const : pressure >= 3 ? "unstable" as const : "controlled" as const;
}

export function immutableSnapshot<T>(value: T): Readonly<T> {
  return structuredClone(value) as Readonly<T>;
}

