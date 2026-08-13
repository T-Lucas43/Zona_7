"use client";

import { Crown, Swords } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type { CharacterSummary } from "@/types/domain";
import type { EncontroDaCampanha } from "@/server/repositories/master-repository";

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
}: {
  encounter: EncontroDaCampanha | null;
  characters: CharacterSummary[];
  onSelectCharacter: (characterId: string) => void;
}) {
  if (!encounter || encounter.estado === "ended") {
    return (
      <section className="session-initiative-strip is-empty" aria-label="Ordem de iniciativa">
        <Swords size={16} />
        <span>Iniciativa aguardando encontro ativo.</span>
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
          const character = characters.find((item) => matchesCharacter(combatant.nome, item));
          return (
            <li key={combatant.id} data-current={combatant.atual}>
              <span className="session-initiative-position">{index + 1}</span>
              <button
                type="button"
                disabled={!character}
                title={character ? `Abrir ações de ${character.name}` : combatant.nome}
                onClick={() => character && onSelectCharacter(character.id)}
              >
                {character ? (
                  <CharacterPortrait
                    name={character.name}
                    portraitUrl={character.portraitUrl}
                    className="size-10 rounded-full"
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
