import { Crown, Swords } from "lucide-react";
import type { InitiativeEntry } from "@/server/repositories/session-repository";

export function PlayerInitiativeStrip({
  initiative,
  round,
}: {
  initiative: InitiativeEntry[];
  round: number;
}) {
  if (initiative.length === 0) {
    return (
      <section className="session-initiative-strip is-empty" aria-label="Ordem de iniciativa">
        <Swords size={16} />
        <span>Nenhum encontro ativo.</span>
      </section>
    );
  }
  const current = initiative.find((entry) => entry.active);
  return (
    <section className="session-initiative-strip player-initiative-strip" aria-label="Ordem de iniciativa">
      <div className="session-initiative-round">
        <span>Rodada</span>
        <strong>{Math.max(1, round)}</strong>
      </div>
      <ol>
        {initiative.map((entry, index) => {
          const hpPercent =
            !entry.hiddenHp && entry.currentHp !== null && entry.maximumHp
              ? Math.max(0, Math.min(100, (entry.currentHp / entry.maximumHp) * 100))
              : null;
          return (
            <li key={entry.id} data-current={entry.active}>
              <span className="session-initiative-position">{index + 1}</span>
              <button
                type="button"
                disabled
                title={`${entry.name} · iniciativa ${entry.value ?? "não definida"} · ${entry.visibleState}${hpPercent !== null ? ` · PV ${entry.currentHp}/${entry.maximumHp}` : ""}`}
              >
                <span className={`session-initiative-npc ${["character", "player"].includes(entry.kind) ? "is-character" : ""}`}>
                  {entry.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                {entry.value !== null && (
                  <small aria-label={`Iniciativa ${entry.value}`}>{entry.value}</small>
                )}
              </button>
              {hpPercent !== null && (
                <span className="session-initiative-health" aria-label={`Pontos de vida ${entry.currentHp} de ${entry.maximumHp}`}>
                  <i style={{ width: `${hpPercent}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="session-initiative-current">
        <Crown size={15} />
        <span>Turno de</span>
        <strong>{current?.name ?? "Aguardando"}</strong>
      </div>
    </section>
  );
}
