export type InitiativeSortable = {
  id: string;
  display_name: string;
  initiative: number | null;
  position: number;
};

export function sortInitiativeCombatants<T extends InitiativeSortable>(combatants: T[]): T[] {
  return [...combatants].sort(
    (left, right) =>
      (right.initiative ?? Number.NEGATIVE_INFINITY) -
        (left.initiative ?? Number.NEGATIVE_INFINITY) ||
      left.display_name.localeCompare(right.display_name, "pt-BR"),
  );
}
