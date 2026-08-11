"use client";

import { useState } from "react";
import { Dices, LoaderCircle } from "lucide-react";

type Result = { total: number; rolls: number[]; normalized: string; keptIndexes: number[] };

export function DiceRoller({ compact = false }: { compact?: boolean }) {
  const [formula, setFormula] = useState("1d20+5");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function roll() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/dice/roll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ formula, purpose: "Rolagem livre", visibility: "session" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha na rolagem.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na rolagem.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`panel rounded-lg ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">fonte segura // servidor</p>
          <h2 className="mt-1 font-extrabold">Rolador de dados</h2>
        </div>
        <Dices className="text-[#cb3a47]" size={22} />
      </div>
      <div className="mt-4 flex gap-2">
        <label htmlFor="dice-formula" className="sr-only">
          Fórmula de dados
        </label>
        <input
          id="dice-formula"
          value={formula}
          onChange={(event) => setFormula(event.target.value)}
          className="field font-mono"
          placeholder="4d20kh1+10"
        />
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={roll}
          disabled={pending}
        >
          {pending ? <LoaderCircle className="animate-spin" size={17} /> : "Rolar"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-[#f07580]">
          {error}
        </p>
      )}
      {result && (
        <div
          className="mt-4 flex items-end justify-between rounded-md border border-[#33363d] bg-black/25 p-4"
          aria-live="polite"
        >
          <div>
            <span className="font-mono text-xs text-[#7e8189]">{result.normalized}</span>
            <div className="mt-1 flex gap-1.5 text-xs text-[#a6a9af]">
              {result.rolls.map((rollValue, index) => (
                <span
                  key={index}
                  className={
                    result.keptIndexes.includes(index)
                      ? "font-bold text-white"
                      : "line-through opacity-45"
                  }
                >
                  [{rollValue}]
                </span>
              ))}
            </div>
          </div>
          <strong className="text-4xl font-black text-[#ed5361]">{result.total}</strong>
        </div>
      )}
    </section>
  );
}
