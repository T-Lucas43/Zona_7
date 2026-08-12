import { CharacterPortrait } from "@/components/character/character-portrait";
import { isCharacterFieldVisible, isCharacterSectionVisible } from "@/lib/character-visibility";
import type { AbilitySummary, CharacterSummary } from "@/types/domain";

type Skill = { id: string; name: string; attribute: string; bonus: number; training: string; notes?: string };
type Action = { id: string; name: string; test: string; damage: string; range: string; type: string; description?: string };
type Weakness = { id: string; name: string; effect: string; active: boolean };
type InventoryItem = { id: string; name: string; detail: string; state: string };

export function CharacterSheetOverview({
  character,
  skills = [],
  actions = [],
  abilities = [],
  weaknesses = [],
  inventory = [],
  master = false,
}: {
  character: CharacterSummary;
  skills?: Skill[];
  actions?: Action[];
  abilities?: AbilitySummary[];
  weaknesses?: Weakness[];
  inventory?: InventoryItem[];
  master?: boolean;
}) {
  const field = (name: string) => master || isCharacterFieldVisible(character, name);
  const section = (name: string) => master || isCharacterSectionVisible(character, name);
  const identity = [
    field("origin") ? character.origin : null,
    field("class") ? character.className : null,
    field("path") ? character.path : null,
  ].filter(Boolean);
  const accent = character.identificationColor ?? "#b52532";
  const activeStage = Math.max(0, Math.min(character.meter.value, Math.max(character.meter.stages.length - 1, 0)));

  return (
    <article className="overflow-hidden rounded-xl border border-[#2d3037] bg-[#0e1014] shadow-2xl shadow-black/30">
      <header className="relative border-b border-[#34363d] bg-[radial-gradient(circle_at_82%_0%,rgba(181,37,50,0.22),transparent_24rem)] p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
        <div className="grid gap-5 lg:grid-cols-[128px_1fr_auto] lg:items-center">
          {field("portrait") && <CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} className="size-32 rounded-lg border border-[#4a2c31]" />}
          <div>
            <p className="eyebrow">zona 7 // ficha operacional</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.04em] sm:text-4xl">{character.name}</h2>
            {field("codename") && character.codename && <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#e26b75]">{character.codename}</p>}
            {field("tagline") && character.tagline && <p className="mt-3 max-w-3xl text-sm italic text-[#c5c7cc]">“{character.tagline}”</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {field("nex") && <span className="tag">NEX {character.nex}%</span>}
              {field("affinities") && (character.affinities ?? []).map((affinity) => <span className="tag border-[#5d3036] text-[#ef9ba3]" key={affinity}>{affinity}</span>)}
              {field("pronouns") && character.pronouns && <span className="tag">{character.pronouns}</span>}
            </div>
          </div>
          <div className="grid min-w-48 gap-2 text-right text-xs">
            {field("status") && <div><span className="text-[#777a82]">ESTADO</span><strong className="ml-2 uppercase">{character.status}</strong></div>}
            {field("role") && <div><span className="text-[#777a82]">FUNÇÃO</span><strong className="ml-2 uppercase">{character.role}</strong></div>}
            {field("description") && character.shortDescription && <p className="mt-2 max-w-xs text-left leading-5 text-[#a7a9af] lg:text-right">{character.shortDescription}</p>}
          </div>
        </div>
        {identity.length > 0 && <div className="mt-5 rounded border-l-4 border-[#c32736] bg-[#24272e] px-4 py-3 text-xs"><span className="font-mono uppercase text-[#ef7d87]">Identidade operacional</span><p className="mt-1 text-[#d8d9dc]">{identity.join(" · ")}</p></div>}
      </header>

      <div className="p-5 sm:p-7">
        {field("attributes") && (
          <section>
            <p className="eyebrow">atributos</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Object.entries(character.attributes).map(([key, value]) => (
                <div className="relative grid min-h-20 place-items-center rounded-lg border border-[#3a3d44] bg-[#191c22] text-center" key={key}>
                  <span className="absolute top-2 font-mono text-[0.62rem] uppercase text-[#ef6874]">{key}</span>
                  <strong className="mt-3 text-2xl">{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <p className="eyebrow">recursos e parâmetros</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {section("resources") && Object.values(character.resources).map((resource) => (
              <Stat key={resource.kind} label={`${resource.kind.toUpperCase()} atual / máx.`} value={`${resource.current} / ${resource.maximum}`} accent={resource.kind === "pv"} />
            ))}
            {field("defense") && <Stat label="Defesa" value={character.defense} />}
            {field("block") && <Stat label="Bloqueio" value={character.blockValue ?? 0} />}
            {field("dodge") && <Stat label="Esquiva" value={character.dodgeValue ?? 0} />}
            {field("movement") && <Stat label="Deslocamento" value={`${character.movement ?? 0} m`} />}
            {field("main_dc") && <Stat label="DT principal" value={character.mainDc ?? 0} />}
            {field("pe_per_turn") && <Stat label="PE por turno" value={character.pePerTurn ?? 0} />}
          </div>
        </section>

        {field("resistances") && (
          <section className="mt-6">
            <p className="eyebrow">resistências</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Object.entries(character.resistances ?? {}).map(([name, value]) => <Stat key={name} label={name} value={`+${value}`} />)}
            </div>
          </section>
        )}

        {section("skills") && skills.length > 0 && (
          <section className="mt-6">
            <p className="eyebrow">perícias</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {skills.map((skill) => <div className="rounded border border-[#30333a] bg-[#191c22] px-3 py-2" key={skill.id}><div className="flex items-center justify-between gap-2"><strong className="text-xs">{skill.name}</strong><b className="text-sm text-[#ef717c]">+{skill.bonus}</b></div><p className="mt-1 text-[0.65rem] uppercase text-[#777a82]">{skill.attribute} · {skill.training}</p>{skill.notes && <p className="mt-2 border-t border-[#30333a] pt-2 text-[0.68rem] leading-4 text-[#a7a9af]">{skill.notes}</p>}</div>)}
            </div>
          </section>
        )}

        {section("combat") && actions.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-lg border border-[#30333a]">
            <div className="bg-[#171a20] px-4 py-3"><p className="eyebrow">ataques e ações</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#24272e] font-mono uppercase text-[#ef717c]"><tr><th className="p-3">Ação</th><th className="p-3">Teste</th><th className="p-3">Dano</th><th className="p-3">Alcance</th><th className="p-3">Tipo</th></tr></thead><tbody>{actions.map((action) => <tr className="border-t border-[#30333a]" key={action.id}><td className="p-3"><strong>{action.name}</strong>{action.description && <small className="mt-1 block max-w-sm text-[#878a91]">{action.description}</small>}</td><td className="p-3">{action.test}</td><td className="p-3">{action.damage}</td><td className="p-3">{action.range}</td><td className="p-3">{action.type}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {field("meter") && character.meter.stages.length > 0 && (
          <section className="mt-6 rounded-lg border border-[#30333a] bg-[#171a20] p-4">
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">medidor especial</p><h3 className="mt-1 font-black uppercase">{character.meter.name}</h3></div><strong className="text-[#ef717c]">{activeStage} / {Math.max(character.meter.stages.length - 1, 0)}</strong></div>
            <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(character.meter.stages.length, 1)}, minmax(0, 1fr))` }}>{character.meter.stages.map((stage, index) => <div className={`rounded px-2 py-3 text-center text-[0.62rem] font-bold uppercase ${index <= activeStage ? "bg-[#a91f2d] text-white" : "bg-[#292c32] text-[#777a82]"}`} key={`${stage}-${index}`}>{stage}</div>)}</div>
          </section>
        )}

        {section("abilities") && abilities.length > 0 && <CardGrid title="habilidades liberadas" items={abilities.map((ability, index) => ({ id: ability.id, index: index + 1, title: ability.name, meta: [ability.actionType, ability.limit, Object.entries(ability.costs).flatMap(([kind, value]) => value ? [`${value} ${kind.toUpperCase()}`] : []).join(" · ")].filter(Boolean).join(" · "), body: ability.description }))} />}
        {section("weaknesses") && weaknesses.length > 0 && <CardGrid title="fraquezas, enigmas e controle" items={weaknesses.map((weakness, index) => ({ id: weakness.id, index: index + 1, title: weakness.name, meta: weakness.active ? "ATIVA" : "INATIVA", body: weakness.effect }))} />}

        {section("inventory") && inventory.length > 0 && (
          <section className="mt-6"><p className="eyebrow">inventário</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inventory.map((item) => <div className="rounded border border-[#30333a] bg-[#191c22] p-3" key={item.id}><div className="flex justify-between gap-3"><strong className="text-sm">{item.name}</strong><span className="text-[0.65rem] uppercase text-[#ef717c]">{item.state}</span></div><p className="mt-2 text-xs text-[#a7a9af]">{item.detail}</p></div>)}</div></section>
        )}

        {field("public_history") && character.publicHistory && <section className="mt-6 rounded-lg border-l-4 border-[#c32736] bg-[#24272e] p-4"><p className="eyebrow">história pública</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c7c9ce]">{character.publicHistory}</p></section>}
        {field("conditions") && character.conditions.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{character.conditions.map((condition) => <span className="tag border-[#663039] text-[#ef8c95]" key={condition}>{condition}</span>)}</div>}
      </div>
    </article>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return <div className={`rounded border bg-[#24272e] p-3 ${accent ? "border-[#7c3038]" : "border-[#30333a]"}`}><span className="block font-mono text-[0.58rem] uppercase text-[#888b92]">{label}</span><strong className="mt-1 block text-lg">{value}</strong></div>;
}

function CardGrid({ title, items }: { title: string; items: Array<{ id: string; index: number; title: string; meta: string; body: string }> }) {
  return <section className="mt-7"><p className="eyebrow">{title}</p><div className="mt-3 grid gap-3 lg:grid-cols-2">{items.map((item) => <article className="overflow-hidden rounded-lg border border-[#3a3d44] bg-[#e9e6de] text-[#1d2026]" key={item.id}><header className="flex items-center justify-between gap-3 bg-[#1a1d23] px-3 py-2 text-white"><h3 className="text-xs font-black uppercase"><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-[#b52532]">{item.index}</span>{item.title}</h3><span className="text-[0.58rem] uppercase text-[#ef717c]">{item.meta}</span></header><p className="min-h-20 p-4 text-xs leading-5">{item.body}</p></article>)}</div></section>;
}
