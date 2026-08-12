"use client";

import { useState } from "react";
import { Archive, Pencil, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";

type Skill = { id: string; name: string; attribute: string; bonus: number; training: string; notes?: string };
type Action = {
  id: string;
  name: string;
  test: string;
  damage: string;
  range: string;
  type: string;
  description?: string;
};
type Weakness = { id: string; name: string; effect: string; active: boolean };
type Area = "skill" | "action" | "weakness";

export function CharacterRulesManager({
  campaignId,
  characterId,
  skills,
  actions,
  weaknesses,
}: {
  campaignId: string;
  characterId: string;
  skills: Skill[];
  actions: Action[];
  weaknesses: Weakness[];
}) {
  const router = useRouter();
  const [area, setArea] = useState<Area>("skill");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [attribute, setAttribute] = useState("AGI");
  const [bonus, setBonus] = useState(0);
  const [training, setTraining] = useState("destreinado");
  const [test, setTest] = useState("1d20");
  const [damage, setDamage] = useState("1d4");
  const [range, setRange] = useState("Corpo a corpo");
  const [damageType, setDamageType] = useState("Impacto");
  const [effect, setEffect] = useState("");
  const [information, setInformation] = useState("");
  const [notice, setNotice] = useState("");

  function clear(nextArea = area) {
    setArea(nextArea);
    setId("");
    setName("");
    setAttribute("AGI");
    setBonus(0);
    setTraining("destreinado");
    setTest("1d20");
    setDamage("1d4");
    setRange("Corpo a corpo");
    setDamageType("Impacto");
    setEffect("");
    setInformation("");
    setNotice("");
  }

  function editSkill(item: Skill) {
    clear("skill");
    setId(item.id);
    setName(item.name);
    setAttribute(item.attribute.toUpperCase());
    setBonus(item.bonus);
    setTraining(item.training);
    setInformation(item.notes ?? "");
  }
  function editAction(item: Action) {
    clear("action");
    setId(item.id);
    setName(item.name);
    setTest(item.test);
    setDamage(item.damage);
    setRange(item.range);
    setDamageType(item.type);
    setInformation(item.description ?? "");
  }
  function editWeakness(item: Weakness) {
    clear("weakness");
    setId(item.id);
    setName(item.name);
    setEffect(item.effect);
  }

  async function request(body: Record<string, unknown>) {
    const response = await fetch("/api/master/characters/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId, ...body }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return (setNotice(result.error ?? "Não foi possível salvar."), false);
    router.refresh();
    return true;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const common = { area, operation: id ? "update" : "create", id: id || undefined, name };
    const body =
      area === "skill"
        ? { ...common, attribute, bonus, training, information }
        : area === "action"
          ? { ...common, test, damage, range, damageType, information }
          : { ...common, effect };
    if (await request(body)) {
      setNotice(id ? "Registro atualizado e auditado." : "Registro criado e auditado.");
      setId("");
      setName("");
    }
  }

  async function archive(itemArea: Area, itemId: string) {
    if (!window.confirm("Arquivar este registro? O histórico permanecerá preservado.")) return;
    if (await request({ area: itemArea, operation: "archive", id: itemId }))
      setNotice("Registro arquivado sem apagar o histórico.");
  }

  return (
    <section className="panel mt-4 rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">cadastros funcionais da ficha</p>
          <h2 className="font-extrabold">Perícias, ações e fraquezas</h2>
        </div>
        <button className="btn" type="button" onClick={() => clear()}>
          <Plus size={14} /> Novo registro
        </button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 md:grid-cols-3">
          <RuleList
            title="Perícias"
            items={skills}
            active={area === "skill"}
            onSelect={() => clear("skill")}
          >
            {skills.map((item) => (
              <RuleCard
                key={item.id}
                title={item.name}
                detail={`${item.attribute} · +${item.bonus} · ${item.training}`}
                information={item.notes}
                onEdit={() => editSkill(item)}
                onArchive={() => void archive("skill", item.id)}
              />
            ))}
          </RuleList>
          <RuleList
            title="Ações"
            items={actions}
            active={area === "action"}
            onSelect={() => clear("action")}
          >
            {actions.map((item) => (
              <RuleCard
                key={item.id}
                title={item.name}
                detail={`${item.test} · ${item.damage}`}
                information={item.description}
                onEdit={() => editAction(item)}
                onArchive={() => void archive("action", item.id)}
              />
            ))}
          </RuleList>
          <RuleList
            title="Fraquezas"
            items={weaknesses}
            active={area === "weakness"}
            onSelect={() => clear("weakness")}
          >
            {weaknesses.map((item) => (
              <RuleCard
                key={item.id}
                title={item.name}
                detail={item.effect}
                onEdit={() => editWeakness(item)}
                onArchive={() => void archive("weakness", item.id)}
              />
            ))}
          </RuleList>
        </div>
        <form
          className="rounded border border-[#30333a] bg-black/15 p-4"
          onSubmit={(event) => void save(event)}
        >
          <p className="eyebrow">{id ? "editar registro" : "novo registro"}</p>
          <div className="mt-3 flex gap-2">
            {(["skill", "action", "weakness"] as const).map((item) => (
              <button
                className={`btn flex-1 ${area === item ? "btn-primary" : ""}`}
                type="button"
                key={item}
                onClick={() => clear(item)}
              >
                {{ skill: "Perícia", action: "Ação", weakness: "Fraqueza" }[item]}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-bold">
            Nome
            <input
              required
              className="field mt-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {area === "skill" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">
                Atributo
                <select
                  className="field mt-1"
                  value={attribute}
                  onChange={(event) => setAttribute(event.target.value)}
                >
                  {["AGI", "FOR", "INT", "PRE", "VIG"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Bônus
                <input
                  className="field mt-1"
                  type="number"
                  min={-99}
                  max={99}
                  value={bonus}
                  onChange={(event) => setBonus(Number(event.target.value))}
                />
              </label>
              <label className="col-span-2 text-xs font-bold">
                Treinamento
                <select
                  className="field mt-1"
                  value={training}
                  onChange={(event) => setTraining(event.target.value)}
                >
                  <option value="destreinado">Destreinado</option>
                  <option value="treinado">Treinado</option>
                  <option value="veterano">Veterano</option>
                  <option value="expert">Especialista</option>
                </select>
              </label>
              <label className="col-span-2 text-xs font-bold">
                Caixa de informações da perícia
                <textarea
                  className="field mt-1 min-h-24"
                  placeholder="Explique quando usar, especialidades, limitações ou observações."
                  value={information}
                  onChange={(event) => setInformation(event.target.value)}
                />
              </label>
            </div>
          )}
          {area === "action" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">
                Fórmula do teste
                <input
                  required
                  className="field mt-1"
                  value={test}
                  onChange={(event) => setTest(event.target.value)}
                />
              </label>
              <label className="text-xs font-bold">
                Dano ou efeito
                <input
                  required
                  className="field mt-1"
                  value={damage}
                  onChange={(event) => setDamage(event.target.value)}
                />
              </label>
              <label className="text-xs font-bold">
                Alcance
                <input
                  className="field mt-1"
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                />
              </label>
              <label className="text-xs font-bold">
                Tipo
                <input
                  className="field mt-1"
                  value={damageType}
                  onChange={(event) => setDamageType(event.target.value)}
                />
              </label>
              <label className="col-span-2 text-xs font-bold">
                Caixa de informações da ação
                <textarea
                  className="field mt-1 min-h-24"
                  placeholder="Descreva funcionamento, requisitos e efeitos adicionais."
                  value={information}
                  onChange={(event) => setInformation(event.target.value)}
                />
              </label>
            </div>
          )}
          {area === "weakness" && (
            <label className="mt-3 block text-xs font-bold">
              Efeito mecânico e narrativo
              <textarea
                required
                className="field mt-1 min-h-28"
                value={effect}
                onChange={(event) => setEffect(event.target.value)}
              />
            </label>
          )}
          <button className="btn btn-primary mt-4 w-full">
            <Save size={14} /> {id ? "Salvar alterações" : "Criar registro"}
          </button>
          {notice && (
            <p className="mt-3 text-xs text-[#7bd5a5]" role="status">
              {notice}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function RuleList({
  title,
  items,
  active,
  onSelect,
  children,
}: {
  title: string;
  items: unknown[];
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded border p-3 ${active ? "border-[#6c343a]" : "border-[#30333a]"}`}>
      <button className="flex w-full justify-between text-left" type="button" onClick={onSelect}>
        <strong className="text-sm">{title}</strong>
        <span className="tag">{items.length}</span>
      </button>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{children}</div>
    </section>
  );
}

function RuleCard({
  title,
  detail,
  information,
  onEdit,
  onArchive,
}: {
  title: string;
  detail: string;
  information?: string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded border border-[#30333a] p-3">
      <strong className="text-xs">{title}</strong>
      <p className="mt-1 line-clamp-2 text-[0.68rem] text-[#777a82]">{detail}</p>
      <div className="mt-2 rounded border border-[#292c32] bg-black/20 p-2">
        <span className="block text-[0.6rem] font-bold uppercase tracking-wide text-[#d27882]">Informações</span>
        <p className="mt-1 line-clamp-3 text-[0.68rem] leading-5 text-[#92959c]">
          {information?.trim() || "Nenhuma informação adicional cadastrada."}
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <button className="btn px-2 py-1" type="button" onClick={onEdit}>
          <Pencil size={12} /> Editar
        </button>
        <button className="btn px-2 py-1" type="button" onClick={onArchive}>
          <Archive size={12} /> Arquivar
        </button>
      </div>
    </article>
  );
}
