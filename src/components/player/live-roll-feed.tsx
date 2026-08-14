"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Dices } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";
import { formatClockTime, formatDateTime } from "@/lib/date-time";
import type { PublicDiceRoll } from "@/server/repositories/character-repository";

export function LiveRollFeed({ rolls }: { rolls: PublicDiceRoll[] }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className="panel rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dices size={17} className="text-[#d94a57]" />
          <h2 className="font-extrabold">Resultados públicos</h2>
          <span className="tag">{rolls.length}</span>
        </div>
        <button className="btn px-2" type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? "Expandir resultados públicos" : "Minimizar resultados públicos"}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {rolls.map((roll) => (
          <article
            className="dice-feed-entry flex items-center justify-between gap-3 rounded border border-[#30333a] bg-black/20 p-3"
            key={roll.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-sm">
                  {roll.playerName}
                  {roll.characterName !== roll.playerName ? ` como ${roll.characterName}` : ""} ·{" "}
                  {roll.purpose}
                </strong>
                <time
                  className="rounded border border-[#343840] px-1.5 py-0.5 font-mono text-[0.62rem] text-[#b0b3ba]"
                  dateTime={roll.createdAt}
                  title={formatDateTime(roll.createdAt)}
                >
                  {formatClockTime(roll.createdAt)}
                </time>
              </div>
              <p className="mt-1 font-mono text-[0.65rem] text-[#858891]">
                {roll.formula} · [{roll.rolls.join(", ")}]
              </p>
            </div>
            <RollingDie value={roll.total} compact />
          </article>
        ))}
        {rolls.length === 0 && (
          <p className="text-sm text-[#777a82]">Nenhuma rolagem pública ainda.</p>
        )}
      </div>}
      {collapsed && rolls[0] && <p className="mt-2 truncate text-xs text-[#92969f]">Último: {rolls[0].playerName} · {rolls[0].purpose} · {rolls[0].total}</p>}
    </section>
  );
}
