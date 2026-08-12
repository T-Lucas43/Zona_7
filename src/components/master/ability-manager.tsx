"use client";

import { useState } from "react";
import { KeyRound, Plus, Sparkles } from "lucide-react";
import type { AbilityState, AbilitySummary } from "@/types/domain";
import { AbilityDetails } from "@/components/character/ability-details";
import { AbilityMetadataEditor } from "@/components/master/ability-metadata-editor";

const estados: Array<{ valor: AbilityState; rotulo: string }> = [
  { valor: "sealed", rotulo: "Selada" },
  { valor: "masked", rotulo: "Mascarada" },
  { valor: "discovered", rotulo: "Descoberta" },
  { valor: "unlocked", rotulo: "Liberada" },
  { valor: "altered", rotulo: "Alterada" },
  { valor: "disabled", rotulo: "Desativada" },
  { valor: "lost", rotulo: "Perdida" },
];

function nomeEstado(estado: AbilityState) {
  return estados.find((item) => item.valor === estado)?.rotulo ?? estado;
}

export function AbilityManager({
  campaignId,
  characterId,
  initialAbilities,
}: {
  campaignId: string;
  characterId: string;
  initialAbilities: AbilitySummary[];
}) {
  const [habilidades, setHabilidades] = useState(initialAbilities);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [acao, setAcao] = useState("Ação padrão");
  const [estado, setEstado] = useState<AbilityState>("sealed");
  const [nex, setNex] = useState(10);
  const [pe, setPe] = useState("");
  const [san, setSan] = useState("");
  const [criterio, setCriterio] = useState("");
  const [aplicacao, setAplicacao] = useState("");
  const [teste, setTeste] = useState("1d20");
  const [dificuldade, setDificuldade] = useState(10);
  const [sucesso, setSucesso] = useState("");
  const [parcial, setParcial] = useState("");
  const [falha, setFalha] = useState("");

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setAviso("");
    const response = await fetch("/api/master/abilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterId,
        name: nome,
        description: descricao,
        actionType: acao,
        costs: { pe, san },
        recommendedNex: nex,
        initialState: estado,
        useCriteria: criterio,
        application: aplicacao,
        testFormula: teste,
        difficulty: dificuldade,
        successEffect: sucesso,
        partialEffect: parcial,
        failureEffect: falha,
      }),
    });
    const result = (await response.json()) as {
      characterAbilityId?: string;
      id?: string;
      error?: string;
    };
    setEnviando(false);
    if (!response.ok) return setAviso(result.error ?? "Não foi possível criar a habilidade.");
    setHabilidades((atual) => [
      ...atual,
      {
        id: result.characterAbilityId ?? result.id ?? crypto.randomUUID(),
        characterId,
        name: nome,
        description: descricao,
        actionType: acao,
        costs: { ...(pe ? { pe } : {}), ...(san ? { san } : {}) },
        recommendedNex: nex,
        state: estado,
        useCriteria: criterio,
        application: aplicacao,
        testFormula: teste,
        difficulty: dificuldade,
        successEffect: sucesso,
        partialEffect: parcial,
        failureEffect: falha,
      },
    ]);
    setNome("");
    setDescricao("");
    setCriterio(""); setAplicacao(""); setTeste("1d20"); setDificuldade(10); setSucesso(""); setParcial(""); setFalha("");
    setAviso("Habilidade adicionada à ficha. O mestre controla quando ela será revelada.");
  }

  async function mudarEstado(id: string, novoEstado: AbilityState) {
    setAviso("");
    const response = await fetch("/api/master/abilities/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterAbilityId: id,
        state: novoEstado,
        reason: `Alteração manual para ${nomeEstado(novoEstado)}`,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao alterar a habilidade.");
    setHabilidades((atual) =>
      atual.map((item) => (item.id === id ? { ...item, state: novoEstado } : item)),
    );
    setAviso(`Estado atualizado para ${nomeEstado(novoEstado)}.`);
  }

  return (
    <section className="panel mt-4 rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">progressão individual</p>
          <h2 className="mt-1 text-xl font-extrabold">Habilidades do personagem</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#8f9299]">
            Crie poderes exclusivos e revele cada um no momento certo. Habilidades seladas não
            aparecem para o jogador.
          </p>
        </div>
        <span className="tag">
          <Sparkles size={12} /> {habilidades.length} cadastradas
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {habilidades.map((habilidade) => (
          <article
            className="rounded-lg border border-[#31343b] bg-black/20 p-4"
            key={habilidade.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>{habilidade.name}</strong>
                <p className="mt-1 text-xs text-[#858890]">
                  {habilidade.actionType} · NEX recomendado {habilidade.recommendedNex}%
                </p>
              </div>
              <span className="tag">
                <KeyRound size={11} /> {nomeEstado(habilidade.state)}
              </span>
            </div>
            <AbilityDetails ability={habilidade} />
            <AbilityMetadataEditor campaignId={campaignId} ability={habilidade} onSaved={(updated) => setHabilidades((items) => items.map((item) => item.id === updated.id ? updated : item))} />
            <div className="mt-3 rounded border border-[#30333a] bg-black/25 p-3">
              <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#d27882]">
                Informações da habilidade
              </span>
              <p className="mt-2 text-sm leading-6 text-[#a4a6ac]">{habilidade.description}</p>
            </div>
            <label className="mt-3 block text-xs font-bold text-[#a3a5ab]">
              Estado visível ao jogador
              <select
                className="field mt-1"
                value={habilidade.state}
                onChange={(event) =>
                  void mudarEstado(habilidade.id, event.target.value as AbilityState)
                }
              >
                {estados.map((item) => (
                  <option value={item.valor} key={item.valor}>
                    {item.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>

      <form className="mt-6 rounded-lg border border-dashed border-[#464a54] p-4" onSubmit={criar}>
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-[#d84b57]" />
          <h3 className="font-extrabold">Adicionar nova habilidade</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold">
            Nome
            <input
              required
              className="field mt-1"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
          </label>
          <label className="text-xs font-bold">
            Tipo de ação
            <input
              required
              className="field mt-1"
              value={acao}
              onChange={(event) => setAcao(event.target.value)}
            />
          </label>
          <label className="text-xs font-bold md:col-span-2">
            Descrição funcional
            <textarea
              required
              className="field mt-1 min-h-24"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
            />
          </label>
          <label className="text-xs font-bold md:col-span-2">Critério de uso<textarea required className="field mt-1 min-h-20" value={criterio} onChange={(event) => setCriterio(event.target.value)} placeholder="Quando e sob quais condições pode ser solicitada" /></label>
          <label className="text-xs font-bold md:col-span-2">Como pode ser aplicada<textarea required className="field mt-1 min-h-20" value={aplicacao} onChange={(event) => setAplicacao(event.target.value)} placeholder="Alvo, alcance, duração e forma de aplicação" /></label>
          <label className="text-xs font-bold">Teste<input required className="field mt-1 font-mono" value={teste} onChange={(event) => setTeste(event.target.value)} placeholder="Ex.: 1d20+5" /></label>
          <label className="text-xs font-bold">Dificuldade (DT)<input className="field mt-1" type="number" min={0} max={999} value={dificuldade} onChange={(event) => setDificuldade(Number(event.target.value))} /></label>
          <label className="text-xs font-bold md:col-span-2">Efeito no sucesso<textarea required className="field mt-1 min-h-20" value={sucesso} onChange={(event) => setSucesso(event.target.value)} /></label>
          <label className="text-xs font-bold">Efeito parcial<textarea className="field mt-1 min-h-20" value={parcial} onChange={(event) => setParcial(event.target.value)} /></label>
          <label className="text-xs font-bold">Efeito na falha<textarea required className="field mt-1 min-h-20" value={falha} onChange={(event) => setFalha(event.target.value)} /></label>
          <label className="text-xs font-bold">
            Estado inicial
            <select
              className="field mt-1"
              value={estado}
              onChange={(event) => setEstado(event.target.value as AbilityState)}
            >
              {estados.map((item) => (
                <option value={item.valor} key={item.valor}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            NEX recomendado
            <input
              className="field mt-1"
              min={0}
              max={100}
              type="number"
              value={nex}
              onChange={(event) => setNex(Number(event.target.value))}
            />
          </label>
          <label className="text-xs font-bold">
            Custo em PE
            <input
              className="field mt-1"
              placeholder="Ex.: 2 ou 1d4"
              value={pe}
              onChange={(event) => setPe(event.target.value)}
            />
          </label>
          <label className="text-xs font-bold">
            Custo em SAN
            <input
              className="field mt-1"
              placeholder="Ex.: 1 ou 1d4"
              value={san}
              onChange={(event) => setSan(event.target.value)}
            />
          </label>
        </div>
        <button className="btn btn-primary mt-4" disabled={enviando}>
          <Plus size={14} /> {enviando ? "Adicionando..." : "Adicionar habilidade"}
        </button>
      </form>
      {aviso && (
        <p className="mt-3 text-xs text-[#7bd5a5]" role="status">
          {aviso}
        </p>
      )}
    </section>
  );
}
