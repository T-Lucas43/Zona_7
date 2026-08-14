export const rpgDiceSides = [4, 6, 8, 10, 12, 20, 100] as const;
export const rpgDiceQuantities = Array.from({ length: 20 }, (_, index) => index + 1);
export const rpgDiceBonuses = Array.from({ length: 71 }, (_, index) => index - 20);

export type RpgDiceSides = (typeof rpgDiceSides)[number];

export function buildRpgDiceFormula(
  quantity: number,
  sides: RpgDiceSides,
  bonus: number,
) {
  if (!Number.isInteger(quantity) || !rpgDiceQuantities.includes(quantity)) {
    throw new Error("Quantidade de dados inválida.");
  }
  if (!rpgDiceSides.includes(sides)) throw new Error("Dado não permitido pelas regras.");
  if (!Number.isInteger(bonus) || !rpgDiceBonuses.includes(bonus)) {
    throw new Error("Bônus fora das opções permitidas.");
  }
  const modifier = bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : String(bonus);
  return `${quantity}d${sides}${modifier}`;
}
