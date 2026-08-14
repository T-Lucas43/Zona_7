"use client";

import { useState } from "react";
import { Plus, Save, Shield, Swords, Trash2 } from "lucide-react";
import type { AtorDaCampanha } from "@/server/repositories/master-repository";

const emptyProfile = {
  classificacao: "NPC",
  nivelAmeaca: 0,
  defesa: 10,
  deslocamento: 9,
  bonusIniciativa: 0,
  atributos: { agi: 1, for: 1, int: 1, pre: 1, vig: 1 },
  recursos: {
    pv: { atual: 10, maximo: 10 },
    pe: { atual: 0, maximo: 0 },
    san: { atual: 0, maximo: 0 },
  },
  resistencias: {},
  pericias: {},
  condicoes: [],
  observacoes: "",
};

const emptyAttack = {
  name: "",
  attackFormula: "1d20",
  damageFormula: "1d6",
  damageType: "Impacto",
  rangeText: "Corpo a corpo",
  actionType: "Padrão",
  description: "",
  requirements: "",
  additionalEffects: "",
  resourceKind: null as "pv" | "pe" | "san" | null,
  resourceCost: 0,
  targetScope: "enemy" as const,
  targetMin: 1,
  targetMax: 1,
};

export function ActorCombatEditor({ campaignId, actor }: { campaignId: string; actor: AtorDaCampanha }) {
  const [profile, setProfile] = useState(actor.ficha ?? emptyProfile);
  const [attacks, setAttacks] = useState(actor.ataques ?? []);
  const [attack, setAttack] = useState(emptyAttack);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [skillsText, setSkillsText] = useState(Object.entries(profile.pericias).map(([name, bonus]) => `${name}:${bonus}`).join(", "));
  const [resistancesText, setResistancesText] = useState(Object.entries(profile.resistencias).map(([name, bonus]) => `${name}:${bonus}`).join(", "));

  function number(value: string) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
  function parseBonuses(value: string) {
    return Object.fromEntries(value.split(",").flatMap((entry) => {
      const [name, bonus] = entry.split(":").map((part) => part.trim());
      return name ? [[name, number(bonus ?? "0")]] : [];
    }));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/master/actors/combat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_profile",
        campaignId,
        actorId: actor.id,
        profile: {
          classification: profile.classificacao,
          threatLevel: profile.nivelAmeaca,
          defense: profile.defesa,
          movement: profile.deslocamento,
          initiativeBonus: profile.bonusIniciativa,
          attributes: profile.atributos,
          resources: {
            pv: { current: profile.recursos.pv.atual, maximum: profile.recursos.pv.maximo },
            pe: { current: profile.recursos.pe.atual, maximum: profile.recursos.pe.maximo },
            san: { current: profile.recursos.san.atual, maximum: profile.recursos.san.maximo },
          },
          resistances: parseBonuses(resistancesText),
          skills: parseBonuses(skillsText),
          conditions: profile.condicoes,
          notes: profile.observacoes,
        },
      }),
    });
    const result = await response.json();
    setBusy(false);
    setNotice(response.ok ? "Ficha salva e sincronizada com a central de combate." : result.error ?? "Falha ao salvar a ficha.");
  }

  async function createAttack(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/master/actors/combat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_attack", campaignId, actorId: actor.id, attack }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao criar ataque.");
    setAttacks((current) => [...current, {
      id: result.id,
      nome: attack.name,
      formulaAtaque: attack.attackFormula,
      formulaDano: attack.damageFormula,
      tipoDano: attack.damageType,
      alcance: attack.rangeText,
      tipoAcao: attack.actionType,
      descricao: attack.description,
      requisitos: attack.requirements,
      efeitosAdicionais: attack.additionalEffects,
      recurso: attack.resourceKind,
      custo: attack.resourceCost,
      escopoAlvo: attack.targetScope,
      alvosMinimos: attack.targetMin,
      alvosMaximos: attack.targetMax,
    }]);
    setAttack(emptyAttack);
    setNotice("Ataque criado. Ele já pode ser preparado na Central da Sessão.");
  }

  async function removeAttack(id: string) {
    const response = await fetch("/api/master/actors/combat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_attack", campaignId, actorId: actor.id, attackId: id }),
    });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error ?? "Falha ao excluir ataque.");
    setAttacks((current) => current.filter((item) => item.id !== id));
    setNotice("Ataque removido da ficha e da central.");
  }

  return (
    <details className="mt-3 rounded-lg border border-[#343840] bg-black/15 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold">
        <Shield size={15} className="text-[#db5360]" /> Ficha de combate de {actor.nome}
      </summary>
      <form className="mt-4 space-y-3" onSubmit={saveProfile}>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-bold sm:col-span-2">Classificação<input className="field mt-1" value={profile.classificacao} onChange={(event) => setProfile({ ...profile, classificacao: event.target.value })} /></label>
          <label className="text-xs font-bold">Nível de ameaça<input className="field mt-1" type="number" min={0} value={profile.nivelAmeaca} onChange={(event) => setProfile({ ...profile, nivelAmeaca: number(event.target.value) })} /></label>
          <label className="text-xs font-bold">Defesa<input className="field mt-1" type="number" min={0} value={profile.defesa} onChange={(event) => setProfile({ ...profile, defesa: number(event.target.value) })} /></label>
          <label className="text-xs font-bold">Deslocamento<input className="field mt-1" type="number" min={0} value={profile.deslocamento} onChange={(event) => setProfile({ ...profile, deslocamento: number(event.target.value) })} /></label>
          <label className="text-xs font-bold">Bônus de iniciativa<input className="field mt-1" type="number" value={profile.bonusIniciativa} onChange={(event) => setProfile({ ...profile, bonusIniciativa: number(event.target.value) })} /></label>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(profile.atributos) as Array<keyof typeof profile.atributos>).map((key) => (
            <label className="text-center text-[0.65rem] font-bold uppercase" key={key}>{key}<input className="field mt-1 px-1 text-center" type="number" min={0} value={profile.atributos[key]} onChange={(event) => setProfile({ ...profile, atributos: { ...profile.atributos, [key]: number(event.target.value) } })} /></label>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(profile.recursos) as Array<keyof typeof profile.recursos>).map((key) => (
            <div className="rounded border border-[#30343c] p-2" key={key}>
              <strong className="text-xs uppercase">{key}</strong>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <input aria-label={`${key} atual`} className="field px-2" type="number" min={0} value={profile.recursos[key].atual} onChange={(event) => setProfile({ ...profile, recursos: { ...profile.recursos, [key]: { ...profile.recursos[key], atual: number(event.target.value) } } })} />
                <input aria-label={`${key} máximo`} className="field px-2" type="number" min={key === "pv" ? 1 : 0} value={profile.recursos[key].maximo} onChange={(event) => setProfile({ ...profile, recursos: { ...profile.recursos, [key]: { ...profile.recursos[key], maximo: number(event.target.value) } } })} />
              </div>
            </div>
          ))}
        </div>
        <label className="block text-xs font-bold">Condições (separadas por vírgula)<input className="field mt-1" value={profile.condicoes.join(", ")} onChange={(event) => setProfile({ ...profile, condicoes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        <label className="block text-xs font-bold">Perícias (nome:bônus, ...)<input className="field mt-1" placeholder="Percepção:5, Furtividade:10" value={skillsText} onChange={(event) => setSkillsText(event.target.value)} /></label>
        <label className="block text-xs font-bold">Resistências (nome:bônus, ...)<input className="field mt-1" placeholder="Fortitude:5, Reflexos:10" value={resistancesText} onChange={(event) => setResistancesText(event.target.value)} /></label>
        <label className="block text-xs font-bold">Anotações do mestre<textarea className="field mt-1 min-h-20" value={profile.observacoes} onChange={(event) => setProfile({ ...profile, observacoes: event.target.value })} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}><Save size={14} /> Salvar ficha</button>
      </form>

      <section className="mt-5 border-t border-[#343840] pt-4">
        <div className="flex items-center justify-between"><h4 className="flex items-center gap-2 font-extrabold"><Swords size={15} /> Ataques</h4><span className="tag">{attacks.length}</span></div>
        <div className="mt-2 space-y-2">
          {attacks.map((item) => <article className="rounded border border-[#343840] p-2" key={item.id}><div className="flex justify-between gap-2"><span><strong className="block text-sm">{item.nome}</strong><small className="font-mono text-[#969ca5]">{item.formulaAtaque} · {item.formulaDano} · {item.alvosMinimos}-{item.alvosMaximos} alvo(s)</small></span><button className="btn px-2 text-[#ed8791]" type="button" onClick={() => void removeAttack(item.id)}><Trash2 size={12} /></button></div>{item.descricao && <p className="mt-1 text-xs text-[#9398a1]">{item.descricao}</p>}</article>)}
        </div>
        <form className="mt-3 space-y-2 rounded border border-dashed border-[#41464f] p-3" onSubmit={createAttack}>
          <strong className="text-xs uppercase tracking-wide">Novo ataque</strong>
          <input className="field" required placeholder="Nome do ataque" value={attack.name} onChange={(event) => setAttack({ ...attack, name: event.target.value })} />
          <div className="grid grid-cols-2 gap-2"><input className="field font-mono" required aria-label="Fórmula de ataque" value={attack.attackFormula} onChange={(event) => setAttack({ ...attack, attackFormula: event.target.value })} /><input className="field font-mono" required aria-label="Fórmula de dano" value={attack.damageFormula} onChange={(event) => setAttack({ ...attack, damageFormula: event.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="Tipo de dano" value={attack.damageType} onChange={(event) => setAttack({ ...attack, damageType: event.target.value })} /><input className="field" placeholder="Alcance" value={attack.rangeText} onChange={(event) => setAttack({ ...attack, rangeText: event.target.value })} /></div>
          <textarea className="field min-h-16" placeholder="Descrição e efeitos" value={attack.description} onChange={(event) => setAttack({ ...attack, description: event.target.value })} />
          <div className="grid grid-cols-3 gap-2"><select className="field" value={attack.targetScope} onChange={(event) => setAttack({ ...attack, targetScope: event.target.value as typeof attack.targetScope })}><option value="enemy">Inimigo</option><option value="ally">Aliado</option><option value="any">Qualquer</option><option value="self">O próprio NPC</option></select><input className="field" type="number" min={0} max={20} aria-label="Mínimo de alvos" value={attack.targetMin} onChange={(event) => setAttack({ ...attack, targetMin: number(event.target.value) })} /><input className="field" type="number" min={0} max={20} aria-label="Máximo de alvos" value={attack.targetMax} onChange={(event) => setAttack({ ...attack, targetMax: number(event.target.value) })} /></div>
          <button className="btn" type="submit" disabled={busy}><Plus size={13} /> Adicionar ataque</button>
        </form>
      </section>
      {notice && <p className={`mt-3 text-xs ${/Falha|não|inválid/i.test(notice) ? "text-[#ef7d88]" : "text-[#7bd5a5]"}`}>{notice}</p>}
    </details>
  );
}
