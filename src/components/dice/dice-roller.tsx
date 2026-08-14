"use client";

import { useState } from "react";
import { Dices, LoaderCircle } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";
import { formatClockTime, formatDateTime } from "@/lib/date-time";
import {
  buildRpgDiceFormula,
  rpgDiceBonuses,
  rpgDiceQuantities,
  rpgDiceSides,
  type RpgDiceSides,
} from "@/lib/dice/options";

type Result = { total: number; rolls: number[]; normalized: string; keptIndexes: number[]; createdAt: string };

export function DiceRoller({
  compact = false,
  characterId,
  sessionId,
  disabledReason,
}: {
  compact?: boolean;
  characterId?: string;
  sessionId?: string;
  disabledReason?: string;
}) {
  const [quantity, setQuantity] = useState(1);
  const [sides, setSides] = useState<RpgDiceSides>(20);
  const [bonus, setBonus] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function roll() {
    setPending(true);
    setResult(null);
    setError("");
    const startedAt = Date.now();
    try {
      const formula = buildRpgDiceFormula(quantity, sides, bonus);
      const response = await fetch("/api/dice/roll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formula,
          purpose: "Rolagem livre",
          visibility: "session",
          characterId,
          sessionId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha na rolagem.");
      const remainingAnimation = Math.max(0, 900 - (Date.now() - startedAt));
      if (remainingAnimation > 0)
        await new Promise((resolve) => window.setTimeout(resolve, remainingAnimation));
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
      <div className="dice-choice-grid mt-4">
        <label>
          <span>Quantidade</span>
          <select
            className="field"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          >
            {rpgDiceQuantities.map((value) => (
              <option value={value} key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Dado</span>
          <select
            className="field"
            value={sides}
            onChange={(event) => setSides(Number(event.target.value) as RpgDiceSides)}
          >
            {rpgDiceSides.map((value) => (
              <option value={value} key={value}>d{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Bônus</span>
          <select
            className="field"
            value={bonus}
            onChange={(event) => setBonus(Number(event.target.value))}
          >
            {rpgDiceBonuses.map((value) => (
              <option value={value} key={value}>{value > 0 ? `+${value}` : value}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={roll}
          disabled={pending || Boolean(disabledReason)}
        >
          {pending ? <LoaderCircle className="animate-spin" size={17} /> : "Rolar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#858b94]">
        Rolagem selecionada: <strong className="font-mono text-[#d8dce2]">{buildRpgDiceFormula(quantity, sides, bonus)}</strong>
      </p>
      {(pending || result) && (
        <div className="dice-stage mt-4" aria-live="polite">
          <RollingDie rolling={pending} value={result?.total} />
        </div>
      )}
      {disabledReason && (
        <p className="mt-3 rounded border border-[#6b3038] bg-[#711924]/15 p-3 text-xs text-[#f0a5ad]">
          {disabledReason}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-[#f07580]">
          {error}
        </p>
      )}
      {result && !pending && (
        <div
          className="mt-4 flex items-end justify-between rounded-md border border-[#33363d] bg-black/25 p-4"
          aria-live="polite"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[#7e8189]">{result.normalized}</span>
              <time
                className="font-mono text-[0.65rem] text-[#a5a8af]"
                dateTime={result.createdAt}
                title={formatDateTime(result.createdAt)}
              >
                {formatClockTime(result.createdAt)}
              </time>
            </div>
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
