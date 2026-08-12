import Link from "next/link";
import {
  BookOpen,
  Boxes,
  Crosshair,
  Gauge,
  ListChecks,
  Mail,
  NotebookPen,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { ResourceBars } from "@/components/character/resource-bars";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { CharacterPdfActions } from "@/components/character/character-pdf-actions";
import { isCharacterFieldVisible, isCharacterSectionVisible } from "@/lib/character-visibility";
import { getAuthorizedCharacter } from "@/server/repositories/character-repository";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const character = await getAuthorizedCharacter(characterId);
  if (!character) {
    return (
      <section className="panel rounded-xl p-6">
        <h1 className="text-2xl font-black">Ficha não encontrada</h1>
        <p className="mt-2 text-sm text-[#91949b]">
          Você não possui autorização para este personagem.
        </p>
      </section>
    );
  }
  const sections = [
    ["skills", "Perícias", ListChecks],
    ["inventory", "Inventário", Boxes],
    ["abilities", "Habilidades", Gauge],
    ["weaknesses", "Fraquezas", AlertTriangle],
    ["combat", "Combate", Crosshair],
    ["messages", "Mensagens", Mail],
    ["handouts", "Pistas", BookOpen],
    ["history", "Histórico", NotebookPen],
  ] as const;
  const visibleSections = sections.filter(([slug]) => isCharacterSectionVisible(character, slug));
  const identity = [
    isCharacterFieldVisible(character, "origin") ? character.origin : null,
    isCharacterFieldVisible(character, "class") ? character.className : null,
    isCharacterFieldVisible(character, "path") ? character.path : null,
  ].filter(Boolean);
  return (
    <div>
      <section className="panel overflow-hidden rounded-xl">
        <div className="border-b border-[#292c32] bg-[radial-gradient(circle_at_80%_0%,rgba(181,37,50,0.2),transparent_20rem)] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              {isCharacterFieldVisible(character, "portrait") && <CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} className="size-24 rounded-xl" />}
              <div>
                <p className="eyebrow">ficha autorizada{isCharacterFieldVisible(character, "nex") ? ` // nex ${character.nex}%` : ""}</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">{character.name}</h1>
                {isCharacterFieldVisible(character, "codename") && character.codename && <p className="mt-1 text-sm font-bold text-[#d2a4a9]">{character.codename}</p>}
                {identity.length > 0 && <p className="mt-2 text-sm text-[#9699a0]">{identity.join(" · ")}</p>}
                {isCharacterFieldVisible(character, "role") && <p className="mt-2 text-xs text-[#777a82]">{character.role}</p>}
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              {isCharacterFieldVisible(character, "status") && <span className="tag border-[#5d3036] text-[#e9979f]">STATUS: {character.status.toUpperCase()}</span>}
              <CharacterPdfActions characterId={character.id} compact />
            </div>
          </div>
        </div>
        <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[0.85fr_1.15fr]">
          {isCharacterSectionVisible(character, "resources") && <div>
            <h2 className="mb-4 text-sm font-extrabold">Recursos vitais</h2>
            <ResourceBars resources={character.resources} />
          </div>}
          <div>
            {isCharacterFieldVisible(character, "attributes") && <div className="grid grid-cols-5 gap-2">
              {Object.entries(character.attributes).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded border border-[#30333a] bg-black/20 p-3 text-center"
                >
                  <span className="block font-mono text-[0.65rem] uppercase text-[#73767d]">
                    {key}
                  </span>
                  <strong className="mt-1 block text-xl">{value}</strong>
                </div>
              ))}
            </div>}
            <div className="mt-4 flex flex-wrap gap-2">
              {isCharacterFieldVisible(character, "defense") && <span className="tag">
                <Shield size={12} /> Defesa {character.defense}
              </span>}
              {isCharacterFieldVisible(character, "movement") && <span className="tag">Deslocamento {character.movement ?? 0} m</span>}
              {isCharacterFieldVisible(character, "meter") && <span className="tag">
                {character.meter.name}: {character.meter.stages[character.meter.value]}
              </span>}
              {isCharacterFieldVisible(character, "conditions") && character.conditions.map((condition) => (
                <span className="tag border-[#663039] text-[#e98f99]" key={condition}>
                  {condition}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {visibleSections.map(([slug, label, Icon]) => (
          <Link
            href={`/app/characters/${character.id}/${slug}`}
            className="btn h-auto flex-col py-4 text-center"
            key={slug}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
