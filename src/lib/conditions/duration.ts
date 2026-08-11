export type DurationUnit = "turn" | "round" | "scene" | "session" | "permanent";

export interface ConditionDuration {
  unit: DurationUnit;
  remaining: number | null;
}

export function tickCondition(
  duration: ConditionDuration,
  event: Exclude<DurationUnit, "permanent">,
) {
  if (duration.unit !== event || duration.remaining === null)
    return { ...duration, expired: false };
  const remaining = Math.max(0, duration.remaining - 1);
  return { ...duration, remaining, expired: remaining === 0 };
}
