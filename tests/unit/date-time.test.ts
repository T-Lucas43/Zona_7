import { describe, expect, it } from "vitest";
import { formatClockTime, formatDateTime } from "../../src/lib/date-time";

describe("date-time", () => {
  it("exibe o horário no fuso de Belém", () => {
    expect(formatClockTime("2026-08-14T15:30:00.000Z")).toBe("12:30");
    expect(formatDateTime("2026-08-14T15:30:00.000Z")).toContain("12:30");
  });

  it("protege a interface de timestamps inválidos", () => {
    expect(formatClockTime("inválido")).toBe("--:--");
    expect(formatDateTime("inválido")).toBe("Data indisponível");
  });
});
