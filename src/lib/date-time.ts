export const zona7TimeZone = "America/Belem";

function validDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatClockTime(value: string | Date, timeZone = zona7TimeZone) {
  const date = validDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

export function formatDateTime(value: string | Date, timeZone = zona7TimeZone) {
  const date = validDate(value);
  if (!date) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}
