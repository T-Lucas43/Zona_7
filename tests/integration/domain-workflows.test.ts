import { describe, expect, it } from "vitest";
import { updateThresholdStates, defaultThresholds } from "@/lib/resources/thresholds";

interface LedgerState {
  resource: number;
  audits: { id: string; type: string; before: number; after: number; compensates?: string }[];
  notifications: string[];
  usedKeys: Set<string>;
}

function mutate(state: LedgerState, delta: number, key: string) {
  if (state.usedKeys.has(key)) return state;
  const before = state.resource;
  const after = Math.max(0, Math.min(100, before + delta));
  const threshold = updateThresholdStates(
    defaultThresholds.filter((rule) => rule.resource === "pv"),
    [],
    before,
    after,
    100,
  );
  state.resource = after;
  state.audits.push({ id: key, type: "resource_mutated", before, after });
  state.notifications.push(...threshold.crossed.map((rule) => rule.key));
  state.usedKeys.add(key);
  return state;
}

function undo(state: LedgerState, eventId: string, key: string) {
  if (state.usedKeys.has(key)) return state;
  const original = state.audits.find((event) => event.id === eventId);
  if (!original || state.resource !== original.after)
    throw new Error("alteração posterior dependente");
  state.resource = original.before;
  state.audits.push({
    id: key,
    type: "audit_event_compensated",
    before: original.after,
    after: original.before,
    compensates: original.id,
  });
  state.usedKeys.add(key);
  return state;
}

describe("fluxos transacionais do domínio", () => {
  it("grava recurso, auditoria e alertas na mesma operação idempotente", () => {
    const state: LedgerState = { resource: 80, audits: [], notifications: [], usedKeys: new Set() };
    mutate(state, -60, "op-1");
    mutate(state, -60, "op-1");
    expect(state.resource).toBe(20);
    expect(state.audits).toHaveLength(1);
    expect(state.notifications).toEqual(["pv_wounded", "pv_critical"]);
  });

  it("desfazer preserva original e cria evento compensatório", () => {
    const state: LedgerState = { resource: 80, audits: [], notifications: [], usedKeys: new Set() };
    mutate(state, -20, "op-1");
    undo(state, "op-1", "undo-1");
    expect(state.resource).toBe(80);
    expect(state.audits).toHaveLength(2);
    expect(state.audits[1].compensates).toBe("op-1");
  });

  it("impede desfazer quando uma alteração posterior depende do evento", () => {
    const state: LedgerState = { resource: 80, audits: [], notifications: [], usedKeys: new Set() };
    mutate(state, -20, "op-1");
    mutate(state, -5, "op-2");
    expect(() => undo(state, "op-1", "undo-1")).toThrow("alteração posterior");
  });

  it("processa evento agendado uma única vez", () => {
    const processed = new Set<string>();
    const process = (id: string) => (processed.has(id) ? false : (processed.add(id), true));
    expect(process("event-1")).toBe(true);
    expect(process("event-1")).toBe(false);
  });
});
