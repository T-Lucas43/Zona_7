export function progressMeter(current: number, delta: number, minimum = 0, maximum = 5) {
  if (minimum > maximum) throw new Error("Intervalo de medidor inválido.");
  return Math.max(minimum, Math.min(maximum, current + delta));
}
