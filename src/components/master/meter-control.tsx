"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MeterControl({
  campaignId,
  characterId,
  name,
  initialValue,
  stages,
}: {
  campaignId: string;
  characterId: string;
  name: string;
  initialValue: number;
  stages: string[];
}) {
  const [value, setValue] = useState(initialValue);
  const [reason, setReason] = useState("Ajuste narrativo do mestre");
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState("");
  async function change(next: number) {
    const bounded = Math.max(0, Math.min(stages.length - 1, next));
    const response = await fetch("/api/master/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterId,
        delta: bounded - value,
        targetValue: bounded,
        reason,
        playerVisibleReason: visible ? reason : null,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar medidor.");
    setValue(bounded);
    setNotice(`Medidor atualizado para ${stages[bounded]}.`);
  }
  return (
    <section className="panel rounded-lg p-4">
      <p className="eyebrow">medidor exclusivo</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          className="btn px-2 py-2"
          type="button"
          onClick={() => void change(value - 1)}
          disabled={value === 0}
        >
          <ChevronLeft size={14} />
        </button>
        <div className="text-center">
          <strong>{name}</strong>
          <p className="mt-1 text-xs text-[#d7aeb2]">
            {value} · {stages[value]}
          </p>
        </div>
        <button
          className="btn px-2 py-2"
          type="button"
          onClick={() => void change(value + 1)}
          disabled={value === stages.length - 1}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="mt-3 flex gap-1">
        {stages.map((stage, index) => (
          <button
            type="button"
            title={stage}
            aria-label={`Ir para ${stage}`}
            className="h-2 flex-1 rounded-full"
            style={{ background: index <= value ? "#b8323c" : "#30333a" }}
            onClick={() => void change(index)}
            key={stage}
          />
        ))}
      </div>
      <label className="mt-3 block text-xs font-bold">
        Motivo
        <input
          className="field mt-1"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
        />{" "}
        Mostrar o motivo ao jogador
      </label>
      {notice && (
        <p role="status" className="mt-3 text-xs text-[#7bd5a5]">
          {notice}
        </p>
      )}
    </section>
  );
}
