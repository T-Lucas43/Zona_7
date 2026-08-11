"use client";

import { useMemo, useState } from "react";
import { HeartPulse, Minus, Plus } from "lucide-react";
import { defaultThresholds, updateThresholdStates } from "@/lib/resources/thresholds";
import type { CharacterSummary, ResourceKind } from "@/types/domain";

const labels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

export function ResourceConsole({ initialCharacters }: { initialCharacters: CharacterSummary[] }) {
  const [items, setItems] = useState(initialCharacters);
  const [selectedId, setSelectedId] = useState(initialCharacters[0]?.id ?? "");
  const [kind, setKind] = useState<ResourceKind>("pv");
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState("Ajuste manual do mestre");
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);

  async function mutate(direction: -1 | 1) {
    if (!selected) return;
    const currentResource = selected.resources[kind];
    const nextValue = Math.max(
      0,
      Math.min(currentResource.maximum, currentResource.current + direction * Math.abs(amount)),
    );
    const rules = defaultThresholds.filter((rule) => rule.resource === kind);
    const { crossed } = updateThresholdStates(
      rules,
      [],
      currentResource.current,
      nextValue,
      currentResource.maximum,
    );
    const response = await fetch("/api/resources/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: selected.id,
        resource: kind,
        delta: direction * Math.abs(amount),
        operation:
          direction < 0
            ? kind === "pv"
              ? "damage"
              : kind === "pe"
                ? "spend"
                : "loss"
            : kind === "pv"
              ? "healing"
              : "recovery",
        source: "Console do mestre",
        reason,
        visibility: "owner_only",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Não foi possível alterar o recurso.");
    setItems((current) =>
      current.map((character) =>
        character.id === selected.id
          ? {
              ...character,
              resources: {
                ...character.resources,
                [kind]: { ...currentResource, current: nextValue },
              },
            }
          : character,
      ),
    );
    setNotice(
      crossed.length
        ? `${selected.name}: ${labels[kind]} cruzou ${crossed.map((rule) => rule.label).join(" e ")}. Alerta emitido uma vez.`
        : `${selected.name}: ${labels[kind]} ${currentResource.current} → ${nextValue}. Evento auditável criado.`,
    );
  }

  return (
    <section className="panel rounded-lg p-5">
      <div className="flex items-center gap-3">
        <HeartPulse className="text-[#df4855]" size={20} />
        <div>
          <p className="eyebrow">ação transacional</p>
          <h2 className="font-extrabold">Alterar recurso</h2>
        </div>
      </div>
      <label className="mt-3 block text-xs font-bold text-[#9b9ea5]">
        Motivo obrigatório
        <input
          className="field mt-1"
          minLength={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.6fr_0.5fr]">
        <label className="text-xs font-bold text-[#9b9ea5]">
          Personagem
          <select
            className="field mt-1"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#9b9ea5]">
          Recurso
          <select
            className="field mt-1"
            value={kind}
            onChange={(event) => setKind(event.target.value as ResourceKind)}
          >
            <option value="pv">PV</option>
            <option value="pe">PE</option>
            <option value="san">SAN</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#9b9ea5]">
          Valor
          <input
            className="field mt-1"
            type="number"
            min={1}
            max={999}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          className="btn border-[#6e252e] text-[#f0949d]"
          type="button"
          onClick={() => void mutate(-1)}
        >
          <Minus size={16} /> Aplicar perda
        </button>
        <button
          className="btn border-[#2f6147] text-[#7bd5a5]"
          type="button"
          onClick={() => void mutate(1)}
        >
          <Plus size={16} /> Aplicar recuperação
        </button>
      </div>
      {notice && (
        <p
          className="mt-4 rounded border border-[#383b42] bg-black/20 p-3 text-xs leading-5 text-[#c8c9cd]"
          aria-live="polite"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
