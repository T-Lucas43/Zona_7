import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { ResourceBars } from "@/components/character/resource-bars";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { isCharacterFieldVisible, isCharacterSectionVisible } from "@/lib/character-visibility";
import type { CharacterSummary } from "@/types/domain";

export function CharacterCard({
  character,
  master = false,
  campaignId,
}: {
  character: CharacterSummary;
  master?: boolean;
  campaignId?: string;
}) {
  const href = master
    ? `/master/campaigns/${campaignId ?? "11111111-1111-4111-8111-111111111111"}/characters/${character.id}`
    : `/app/characters/${character.id}`;
  const showPortrait = master || isCharacterFieldVisible(character, "portrait");
  const showPath = master || isCharacterFieldVisible(character, "path");
  const showNex = master || isCharacterFieldVisible(character, "nex");
  const showResources = master || isCharacterSectionVisible(character, "resources");
  const showDefense = master || isCharacterFieldVisible(character, "defense");
  const showMeter = master || isCharacterFieldVisible(character, "meter");
  const showConditions = master || isCharacterFieldVisible(character, "conditions");
  return (
    <article className="panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        {showPortrait ? <CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} /> : <span className="grid size-11 shrink-0 place-items-center rounded-md border border-[#3a2a2e] bg-[#791b26]/20 font-mono text-sm font-black text-[#e16b76]">{character.name.slice(0, 2).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="truncate text-sm font-extrabold">{character.name}</h2>
              {(showPath || showNex) && <p className="mt-0.5 truncate text-[0.68rem] uppercase tracking-wide text-[#777a82]">
                {[showPath ? character.path : null, showNex ? `NEX ${character.nex}%` : null].filter(Boolean).join(" · ")}
              </p>}
            </div>
            <Link
              href={href}
              aria-label={`Abrir ficha de ${character.name}`}
              className="grid size-8 shrink-0 place-items-center rounded hover:bg-white/5"
            >
              <ChevronRight size={17} />
            </Link>
          </div>
          {showResources && <div className="mt-3">
            <ResourceBars resources={character.resources} compact />
          </div>}
          {(showDefense || showMeter || showConditions) && <div className="mt-3 flex flex-wrap gap-1.5">
            {showDefense && <span className="tag">DEF {character.defense}</span>}
            {showMeter && <span className="tag">
              {character.meter.name}: {character.meter.value}
            </span>}
            {showConditions && character.conditions.map((condition) => (
              <span key={condition} className="tag border-[#5e3137] text-[#e68e97]">
                <AlertTriangle size={11} /> {condition}
              </span>
            ))}
          </div>}
        </div>
      </div>
    </article>
  );
}
