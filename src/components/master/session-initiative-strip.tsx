"use client";

import { Crown, Swords } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type { CharacterSummary } from "@/types/domain";
import type {
  AtorDaCampanha,
  CenaDaCampanha,
  EncontroDaCampanha,
} from "@/server/repositories/master-repository";

function matchesCharacter(name: string, character: CharacterSummary) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const combatant = normalize(name);
  const fullName = normalize(character.name);
  return combatant === fullName || combatant === fullName.split(/\s+/)[0];
}

export function SessionInitiativeStrip({
  encounter,
  characters,
  onSelectCharacter,
  onSelectCombatant,
  selectedCombatantId,
  actors = [],
  sceneTokens,
}: {
  encounter: EncontroDaCampanha | null;
  characters: CharacterSummary[];
  onSelectCharacter: (characterId: string) => void;
  onSelectCombatant: (combatant: EncontroDaCampanha["combatentes"][number]) => void;
  selectedCombatantId?: string;
  actors?: AtorDaCampanha[];
  sceneTokens: CenaDaCampanha["tokens"];
}) {
  if (!encounter || encounter.estado === "ended" || encounter.iniciativaEstado === "idle") {
    return (
      <section className="session-initiative-strip is-empty" aria-label="Ordem de iniciativa">
        <Swords size={16} />
        <span>O mestre ainda não solicitou a iniciativa.</span>
      </section>
    );
  }
  const current = encounter.combatentes.find((combatant) => combatant.atual);
  return (
    <section className="session-initiative-strip" aria-label="Ordem de iniciativa">
      <div className="session-initiative-round">
        <span>Rodada</span>
        <strong>{Math.max(1, encounter.rodada)}</strong>
      </div>
      <ol>
        {encounter.combatentes.map((combatant, index) => {
          const character = characters.find(
            (item) => item.id === combatant.characterId || matchesCharacter(combatant.nome, item),
          );
          const actor = actors.find((item) => item.id === combatant.actorId);
          const sceneToken = sceneTokens.find(
            (token) =>
              (combatant.actorId && token.atorId === combatant.actorId) ||
              (combatant.characterId && token.characterId === combatant.characterId),
          );
          const mapPortraitUrl = sceneToken?.mapPortraitUrl ?? actor?.mapPortraitUrl;
          const initiativePortraitUrl =
            mapPortraitUrl ?? sceneToken?.portraitUrl ?? character?.portraitUrl ?? actor?.portraitUrl;
          const currentHp = character?.resources.pv.current ?? combatant.pvAtual;
          const maximumHp = character?.resources.pv.maximum ?? combatant.pvMaximo;
          const hpPercent =
            currentHp !== null && currentHp !== undefined && maximumHp
              ? Math.max(0, Math.min(100, (currentHp / maximumHp) * 100))
              : null;
          return (
            <li
              key={combatant.id}
              data-current={combatant.atual}
              data-selected={selectedCombatantId === combatant.id}
            >
              <span className="session-initiative-position">{index + 1}</span>
              <button
                type="button"
                aria-pressed={selectedCombatantId === combatant.id}
                title={`Abrir ações de ${character?.name ?? combatant.nome}`}
                onClick={() => {
                  onSelectCombatant(combatant);
                  if (character) onSelectCharacter(character.id);
                }}
              >
                {character || initiativePortraitUrl ? (
                  <CharacterPortrait
                    name={character?.name ?? actor?.nome ?? combatant.nome}
                    portraitUrl={initiativePortraitUrl}
                    className="size-10 rounded-full"
                    fit={mapPortraitUrl ? "contain" : "cover"}
                  />
                ) : (
                  <span className="session-initiative-npc">
                    {(combatant.nome ?? "NPC").slice(0, 2).toUpperCase()}
                  </span>
                )}
                {combatant.iniciativa !== null && (
                  <small aria-label={`Iniciativa ${combatant.iniciativa}`}>{combatant.iniciativa}</small>
                )}
              </button>
              {hpPercent !== null && (
                <span
                  className="session-initiative-health"
                  title={`PV ${currentHp}/${maximumHp}`}
                  aria-label={`Pontos de vida ${currentHp} de ${maximumHp}`}
                >
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
        <strong>{current?.nome ?? "Aguardando"}</strong>
      </div>
    </section>
  );
}
