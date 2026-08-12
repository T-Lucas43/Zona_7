import Link from "next/link";
import { AlertTriangle, BookOpen, Boxes, Crosshair, Gauge, ListChecks, Mail, NotebookPen } from "lucide-react";
import { CharacterPdfActions } from "@/components/character/character-pdf-actions";
import { CharacterSheetOverview } from "@/components/character/character-sheet-overview";
import { isCharacterSectionVisible } from "@/lib/character-visibility";
import {
  getAuthorizedCharacter,
  getCharacterAbilities,
  getCharacterActions,
  getCharacterInventory,
  getCharacterSkills,
  getCharacterWeaknesses,
} from "@/server/repositories/character-repository";

export default async function CharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = await getAuthorizedCharacter(characterId);
  if (!character) {
    return <section className="panel rounded-xl p-6"><h1 className="text-2xl font-black">Ficha não encontrada</h1><p className="mt-2 text-sm text-[#91949b]">Você não possui autorização para este personagem.</p></section>;
  }

  const allowed = (section: string) => isCharacterSectionVisible(character, section);
  const [skills, actions, abilities, weaknesses, inventory] = await Promise.all([
    allowed("skills") ? getCharacterSkills(character.id) : Promise.resolve([]),
    allowed("combat") ? getCharacterActions(character.id) : Promise.resolve([]),
    allowed("abilities") ? getCharacterAbilities(character.id) : Promise.resolve([]),
    allowed("weaknesses") ? getCharacterWeaknesses(character.id) : Promise.resolve([]),
    allowed("inventory") ? getCharacterInventory(character.id) : Promise.resolve([]),
  ]);
  const safeAbilities = abilities.map((ability) => ability.state === "sealed" ? {
    ...ability,
    name: "Habilidade ainda não revelada",
    description: "O mestre ainda não disponibilizou as informações desta habilidade.",
    costs: {},
    limit: undefined,
  } : ability);
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">ficha autorizada // dados liberados pelo mestre</p><h1 className="mt-1 text-2xl font-black">{character.name}</h1></div>
        <CharacterPdfActions characterId={character.id} />
      </div>
      <CharacterSheetOverview character={character} skills={skills} actions={actions} abilities={safeAbilities} weaknesses={weaknesses} inventory={inventory} />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {sections.filter(([slug]) => allowed(slug)).map(([slug, label, Icon]) => (
          <Link href={`/app/characters/${character.id}/${slug}`} className="btn h-auto flex-col py-4 text-center" key={slug}><Icon size={19} /><span>{label}</span></Link>
        ))}
      </div>
    </div>
  );
}
