export type InitiativeSortable = {
  id: string;
  display_name: string;
  initiative: number | null;
  position: number;
  initiative_bonus?: number | null;
  agility?: number | null;
};

export function sortInitiativeCombatants<T extends InitiativeSortable>(combatants: T[]): T[] {
  return [...combatants].sort(
    (left, right) =>
      (right.initiative ?? Number.NEGATIVE_INFINITY) -
        (left.initiative ?? Number.NEGATIVE_INFINITY) ||
      (right.initiative_bonus ?? 0) - (left.initiative_bonus ?? 0) ||
      (right.agility ?? 0) - (left.agility ?? 0) ||
      left.display_name.localeCompare(right.display_name, "pt-BR"),
  );
}
