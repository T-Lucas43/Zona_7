import { Dices } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";
import { formatClockTime, formatDateTime } from "@/lib/date-time";
import type { PublicDiceRoll } from "@/server/repositories/character-repository";

export function LiveRollFeed({ rolls }: { rolls: PublicDiceRoll[] }) {
  return (
    <section className="panel rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Dices size={17} className="text-[#d94a57]" />
        <h2 className="font-extrabold">Resultados públicos</h2>
      </div>
      <div className="mt-4 space-y-2">
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
      </div>
    </section>
  );
}
