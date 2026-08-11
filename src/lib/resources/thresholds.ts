import type { ResourceKind } from "@/types/domain";

export interface ThresholdRule {
  key: string;
  resource: ResourceKind;
  percent: number;
  label: string;
  severity: "warning" | "critical" | "zero";
}

export interface ThresholdState {
  ruleKey: string;
  armed: boolean;
}

export const defaultThresholds: ThresholdRule[] = [
  { key: "pv_wounded", resource: "pv", percent: 50, label: "Machucado", severity: "warning" },
  { key: "pv_critical", resource: "pv", percent: 25, label: "Crítico", severity: "critical" },
  { key: "pv_zero", resource: "pv", percent: 0, label: "Zero", severity: "zero" },
  { key: "san_unstable", resource: "san", percent: 50, label: "Instável", severity: "warning" },
  {
    key: "san_collapse",
    resource: "san",
    percent: 25,
    label: "Colapso iminente",
    severity: "critical",
  },
  { key: "san_zero", resource: "san", percent: 0, label: "Zero", severity: "zero" },
  { key: "pe_low", resource: "pe", percent: 25, label: "Baixo", severity: "warning" },
  { key: "pe_zero", resource: "pe", percent: 0, label: "Esgotado", severity: "zero" },
];

export function resourcePercent(current: number, maximum: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, (current / maximum) * 100));
}

export function crossedDownward(
  previous: number,
  next: number,
  maximum: number,
  percent: number,
): boolean {
  const threshold = (maximum * percent) / 100;
  return previous > threshold && next <= threshold;
}

export function updateThresholdStates(
  rules: ThresholdRule[],
  states: ThresholdState[],
  previous: number,
  next: number,
  maximum: number,
): { crossed: ThresholdRule[]; states: ThresholdState[] } {
  const stateMap = new Map(states.map((state) => [state.ruleKey, state.armed]));
  const crossed: ThresholdRule[] = [];
  const updated = rules.map((rule) => {
    const thresholdValue = (maximum * rule.percent) / 100;
    const armed = stateMap.get(rule.key) ?? true;
    if (armed && crossedDownward(previous, next, maximum, rule.percent)) crossed.push(rule);
    if (next > thresholdValue) return { ruleKey: rule.key, armed: true };
    if (crossed.some((item) => item.key === rule.key)) return { ruleKey: rule.key, armed: false };
    return { ruleKey: rule.key, armed };
  });
  return { crossed, states: updated };
}
