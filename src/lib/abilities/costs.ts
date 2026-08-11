import type { ResourceKind } from "@/types/domain";

export interface AbilityCost {
  resource: ResourceKind;
  amount: number;
}

export function validateAbilityCosts(
  resources: Record<ResourceKind, number>,
  costs: AbilityCost[],
): { valid: boolean; shortages: AbilityCost[]; remaining: Record<ResourceKind, number> } {
  const shortages = costs.filter(
    (cost) => cost.amount < 0 || resources[cost.resource] < cost.amount,
  );
  const remaining = { ...resources };
  if (shortages.length === 0) {
    for (const cost of costs) remaining[cost.resource] -= cost.amount;
  }
  return { valid: shortages.length === 0, shortages, remaining };
}

export function canUseWithinLimit(used: number, limit?: number): boolean {
  return limit === undefined || used < limit;
}
